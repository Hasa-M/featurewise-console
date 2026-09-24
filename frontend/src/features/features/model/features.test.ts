import { describe, expect, it } from "vitest";

import type { FeatureDto } from "../api";
import { featureKeys, toFeature } from "./features";

describe("feature model", () => {
  it("uses stable collection and detail keys", () => {
    expect(featureKeys.list("PRJ-1")).toEqual(["features", "PRJ-1"]);
    expect(featureKeys.detail("PRJ-1", "FEAT-1")).toEqual([
      "feature",
      "PRJ-1",
      "FEAT-1",
    ]);
  });

  it("maps only the feature metadata contract from the backend response", () => {
    const dto = {
      createdAt: "2026-07-18T10:00:00.000Z",
      createdByKey: "USR-1",
      projectKey: "PRJ-204",
      publicKey: "FEAT-5831",
      title: "Authentication",
      updatedAt: "2026-07-18T11:00:00.000Z",
    } as FeatureDto & Record<string, unknown>;
    const feature = toFeature(dto);

    expect(feature.publicKey).toBe("FEAT-5831");
    expect(feature.createdAt).toBeInstanceOf(Date);
  });
});
