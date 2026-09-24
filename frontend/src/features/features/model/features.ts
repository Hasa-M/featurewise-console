import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createFeature,
  deleteFeature,
  getFeature,
  getProjectFeatures,
  type CreateFeatureDto,
  type FeatureDto,
  type UpdateFeatureDto,
  updateFeature,
} from "../api";

export interface Feature {
  readonly createdAt: Date;
  readonly createdByKey: string;
  readonly projectKey: string;
  readonly publicKey: string;
  readonly title: string;
  readonly updatedAt: Date;
}

export const featureKeys = {
  detail: (projectKey: string, featureKey: string) =>
    ["feature", projectKey, featureKey] as const,
  list: (projectKey: string) => ["features", projectKey] as const,
};

export function toFeature(dto: FeatureDto): Feature {
  return {
    createdAt: new Date(dto.createdAt),
    createdByKey: dto.createdByKey,
    projectKey: dto.projectKey,
    publicKey: dto.publicKey,
    title: dto.title,
    updatedAt: new Date(dto.updatedAt),
  };
}

export function projectFeaturesQueryOptions(
  accessToken: string,
  projectKey: string,
) {
  return queryOptions({
    queryKey: featureKeys.list(projectKey),
    queryFn: async () =>
      (await getProjectFeatures(accessToken, projectKey)).map(toFeature),
    staleTime: 60 * 1000,
  });
}

export function featureQueryOptions(
  accessToken: string,
  projectKey: string,
  featureKey: string,
) {
  return queryOptions({
    queryKey: featureKeys.detail(projectKey, featureKey),
    queryFn: async () =>
      toFeature(await getFeature(accessToken, projectKey, featureKey)),
    staleTime: 60 * 1000,
  });
}

export function useProjectFeatures(
  accessToken: string,
  projectKey: string,
  enabled = true,
) {
  return useQuery({
    ...projectFeaturesQueryOptions(accessToken, projectKey),
    enabled,
  });
}

export function useFeature(
  accessToken: string,
  projectKey: string,
  featureKey: string,
) {
  const queryClient = useQueryClient();
  const listKey = featureKeys.list(projectKey);

  return useQuery({
    ...featureQueryOptions(accessToken, projectKey, featureKey),
    initialData: () =>
      queryClient
        .getQueryData<readonly Feature[]>(listKey)
        ?.find((feature) => feature.publicKey === featureKey),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(listKey)?.dataUpdatedAt,
  });
}

export interface CreateFeatureInput extends CreateFeatureDto {
  readonly projectKey: string;
}

export interface UpdateFeatureInput extends UpdateFeatureDto {
  readonly featureKey: string;
}

export type FeatureQuickEditInput = UpdateFeatureInput;

export function useCreateFeature(accessToken: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectKey, ...input }: CreateFeatureInput) =>
      toFeature(await createFeature(accessToken, projectKey, input)),
    onSuccess: (feature) => {
      queryClient.setQueryData(
        featureKeys.detail(feature.projectKey, feature.publicKey),
        feature,
      );
      queryClient.setQueryData<readonly Feature[]>(
        featureKeys.list(feature.projectKey),
        (current) => [
          feature,
          ...(current?.filter((item) => item.publicKey !== feature.publicKey) ??
            []),
        ],
      );
    },
  });
}

export function useUpdateFeature(accessToken: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ featureKey, ...input }: UpdateFeatureInput) =>
      toFeature(await updateFeature(accessToken, featureKey, input)),
    onSuccess: (feature) => {
      queryClient.setQueriesData<Feature>(
        { queryKey: ["feature"] },
        (current) =>
          current?.publicKey === feature.publicKey ? feature : current,
      );
      queryClient.setQueryData(
        featureKeys.detail(feature.projectKey, feature.publicKey),
        feature,
      );
      queryClient.setQueryData<readonly Feature[]>(
        featureKeys.list(feature.projectKey),
        (current) =>
          current?.map((item) =>
            item.publicKey === feature.publicKey ? feature : item,
          ),
      );
    },
  });
}

export function useDeleteFeature(accessToken: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (feature: Feature) => {
      await deleteFeature(accessToken, feature.publicKey);
      return feature;
    },
    onSuccess: (feature) => {
      queryClient.setQueryData<readonly Feature[]>(
        featureKeys.list(feature.projectKey),
        (current) =>
          current?.filter((item) => item.publicKey !== feature.publicKey),
      );
      queryClient.removeQueries({
        predicate: (query) => {
          const data = query.state.data as Feature | undefined;

          return (
            query.queryKey[0] === "feature" &&
            data?.publicKey === feature.publicKey
          );
        },
      });
    },
  });
}
