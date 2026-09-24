import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";

import { getApiErrorMessage } from "@/shared/api";
import { FormModal } from "@/shared/ui/form-modal";
import { TextInput } from "@/shared/ui/text-input";

import {
  organizationEditSchema,
  projectEditSchema,
  type OrganizationEditValues,
  type ProjectEditValues,
} from "../lib/workspace-form-schemas";
import {
  WorkspaceActionsContext,
  type WorkspaceActionsContextValue,
} from "../model/workspace-actions";
import {
  useUpdateOrganization,
  type Organization,
} from "../model/use-organization";
import {
  useCreateProject,
  useUpdateProject,
  type Project,
} from "../model/projects";

type WorkspaceAction =
  | { readonly kind: "organization"; readonly organization: Organization }
  | { readonly kind: "project"; readonly project: Project }
  | { readonly kind: "createProject"; readonly organizationKey: string };

function OrganizationDialog({
  accessToken,
  close,
  organization,
}: {
  readonly accessToken: string;
  readonly close: () => void;
  readonly organization: Organization;
}) {
  const mutation = useUpdateOrganization(accessToken);
  const form = useForm<OrganizationEditValues>({
    defaultValues: { name: organization.name },
    resolver: zodResolver(organizationEditSchema),
  });

  return (
    <FormModal
      description="Update the workspace name shown throughout Featurewise."
      errorMessage={
        mutation.error
          ? getApiErrorMessage(
              mutation.error,
              "The organization name could not be saved.",
            )
          : null
      }
      onOpenChange={(open) => {
        if (!open) close();
      }}
      onReset={form.reset}
      onSubmit={form.handleSubmit(async (values) => {
        await mutation.mutateAsync({
          name: values.name,
          organizationKey: organization.publicKey,
        });
        close();
      })}
      open
      submitLabel="Save changes"
      submitting={mutation.isPending}
      title="Edit organization"
    >
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <TextInput
            autoComplete="organization"
            disabled={mutation.isPending}
            errorMessage={fieldState.error?.message}
            label="Organization name"
            maxLength={120}
            name={field.name}
            onBlur={field.onBlur}
            onChange={field.onChange}
            required
            value={field.value}
          />
        )}
      />
    </FormModal>
  );
}

function ProjectDialog({
  accessToken,
  close,
  project,
}: {
  readonly accessToken: string;
  readonly close: () => void;
  readonly project: Project;
}) {
  const mutation = useUpdateProject(accessToken);
  const form = useForm<ProjectEditValues>({
    defaultValues: { name: project.name },
    resolver: zodResolver(projectEditSchema),
  });

  return (
    <FormModal
      description="Choose a name for this project."
      errorMessage={
        mutation.error
          ? getApiErrorMessage(
              mutation.error,
              "The project could not be saved.",
            )
          : null
      }
      onOpenChange={(open) => {
        if (!open) close();
      }}
      onReset={form.reset}
      onSubmit={form.handleSubmit(async (values) => {
        await mutation.mutateAsync({
          name: values.name,
          projectKey: project.publicKey,
        });
        close();
      })}
      open
      submitLabel="Save changes"
      submitting={mutation.isPending}
      title="Edit project"
    >
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <TextInput
            disabled={mutation.isPending}
            errorMessage={fieldState.error?.message}
            label="Project name"
            maxLength={120}
            name={field.name}
            onBlur={field.onBlur}
            onChange={field.onChange}
            required
            value={field.value}
          />
        )}
      />
    </FormModal>
  );
}

function CreateProjectDialog({
  accessToken,
  organizationKey,
  close,
}: {
  accessToken: string;
  organizationKey: string;
  close: () => void;
}) {
  const mutation = useCreateProject(accessToken);
  const form = useForm<ProjectEditValues>({
    defaultValues: { name: "" },
    resolver: zodResolver(projectEditSchema),
  });
  return (
    <FormModal
      open
      title="Create project"
      description="Add a project to organize your features."
      submitLabel="Create project"
      submitting={mutation.isPending}
      onReset={form.reset}
      errorMessage={
        mutation.error
          ? getApiErrorMessage(
              mutation.error,
              "The project could not be created.",
            )
          : null
      }
      onOpenChange={(open) => {
        if (!open) close();
      }}
      onSubmit={form.handleSubmit(async (values) => {
        await mutation.mutateAsync({ organizationKey, name: values.name });
        close();
      })}
    >
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <TextInput
            label="Project name"
            maxLength={120}
            required
            disabled={mutation.isPending}
            errorMessage={fieldState.error?.message}
            name={field.name}
            onBlur={field.onBlur}
            onChange={field.onChange}
            value={field.value}
          />
        )}
      />
    </FormModal>
  );
}

export function WorkspaceActionsProvider({
  accessToken,
  children,
}: {
  readonly accessToken: string;
  readonly children: ReactNode;
}) {
  const [action, setAction] = useState<WorkspaceAction>();
  const value = useMemo<WorkspaceActionsContextValue>(
    () => ({
      openEditOrganization: (organization) =>
        setAction({ kind: "organization", organization }),
      openEditProject: (project) => setAction({ kind: "project", project }),
      openCreateProject: (organizationKey) =>
        setAction({ kind: "createProject", organizationKey }),
    }),
    [],
  );

  return (
    <WorkspaceActionsContext.Provider value={value}>
      {children}
      {action?.kind === "organization" ? (
        <OrganizationDialog
          accessToken={accessToken}
          close={() => setAction(undefined)}
          organization={action.organization}
        />
      ) : action?.kind === "createProject" ? (
        <CreateProjectDialog
          accessToken={accessToken}
          organizationKey={action.organizationKey}
          close={() => setAction(undefined)}
        />
      ) : action?.kind === "project" ? (
        <ProjectDialog
          accessToken={accessToken}
          close={() => setAction(undefined)}
          project={action.project}
        />
      ) : null}
    </WorkspaceActionsContext.Provider>
  );
}
