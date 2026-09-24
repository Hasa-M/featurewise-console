import { createContext, useContext } from "react";

import type { Organization } from "./use-organization";
import type { Project } from "./projects";

export interface WorkspaceActionsContextValue {
  openEditOrganization(organization: Organization): void;
  openEditProject(project: Project): void;
  openCreateProject(organizationKey: string): void;
}

export const WorkspaceActionsContext =
  createContext<WorkspaceActionsContextValue | null>(null);

function useWorkspaceActionsContext() {
  const context = useContext(WorkspaceActionsContext);

  if (context === null) {
    throw new Error(
      "Workspace action hooks must be used within WorkspaceActionsProvider",
    );
  }

  return context;
}

export function useOrganizationActions() {
  const { openEditOrganization } = useWorkspaceActionsContext();
  return { openEdit: openEditOrganization } as const;
}

export function useProjectActions() {
  const { openEditProject, openCreateProject } = useWorkspaceActionsContext();
  return { openEdit: openEditProject, openCreate: openCreateProject } as const;
}
