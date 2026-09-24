import { z } from "zod";
export const featureCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a feature title.")
    .max(180, "Use 180 characters or fewer."),
});
export const featureQuickEditSchema = featureCreateSchema;
export type FeatureCreateValues = z.infer<typeof featureCreateSchema>;
export type FeatureQuickEditValues = z.infer<typeof featureQuickEditSchema>;
