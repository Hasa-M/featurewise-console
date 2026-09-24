-- Console/report refocus. No cloud calls, and no changes to historical migrations.
BEGIN;
LOCK TABLE storage_object IN ACCESS EXCLUSIVE MODE;

-- Refuse to discard derivative metadata until a verified local inventory exists.
-- Run scripts/export-retired-derivatives.ts against this database before deploy.
DO $$
DECLARE current_inventory JSONB; exported_inventory JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(s) || jsonb_build_object('feature_id', c.feature_id)
    ORDER BY s.storage_object_id), '[]'::jsonb) INTO current_inventory
  FROM storage_object s JOIN context_artifact c USING (context_artifact_id)
  WHERE s.prepared_s3_key IS NOT NULL OR s.prepared_s3_version_id IS NOT NULL
    OR s.prepared_mime_type IS NOT NULL OR s.prepared_size_bytes IS NOT NULL
    OR s.prepared_checksum_sha256 IS NOT NULL OR s.preparation_version IS NOT NULL;
  IF current_inventory <> '[]'::jsonb THEN
    IF to_regclass('_console_refocus_inventory') IS NULL THEN
      RAISE EXCEPTION 'Export retired derivative inventory before this migration';
    END IF;
    SELECT inventory INTO exported_inventory FROM _console_refocus_inventory WHERE singleton;
    IF exported_inventory IS DISTINCT FROM current_inventory THEN
      RAISE EXCEPTION 'Derivative inventory is missing or stale; export again';
    END IF;
  END IF;
END $$;

-- Keep identifiers, account hashes, features, originals and exact S3 versions.
ALTER TABLE storage_object ADD COLUMN feature_id UUID;
UPDATE storage_object s SET feature_id = c.feature_id
  FROM context_artifact c WHERE s.context_artifact_id = c.context_artifact_id;
ALTER TABLE storage_object ALTER COLUMN feature_id SET NOT NULL;
ALTER TABLE storage_object DROP CONSTRAINT storage_object_context_artifact_id_fkey;
ALTER TABLE storage_object DROP CONSTRAINT storage_object_ready_metadata;
ALTER TABLE storage_object DROP CONSTRAINT storage_object_failed_metadata;
ALTER TABLE storage_object
  DROP COLUMN context_artifact_id, DROP COLUMN selected,
  DROP COLUMN prepared_s3_key, DROP COLUMN prepared_s3_version_id,
  DROP COLUMN prepared_mime_type, DROP COLUMN prepared_size_bytes,
  DROP COLUMN prepared_checksum_sha256, DROP COLUMN preparation_version,
  DROP COLUMN unselected_at, DROP COLUMN purge_requested_at;

ALTER TABLE storage_object ALTER COLUMN status DROP DEFAULT;
ALTER TYPE "StorageObjectStatus" RENAME TO "RetiredStorageObjectStatus";
CREATE TYPE "StorageObjectStatus" AS ENUM ('pending_upload', 'ready', 'failed');
ALTER TABLE storage_object ALTER COLUMN status TYPE "StorageObjectStatus" USING
  (CASE WHEN status::text = 'processing' THEN
    CASE WHEN s3_version_id IS NOT NULL AND confirmed_at IS NOT NULL THEN 'ready' ELSE 'failed' END
    ELSE status::text END)::"StorageObjectStatus";
ALTER TABLE storage_object ALTER COLUMN status SET DEFAULT 'pending_upload';
DROP TYPE "RetiredStorageObjectStatus";
ALTER TABLE storage_object ADD CONSTRAINT storage_object_ready_original CHECK
  -- Legacy ready rows may have no confirmed_at; preserve their exact metadata.
  (status <> 'ready' OR s3_version_id IS NOT NULL);
