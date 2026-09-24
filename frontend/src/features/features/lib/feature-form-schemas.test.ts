import { describe, expect, it } from "vitest";
import {
  featureCreateSchema,
  featureQuickEditSchema,
} from "./feature-form-schemas";
describe("feature metadata forms", () => {
  it.each([featureCreateSchema, featureQuickEditSchema])(
    "requires a bounded title and trims it",
    (schema) => {
      expect(schema.parse({ title: "  Saved views  " })).toEqual({
        title: "Saved views",
      });
      expect(schema.safeParse({ title: "   " }).success).toBe(false);
      expect(schema.safeParse({ title: "x".repeat(181) }).success).toBe(false);
    },
  );
});
