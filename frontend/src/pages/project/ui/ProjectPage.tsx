import {
  FileText,
  FolderClosed,
  FolderKanban,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "@/features/auth";
import {
  getFeaturePath,
  useFeatureActions,
  useProjectFeatures,
  type Feature,
} from "@/features/features";
import {
  getProjectPath,
  useProject,
  useProjectActions,
} from "@/features/workspace";
import { ApiError } from "@/shared/api";
import { usePageHeaderRegistration } from "@/shared/model";
import { Breadcrumb } from "@/shared/ui/breadcrumb";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { MenuItem } from "@/shared/ui/menu";
import { MenuPopover } from "@/shared/ui/menu-popover";

import styles from "./ProjectPage.module.css";

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

function isNotFound(error: unknown) {
  return (
    error instanceof ApiError && (error.status === 400 || error.status === 404)
  );
}

function FeatureCard({
  feature,
  onDelete,
  onEdit,
  projectPublicKey,
}: {
  readonly feature: Feature;
  readonly onDelete: (feature: Feature) => void;
  readonly onEdit: (feature: Feature) => void;
  readonly projectPublicKey: string;
}) {
  return (
    <li className={styles.featureItem}>
      <Card className={styles.featureCard} height="100%" width="100%">
        <article className={styles.cardContent}>
          <div className={styles.cardHeading}>
            <span aria-hidden="true" className={styles.featureIcon}>
              <FileText size={18} strokeWidth={1.75} />
            </span>
            <h2 className={styles.featureTitle}>
              <Link
                className={styles.featureLink}
                to={getFeaturePath(projectPublicKey, feature.publicKey)}
              >
                {feature.title}
              </Link>
            </h2>
            <div className={styles.cardMenu}>
              <MenuPopover label={`Open ${feature.title} feature menu`}>
                <MenuItem
                  leadingIcon={<Pencil size={16} strokeWidth={1.75} />}
                  onClick={() => onEdit(feature)}
                >
                  Edit feature
                </MenuItem>
                <MenuItem
                  leadingIcon={<Trash2 size={16} strokeWidth={1.75} />}
                  onClick={() => onDelete(feature)}
                  variant="danger"
                >
                  Delete feature
                </MenuItem>
              </MenuPopover>
            </div>
          </div>

          <time
            className={styles.updatedAt}
            dateTime={feature.updatedAt.toISOString()}
          >
            Updated {dateFormatter.format(feature.updatedAt)}
          </time>
        </article>
      </Card>
    </li>
  );
}

function FeatureCards({
  features,
  onDelete,
  onEdit,
  projectPublicKey,
}: {
  readonly features: readonly Feature[];
  readonly onDelete: (feature: Feature) => void;
  readonly onEdit: (feature: Feature) => void;
  readonly projectPublicKey: string;
}) {
  if (features.length === 0) {
    return (
      <p className={styles.status} role="status">
        No features yet.
      </p>
    );
  }

  return (
    <ul className={styles.featureList}>
      {features.map((feature) => (
        <FeatureCard
          feature={feature}
          key={feature.publicKey}
          onDelete={onDelete}
          onEdit={onEdit}
          projectPublicKey={projectPublicKey}
        />
      ))}
    </ul>
  );
}

interface ProjectContentProps {
  readonly accessToken: string;
  readonly organizationKey: string;
  readonly projectKey: string;
}

function ProjectContent({
  accessToken,
  organizationKey,
  projectKey,
}: ProjectContentProps) {
  const projectQuery = useProject(accessToken, organizationKey, projectKey);
  const { openEdit: openEditProject } = useProjectActions();
  const featureActions = useFeatureActions();
  const featuresQuery = useProjectFeatures(accessToken, projectKey);
  const projectNotFound =
    projectQuery.isError && isNotFound(projectQuery.error);
  const pageHeader = useMemo(
    () => ({
      actions: projectQuery.data ? (
        <>
          <Button
            leadingIcon={<Pencil size={16} strokeWidth={1.75} />}
            onClick={() => openEditProject(projectQuery.data)}
            variant="secondary"
          >
            Edit project
          </Button>

          <Button
            leadingIcon={<Plus size={16} strokeWidth={1.75} />}
            onClick={() =>
              featureActions.openCreate({
                projectKey: projectQuery.data.publicKey,
              })
            }
          >
            Add feature
          </Button>
        </>
      ) : undefined,
      breadcrumb: (
        <Breadcrumb
          items={[
            {
              href: "/",
              icon: <FolderClosed size={14} strokeWidth={1.75} />,
              kind: "folder" as const,
              label: "Projects",
            },
            {
              href: getProjectPath(projectQuery.data?.publicKey ?? projectKey),
              icon: <FolderKanban size={14} strokeWidth={1.75} />,
              kind: "item" as const,
              label: projectNotFound
                ? "Project not found"
                : (projectQuery.data?.name ?? "Project"),
            },
          ]}
          titleId="project-title"
        />
      ),
      subtitle: projectQuery.data
        ? "Create and manage the features in this project."
        : undefined,
    }),
    [
      featureActions,
      openEditProject,
      projectKey,
      projectNotFound,
      projectQuery.data,
    ],
  );
  usePageHeaderRegistration(pageHeader);

  if (projectQuery.isPending) {
    return <p className={styles.status}>Loading project...</p>;
  }

  if (projectQuery.isError) {
    if (isNotFound(projectQuery.error)) {
      return (
        <section className={styles.page} aria-labelledby="project-title">
          <p className="fw-overline">404</p>
          <p className={styles.status}>
            This project does not exist or is not available.
          </p>
        </section>
      );
    }

    return (
      <div className={styles.status} role="alert">
        <p>The project could not be loaded.</p>
        <Button onClick={() => void projectQuery.refetch()} size="small">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <section className={styles.page} aria-labelledby="project-title">
      {featuresQuery.isPending ? (
        <p className={styles.status} role="status">
          Loading features...
        </p>
      ) : featuresQuery.isError ? (
        <div className={styles.status} role="alert">
          <p>Features could not be loaded.</p>
          <Button onClick={() => void featuresQuery.refetch()} size="small">
            Retry
          </Button>
        </div>
      ) : (
        <FeatureCards
          features={featuresQuery.data}
          onDelete={featureActions.openDelete}
          onEdit={featureActions.openEdit}
          projectPublicKey={projectQuery.data.publicKey}
        />
      )}
    </section>
  );
}

export function ProjectPage() {
  const { accessToken, user } = useAuth();
  const { projectKey } = useParams();

  if (!projectKey) {
    return (
      <section className={styles.page}>
        <p className="fw-overline">404</p>
        <h1>Project not found</h1>
        <p className={styles.status}>The project address is invalid.</p>
      </section>
    );
  }

  if (!accessToken || !user) return null;

  return (
    <ProjectContent
      accessToken={accessToken}
      organizationKey={user.organizationKey}
      projectKey={projectKey}
    />
  );
}