ALTER TABLE storage_object ADD CONSTRAINT storage_object_feature_id_fkey
  FOREIGN KEY (feature_id) REFERENCES feature(feature_id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX storage_object_storage_object_id_feature_id_key ON storage_object(storage_object_id, feature_id);
CREATE INDEX storage_object_feature_id_idx ON storage_object(feature_id);

DROP TABLE github_connection_attempt;
DROP TABLE feature_repository_selected_file;
DROP TABLE feature_repository_context;
DROP TABLE project_repository_connection;
DROP TABLE llm_call_log;
-- Retain the review public-number sequence so old public keys cannot be reused.
ALTER SEQUENCE finding_review_public_number_seq OWNED BY NONE;
ALTER SEQUENCE analysis_finding_public_number_seq OWNED BY NONE;
DROP TABLE finding_review;
DROP TABLE analysis_finding;
DROP TABLE analysis_run;
DROP TABLE context_artifact;
DROP TABLE project_context;
ALTER TABLE feature DROP COLUMN specification_content;
DROP INDEX project_organization_id_key;
CREATE INDEX project_organization_id_idx ON project(organization_id);
DROP TYPE "AnalysisRunStatus";
DROP TYPE "LlmCallPurpose";
DROP TYPE "LlmCallOutcome";
DROP TYPE "RepositoryConnectionStatus";
DROP TYPE "GitHubConnectionAttemptStatus";
DROP FUNCTION guard_analysis_run_snapshots();
DROP FUNCTION IF EXISTS guard_repository_configuration_version();
ALTER SEQUENCE analysis_finding_public_number_seq RENAME TO review_finding_public_number_seq;
CREATE TYPE "ReportSourceKind" AS ENUM ('attachment', 'local_code', 'mcp', 'reference');
CREATE SEQUENCE review_report_public_number_seq AS INTEGER MINVALUE 1 START WITH 1 NO CYCLE;
CREATE TABLE "review_report" (
    "review_report_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_number" INTEGER NOT NULL DEFAULT nextval('review_report_public_number_seq'::regclass),
    "feature_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "format_version" TEXT NOT NULL,
    "saved_by" UUID NOT NULL,
    "produced_at" TIMESTAMPTZ(6) NOT NULL,
    "saved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_report_pkey" PRIMARY KEY ("review_report_id")
);
ALTER SEQUENCE review_report_public_number_seq OWNED BY review_report.public_number;
ALTER TABLE review_report ADD CONSTRAINT review_report_public_number_positive CHECK(public_number > 0);
CREATE TRIGGER review_report_immutable BEFORE UPDATE OR DELETE ON review_report FOR EACH ROW EXECUTE FUNCTION reject_immutable_record_mutation();
CREATE TABLE "review_finding" (
    "review_finding_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_number" INTEGER NOT NULL DEFAULT nextval('review_finding_public_number_seq'::regclass),
    "report_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "why_it_matters" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "suggested_resolutions" JSONB NOT NULL,
    "verification_metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_finding_pkey" PRIMARY KEY ("review_finding_id")
);
ALTER SEQUENCE review_finding_public_number_seq OWNED BY review_finding.public_number;
ALTER TABLE review_finding ADD CONSTRAINT review_finding_public_number_positive CHECK(public_number > 0);
CREATE TRIGGER review_finding_immutable BEFORE UPDATE OR DELETE ON review_finding FOR EACH ROW EXECUTE FUNCTION reject_immutable_record_mutation();
CREATE SEQUENCE report_attachment_public_number_seq AS INTEGER MINVALUE 1 START WITH 1 NO CYCLE;
CREATE TABLE "report_attachment" (
    "report_attachment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_number" INTEGER NOT NULL DEFAULT nextval('report_attachment_public_number_seq'::regclass),
    "report_id" UUID NOT NULL,
    "feature_id" UUID NOT NULL,
    "storage_object_id" UUID NOT NULL,

    CONSTRAINT "report_attachment_pkey" PRIMARY KEY ("report_attachment_id")
);
ALTER SEQUENCE report_attachment_public_number_seq OWNED BY report_attachment.public_number;
ALTER TABLE report_attachment ADD CONSTRAINT report_attachment_public_number_positive CHECK(public_number > 0);
CREATE TRIGGER report_attachment_immutable BEFORE UPDATE OR DELETE ON report_attachment FOR EACH ROW EXECUTE FUNCTION reject_immutable_record_mutation();
CREATE SEQUENCE report_source_public_number_seq AS INTEGER MINVALUE 1 START WITH 1 NO CYCLE;
CREATE TABLE "report_source" (
    "report_source_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_number" INTEGER NOT NULL DEFAULT nextval('report_source_public_number_seq'::regclass),
    "report_id" UUID NOT NULL,
    "kind" "ReportSourceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "reference" TEXT,
    "relative_path" TEXT,
    "excerpt" TEXT,
    "revision" TEXT,
    "attachment_id" UUID,

    CONSTRAINT "report_source_pkey" PRIMARY KEY ("report_source_id")
);
ALTER SEQUENCE report_source_public_number_seq OWNED BY report_source.public_number;
ALTER TABLE report_source ADD CONSTRAINT report_source_public_number_positive CHECK(public_number > 0);
CREATE TRIGGER report_source_immutable BEFORE UPDATE OR DELETE ON report_source FOR EACH ROW EXECUTE FUNCTION reject_immutable_record_mutation();
CREATE SEQUENCE finding_evidence_public_number_seq AS INTEGER MINVALUE 1 START WITH 1 NO CYCLE;
CREATE TABLE "finding_evidence" (
    "finding_evidence_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_number" INTEGER NOT NULL DEFAULT nextval('finding_evidence_public_number_seq'::regclass),
    "report_id" UUID NOT NULL,
    "finding_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "locator" TEXT,
    "excerpt" TEXT,

    CONSTRAINT "finding_evidence_pkey" PRIMARY KEY ("finding_evidence_id")
);
ALTER SEQUENCE finding_evidence_public_number_seq OWNED BY finding_evidence.public_number;
ALTER TABLE finding_evidence ADD CONSTRAINT finding_evidence_public_number_positive CHECK(public_number > 0);
CREATE TRIGGER finding_evidence_immutable BEFORE UPDATE OR DELETE ON finding_evidence FOR EACH ROW EXECUTE FUNCTION reject_immutable_record_mutation();
CREATE TABLE "finding_review" (
    "finding_review_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_number" INTEGER NOT NULL DEFAULT nextval('finding_review_public_number_seq'::regclass),
    "finding_id" UUID NOT NULL,
    "decision" "FindingReviewDecision" NOT NULL,
    "reason" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finding_review_pkey" PRIMARY KEY ("finding_review_id")
);
ALTER SEQUENCE finding_review_public_number_seq OWNED BY finding_review.public_number;
ALTER TABLE finding_review ADD CONSTRAINT finding_review_public_number_positive CHECK(public_number > 0);
CREATE TRIGGER finding_review_immutable BEFORE UPDATE OR DELETE ON finding_review FOR EACH ROW EXECUTE FUNCTION reject_immutable_record_mutation();
-- CreateIndex
CREATE UNIQUE INDEX "review_report_public_number_key" ON "review_report"("public_number");
-- CreateIndex
CREATE INDEX "review_report_feature_id_saved_at_idx" ON "review_report"("feature_id", "saved_at");
-- CreateIndex
CREATE INDEX "review_report_saved_by_idx" ON "review_report"("saved_by");
-- CreateIndex
CREATE UNIQUE INDEX "review_report_review_report_id_feature_id_key" ON "review_report"("review_report_id", "feature_id");
-- CreateIndex
CREATE UNIQUE INDEX "review_finding_public_number_key" ON "review_finding"("public_number");
-- CreateIndex
CREATE UNIQUE INDEX "review_finding_review_finding_id_report_id_key" ON "review_finding"("review_finding_id", "report_id");
-- CreateIndex
CREATE UNIQUE INDEX "review_finding_report_id_position_key" ON "review_finding"("report_id", "position");
-- CreateIndex
CREATE UNIQUE INDEX "report_attachment_public_number_key" ON "report_attachment"("public_number");
-- CreateIndex
CREATE INDEX "report_attachment_storage_object_id_feature_id_idx" ON "report_attachment"("storage_object_id", "feature_id");
-- CreateIndex
CREATE UNIQUE INDEX "report_attachment_report_attachment_id_report_id_key" ON "report_attachment"("report_attachment_id", "report_id");
-- CreateIndex
CREATE UNIQUE INDEX "report_attachment_report_id_storage_object_id_key" ON "report_attachment"("report_id", "storage_object_id");
-- CreateIndex
CREATE UNIQUE INDEX "report_source_public_number_key" ON "report_source"("public_number");
-- CreateIndex
CREATE INDEX "report_source_report_id_idx" ON "report_source"("report_id");
-- CreateIndex
CREATE INDEX "report_source_attachment_id_report_id_idx" ON "report_source"("attachment_id", "report_id");
-- CreateIndex
CREATE UNIQUE INDEX "report_source_report_source_id_report_id_key" ON "report_source"("report_source_id", "report_id");
-- CreateIndex
CREATE UNIQUE INDEX "finding_evidence_public_number_key" ON "finding_evidence"("public_number");
-- CreateIndex
CREATE INDEX "finding_evidence_finding_id_report_id_idx" ON "finding_evidence"("finding_id", "report_id");
-- CreateIndex
CREATE INDEX "finding_evidence_source_id_report_id_idx" ON "finding_evidence"("source_id", "report_id");
-- CreateIndex
CREATE UNIQUE INDEX "finding_review_public_number_key" ON "finding_review"("public_number");
-- CreateIndex
CREATE INDEX "finding_review_finding_id_created_at_public_number_idx" ON "finding_review"("finding_id", "created_at", "public_number");
-- CreateIndex
CREATE INDEX "finding_review_created_by_idx" ON "finding_review"("created_by");
-- AddForeignKey
ALTER TABLE "review_report" ADD CONSTRAINT "review_report_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "feature"("feature_id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "review_report" ADD CONSTRAINT "review_report_saved_by_fkey" FOREIGN KEY ("saved_by") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "review_finding" ADD CONSTRAINT "review_finding_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "review_report"("review_report_id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "report_attachment" ADD CONSTRAINT "report_attachment_report_id_feature_id_fkey" FOREIGN KEY ("report_id", "feature_id") REFERENCES "review_report"("review_report_id", "feature_id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "report_attachment" ADD CONSTRAINT "report_attachment_storage_object_id_feature_id_fkey" FOREIGN KEY ("storage_object_id", "feature_id") REFERENCES "storage_object"("storage_object_id", "feature_id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "report_source" ADD CONSTRAINT "report_source_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "review_report"("review_report_id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "report_source" ADD CONSTRAINT "report_source_attachment_id_report_id_fkey" FOREIGN KEY ("attachment_id", "report_id") REFERENCES "report_attachment"("report_attachment_id", "report_id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "finding_evidence" ADD CONSTRAINT "finding_evidence_finding_id_report_id_fkey" FOREIGN KEY ("finding_id", "report_id") REFERENCES "review_finding"("review_finding_id", "report_id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "finding_evidence" ADD CONSTRAINT "finding_evidence_source_id_report_id_fkey" FOREIGN KEY ("source_id", "report_id") REFERENCES "report_source"("report_source_id", "report_id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "finding_review" ADD CONSTRAINT "finding_review_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "finding_review" ADD CONSTRAINT "finding_review_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "review_finding"("review_finding_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE review_report ADD CONSTRAINT review_report_format_nonempty CHECK (length(btrim(format_version)) > 0);
ALTER TABLE review_finding ADD CONSTRAINT review_finding_position_positive CHECK (position >= 0);
ALTER TABLE review_finding ADD CONSTRAINT review_finding_resolutions_array CHECK (jsonb_typeof(suggested_resolutions) = 'array');
ALTER TABLE report_source ADD CONSTRAINT report_source_shape CHECK (
  (kind = 'attachment' AND attachment_id IS NOT NULL AND relative_path IS NULL)
  OR (kind = 'local_code' AND attachment_id IS NULL AND relative_path IS NOT NULL AND excerpt IS NOT NULL)
  OR (kind IN ('mcp', 'reference') AND attachment_id IS NULL AND relative_path IS NULL
    AND reference IS NOT NULL AND length(btrim(reference)) > 0 AND excerpt IS NULL)
);
ALTER TABLE report_source ADD CONSTRAINT report_source_relative_path CHECK (
  relative_path IS NULL OR (relative_path <> '' AND relative_path !~ '(^/|^[A-Za-z]:|\\|(^|/)\.\.(/|$)|(^|/)\.(/|$)|//|/$)')
);

CREATE FUNCTION guard_report_author() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feature f JOIN project p USING(project_id)
    JOIN "user" u ON u.organization_id = p.organization_id
    WHERE f.feature_id = NEW.feature_id AND u.user_id = NEW.saved_by) THEN
    RAISE EXCEPTION 'Report author must belong to the feature organization';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER review_report_author BEFORE INSERT ON review_report FOR EACH ROW EXECUTE FUNCTION guard_report_author();

CREATE FUNCTION guard_finding_review_author() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM review_finding rf JOIN review_report rr ON rr.review_report_id = rf.report_id
    JOIN feature f USING(feature_id) JOIN project p USING(project_id)
    JOIN "user" u ON u.organization_id = p.organization_id
    WHERE rf.review_finding_id = NEW.finding_id AND u.user_id = NEW.created_by) THEN
    RAISE EXCEPTION 'Decision author must belong to the finding organization';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER finding_review_author BEFORE INSERT ON finding_review FOR EACH ROW EXECUTE FUNCTION guard_finding_review_author();

CREATE FUNCTION guard_mcp_evidence() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.excerpt IS NOT NULL AND EXISTS (SELECT 1 FROM report_source
    WHERE report_source_id = NEW.source_id AND kind = 'mcp') THEN
    RAISE EXCEPTION 'MCP evidence must retain a reference without copied content';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER finding_evidence_reference_only BEFORE INSERT ON finding_evidence FOR EACH ROW EXECUTE FUNCTION guard_mcp_evidence();

CREATE FUNCTION retain_report_original() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- The row lock also serializes linking with changes to original metadata.
  PERFORM 1 FROM storage_object WHERE storage_object_id = NEW.storage_object_id
    AND feature_id = NEW.feature_id AND s3_version_id IS NOT NULL AND confirmed_at IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report attachment requires a confirmed original of the same feature'; END IF;
  UPDATE storage_object SET first_used_at = COALESCE(first_used_at, CURRENT_TIMESTAMP)
    WHERE storage_object_id = NEW.storage_object_id;
  RETURN NEW;
END $$;
CREATE TRIGGER report_attachment_retain BEFORE INSERT ON report_attachment FOR EACH ROW EXECUTE FUNCTION retain_report_original();

CREATE FUNCTION guard_retained_original() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.s3_version_id IS NOT NULL OR OLD.first_used_at IS NOT NULL THEN
      RAISE EXCEPTION 'Retained original cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.first_used_at IS NOT NULL AND NEW.first_used_at IS DISTINCT FROM OLD.first_used_at THEN
    RAISE EXCEPTION 'First use is immutable';
  END IF;
  IF (OLD.s3_version_id IS NOT NULL OR OLD.first_used_at IS NOT NULL) AND
    (NEW.feature_id, NEW.s3_key, NEW.s3_version_id, NEW.checksum_sha256, NEW.mime_type, NEW.size_bytes, NEW.created_by,
      NEW.upload_key, NEW.upload_version_id, NEW.original_filename, NEW.confirmed_at)
    IS DISTINCT FROM
    (OLD.feature_id, OLD.s3_key, OLD.s3_version_id, OLD.checksum_sha256, OLD.mime_type, OLD.size_bytes, OLD.created_by,
      OLD.upload_key, OLD.upload_version_id, OLD.original_filename, OLD.confirmed_at) THEN
    RAISE EXCEPTION 'Retained original metadata is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER storage_original_retained BEFORE UPDATE OR DELETE ON storage_object FOR EACH ROW EXECUTE FUNCTION guard_retained_original();
DROP TABLE IF EXISTS _console_refocus_inventory;
COMMIT;
