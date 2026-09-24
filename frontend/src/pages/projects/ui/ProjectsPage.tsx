import { useQueryClient } from "@tanstack/react-query";
import { FolderClosed, FolderKanban, Pencil, Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@/features/auth";
import { projectFeaturesQueryOptions } from "@/features/features";
import {
  getProjectPath,
  useProjectActions,
  useProjects,
} from "@/features/workspace";
import { usePageHeaderRegistration } from "@/shared/model";
import { Breadcrumb } from "@/shared/ui/breadcrumb";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { MenuItem } from "@/shared/ui/menu";
import { MenuPopover } from "@/shared/ui/menu-popover";

import styles from "./ProjectsPage.module.css";

interface ProjectsContentProps {
  readonly accessToken: string;
  readonly organizationKey: string;
}

function ProjectsContent({
  accessToken,
  organizationKey,
}: ProjectsContentProps) {
  const projectsQuery = useProjects(accessToken, organizationKey);
  const { openEdit, openCreate } = useProjectActions();
  const queryClient = useQueryClient();
  const pageHeader = useMemo(
    () => ({
      breadcrumb: (
        <Breadcrumb
          items={[
            {
              href: "/",
              icon: <FolderClosed size={14} strokeWidth={1.75} />,
              kind: "folder" as const,
              label: "Projects",
            },
          ]}
          titleId="projects-title"
        />
      ),
      subtitle: "Choose a project to browse its features.",
      actions: (
        <Button
          leadingIcon={<Plus size={16} />}
          onClick={() => openCreate(organizationKey)}
        >
          Create project
        </Button>
      ),
    }),
    [openCreate, organizationKey],
  );
  usePageHeaderRegistration(pageHeader);
  const prefetchFeatures = useCallback(
    (projectKey: string) => {
      void queryClient.prefetchQuery(
        projectFeaturesQueryOptions(accessToken, projectKey),
      );
    },
    [accessToken, queryClient],
  );

  function featureCountLabel(featureCount: number) {
    return `${featureCount} ${featureCount === 1 ? "feature" : "features"}`;
  }

  return (
    <section className={styles.page} aria-labelledby="projects-title">
      {projectsQuery.isPending ? (
        <p className={styles.status} role="status">
          Loading projects...
        </p>
      ) : projectsQuery.isError ? (
        <div className={styles.status} role="alert">
          <p>Projects could not be loaded.</p>
          <Button onClick={() => void projectsQuery.refetch()} size="small">
            Retry
          </Button>
        </div>
      ) : projectsQuery.data.length === 0 ? (
        <p className={styles.status} role="status">
          No projects yet.
        </p>
      ) : (
        <ul className={styles.list}>
          {projectsQuery.data.map((project) => (
            <li className={styles.item} key={project.publicKey}>
              <Card className={styles.card} height="100%" width="100%">
                <article className={styles.cardContent}>
                  <div className={styles.cardHeading}>
                    <span aria-hidden="true" className={styles.projectIcon}>
                      <FolderKanban size={18} strokeWidth={1.75} />
                    </span>
                    <h2 className={styles.projectName}>
                      <Link
                        aria-describedby={`project-${project.publicKey}-feature-count`}
                        className={styles.projectLink}
                        onFocus={() => prefetchFeatures(project.publicKey)}
                        onPointerEnter={() =>
                          prefetchFeatures(project.publicKey)
                        }
                        to={getProjectPath(project.publicKey)}
                      >
                        {project.name}
                      </Link>
                    </h2>
                    <div className={styles.cardMenu}>
                      <MenuPopover label={`Open ${project.name} project menu`}>
                        <MenuItem
                          leadingIcon={<Pencil size={16} strokeWidth={1.75} />}
                          onClick={() => openEdit(project)}
                        >
                          Edit project
                        </MenuItem>
                      </MenuPopover>
                    </div>
                  </div>
                  <p
                    className={styles.featureCount}
                    id={`project-${project.publicKey}-feature-count`}
                  >
                    {featureCountLabel(project.featureCount)}
                  </p>
                </article>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ProjectsPage() {
  const { accessToken, user } = useAuth();

  if (!accessToken || !user) return null;

  return (
    <ProjectsContent
      accessToken={accessToken}
      organizationKey={user.organizationKey}
    />
  );
}
