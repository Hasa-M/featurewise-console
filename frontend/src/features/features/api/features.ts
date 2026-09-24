import { request } from "@/shared/api";

export interface FeatureDto {
  readonly createdAt: string;
  readonly createdByKey: string;
  readonly projectKey: string;
  readonly publicKey: string;
  readonly title: string;
  readonly updatedAt: string;
}

export interface CreateFeatureDto {
  readonly title: string;
}

export interface UpdateFeatureDto {
  readonly title: string;
}

export function getProjectFeatures(
  accessToken: string,
  projectKey: string,
): Promise<readonly FeatureDto[]> {
  return request<readonly FeatureDto[]>(`/projects/${projectKey}/features`, {
    accessToken,
  });
}

export function getFeature(
  accessToken: string,
  projectKey: string,
  featureKey: string,
): Promise<FeatureDto> {
  return request<FeatureDto>(`/projects/${projectKey}/features/${featureKey}`, {
    accessToken,
  });
}

export function createFeature(
  accessToken: string,
  projectKey: string,
  input: CreateFeatureDto,
): Promise<FeatureDto> {
  return request<FeatureDto>(`/projects/${projectKey}/features`, {
    accessToken,
    body: input,
    method: "POST",
  });
}

export function updateFeature(
  accessToken: string,
  featureKey: string,
  input: UpdateFeatureDto,
): Promise<FeatureDto> {
  return request<FeatureDto>(`/features/${featureKey}`, {
    accessToken,
    body: input,
    method: "PATCH",
  });
}

export function deleteFeature(
  accessToken: string,
  featureKey: string,
): Promise<void> {
  return request<void>(`/features/${featureKey}`, {
    accessToken,
    method: "DELETE",
  });
}
