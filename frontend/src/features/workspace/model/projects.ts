import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createProject,
  getProject,
  getProjects,
  type ProjectDto,
  type ProjectSummaryDto,
  updateProject,
} from "../api";

export interface Project {
  readonly createdAt: Date;
  readonly name: string;
  readonly organizationKey: string;
  readonly publicKey: string;
  readonly updatedAt: Date;
}

export interface ProjectSummary extends Project {
  readonly featureCount: number;
}

export const projectKeys = {
  detail: (projectKey: string) => ["project", projectKey] as const,
  list: (organizationKey: string) => ["projects", organizationKey] as const,
};

export function toProject(dto: ProjectDto): Project {
  return {
    createdAt: new Date(dto.createdAt),
    name: dto.name,
    organizationKey: dto.organizationKey,
    publicKey: dto.publicKey,
    updatedAt: new Date(dto.updatedAt),
  };
}

export function toProjectSummary(dto: ProjectSummaryDto): ProjectSummary {
  return {
    ...toProject(dto),
    featureCount: dto.featureCount,
  };
}

export function adjustProjectFeatureCount(
  projects: readonly ProjectSummary[] | undefined,
  projectKey: string,
  difference: number,
): readonly ProjectSummary[] | undefined {
  return projects?.map((project) =>
    project.publicKey === projectKey
      ? {
          ...project,
          featureCount: Math.max(0, project.featureCount + difference),
        }
      : project,
  );
}

export function projectsQueryOptions(
  accessToken: string,
  organizationKey: string,
) {
  return queryOptions({
    queryKey: projectKeys.list(organizationKey),
    queryFn: async () =>
      (await getProjects(accessToken, organizationKey)).map(toProjectSummary),
    staleTime: 5 * 60 * 1000,
  });
}

export function projectQueryOptions(accessToken: string, projectKey: string) {
  return queryOptions({
    queryKey: projectKeys.detail(projectKey),
    queryFn: async () => toProject(await getProject(accessToken, projectKey)),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProjects(accessToken: string, organizationKey: string) {
  return useQuery(projectsQueryOptions(accessToken, organizationKey));
}

export function useProject(
  accessToken: string,
  organizationKey: string,
  projectKey: string,
) {
  const queryClient = useQueryClient();
  const listKey = projectKeys.list(organizationKey);

  return useQuery({
    ...projectQueryOptions(accessToken, projectKey),
    initialData: () =>
      queryClient
        .getQueryData<readonly ProjectSummary[]>(listKey)
        ?.find((project) => project.publicKey === projectKey),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(listKey)?.dataUpdatedAt,
  });
}

export function useUpdateProject(accessToken: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      projectKey,
    }: {
      readonly name: string;
      readonly projectKey: string;
    }) => toProject(await updateProject(accessToken, projectKey, { name })),
    onSuccess: (project) => {
      queryClient.setQueriesData<Project>(
        { queryKey: ["project"] },
        (current) =>
          current?.publicKey === project.publicKey ? project : current,
      );
      queryClient.setQueryData(projectKeys.detail(project.publicKey), project);
      queryClient.setQueryData<readonly ProjectSummary[]>(
        projectKeys.list(project.organizationKey),
        (current) =>
          current?.map((item) =>
            item.publicKey === project.publicKey
              ? { ...item, ...project }
              : item,
          ),
      );
    },
  });
}

export function useCreateProject(accessToken: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      organizationKey,
      name,
    }: {
      organizationKey: string;
      name: string;
    }) =>
      toProject(await createProject(accessToken, organizationKey, { name })),
    onSuccess: async (project) => {
      queryClient.setQueryData(projectKeys.detail(project.publicKey), project);
      await queryClient.invalidateQueries({
        queryKey: projectKeys.list(project.organizationKey),
      });
    },
  });
}
