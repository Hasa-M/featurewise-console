import { request } from "@/shared/api";

export interface ProjectDto {
  readonly createdAt: string;
  readonly name: string;
  readonly organizationKey: string;
  readonly publicKey: string;
  readonly updatedAt: string;
}

export interface ProjectSummaryDto extends ProjectDto {
  readonly featureCount: number;
}

export interface UpdateProjectDto {
  readonly name: string;
}

export function getProjects(
  accessToken: string,
  organizationKey: string,
): Promise<readonly ProjectSummaryDto[]> {
  return request<readonly ProjectSummaryDto[]>(
    `/organizations/${organizationKey}/projects`,
    { accessToken },
  );
}

export function getProject(
  accessToken: string,
  projectKey: string,
): Promise<ProjectDto> {
  return request<ProjectDto>(`/projects/${projectKey}`, { accessToken });
}

export function updateProject(
  accessToken: string,
  projectKey: string,
  input: UpdateProjectDto,
): Promise<ProjectDto> {
  return request<ProjectDto>(`/projects/${projectKey}`, {
    accessToken,
    body: input,
    method: "PATCH",
  });
}

export function createProject(
  accessToken: string,
  organizationKey: string,
  input: UpdateProjectDto,
): Promise<ProjectDto> {
  return request<ProjectDto>(`/organizations/${organizationKey}/projects`, {
    accessToken,
    body: input,
    method: "POST",
  });
}
