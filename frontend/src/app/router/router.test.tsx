import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAppQueryClient } from "@/app/query/query-client";
import { AuthProvider } from "@/features/auth";
import { routes } from "./router";

const currentUser = {
  organizationKey: "ORG-12",
  userKey: "USR-7",
  username: "operator",
};
const timestamps = {
  createdAt: "2026-07-18T10:00:00Z",
  updatedAt: "2026-07-18T10:00:00Z",
};
let organization = { ...timestamps, publicKey: "ORG-12", name: "Workspace" };
type ProjectDto = typeof timestamps & {
  publicKey: string;
  organizationKey: string;
  name: string;
  featureCount: number;
};
type FeatureDto = typeof timestamps & {
  publicKey: string;
  projectKey: string;
  createdByKey: string;
  title: string;
};
let projects: ProjectDto[];
let features: FeatureDto[];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function defaultFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const path = String(input);
  const body = init?.body
    ? (JSON.parse(String(init.body)) as Record<string, string>)
    : {};
  if (path === "/api/auth/login")
    return Promise.resolve(
      json({
        user: currentUser,
        accessToken: "token",
        expiresInSeconds: 43200,
        tokenType: "Bearer",
      }),
    );
  if (path === "/api/auth/me") return Promise.resolve(json(currentUser));
  if (path === "/api/organizations/ORG-12") {
    if (init?.method === "PATCH")
      organization = { ...organization, name: body.name };
    return Promise.resolve(json(organization));
  }
  if (path === "/api/organizations/ORG-12/projects") {
    if (init?.method === "POST") {
      const project = {
        ...timestamps,
        publicKey: `PRJ-${projects.length + 1}`,
        organizationKey: "ORG-12",
        name: body.name,
        featureCount: 0,
      };
      projects.push(project);
      return Promise.resolve(json(project, 201));
    }
    return Promise.resolve(json(projects));
  }
  const match = path.match(
    /^\/api\/projects\/(PRJ-[0-9]+)(?:\/features(?:\/(FEAT-[0-9]+))?)?$/,
  );
  if (match) {
    const project = projects.find((item) => item.publicKey === match[1]);
    if (!project) return Promise.resolve(json({ message: "Not found" }, 404));
    if (path.includes("/features")) {
      if (init?.method === "POST") {
        const feature = {
          ...timestamps,
          publicKey: `FEAT-${features.length + 1}`,
          projectKey: project.publicKey,
          createdByKey: "USR-7",
          title: body.title,
        };
        features.push(feature);
        project.featureCount++;
        return Promise.resolve(json(feature, 201));
      }
      if (match[2])
        return Promise.resolve(
          features.some(
            (f) =>
              f.publicKey === match[2] && f.projectKey === project.publicKey,
          )
            ? json(features.find((f) => f.publicKey === match[2]))
            : json({ message: "Not found" }, 404),
        );
      return Promise.resolve(
        json(features.filter((f) => f.projectKey === project.publicKey)),
      );
    }
    if (init?.method === "PATCH") project.name = body.name;
    return Promise.resolve(json(project));
  }
  const feature = features.find((f) => path === `/api/features/${f.publicKey}`);
  if (feature) {
    if (init?.method === "PATCH") feature.title = body.title;
    if (init?.method === "DELETE") {
      features = features.filter((f) => f !== feature);
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return Promise.resolve(json(feature));
  }
  return Promise.resolve(json({ message: "Not found" }, 404));
}
function renderRoute(path: string) {
  const testRouter = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = createAppQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={testRouter} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { queryClient, testRouter };
}
function restoreSession() {
  window.localStorage.setItem("featurewise.accessToken", "token");
}
describe("Console routes", () => {
  beforeEach(() => {
    window.localStorage.clear();
    projects = [1, 2].map((n) => ({
      ...timestamps,
      publicKey: `PRJ-${n}`,
      organizationKey: "ORG-12",
      name: `Project ${n}`,
      featureCount: 0,
    }));
    features = [];
    organization = { ...timestamps, publicKey: "ORG-12", name: "Workspace" };
    vi.stubGlobal("fetch", vi.fn(defaultFetch));
  });
  it("protects routes, signs in, and clears session/cache on logout", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderRoute("/");
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeVisible();
    await user.type(screen.getByLabelText("Username"), "operator");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByRole("heading", { name: "Projects" }),
    ).toBeVisible();
    queryClient.setQueryData(["private"], "data");
    await user.click(screen.getByRole("button", { name: "Open user menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Log out" }));
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeVisible();
    expect(queryClient.getQueryData(["private"])).toBeUndefined();
    expect(window.localStorage.getItem("featurewise.accessToken")).toBeNull();
  });
  it("shows login errors and failed session restoration", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(json({ message: "Invalid username or password" }, 401)),
      ),
    );
    restoreSession();
    renderRoute("/projects/PRJ-2");
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeVisible();
    expect(window.localStorage.getItem("featurewise.accessToken")).toBeNull();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Username"), "operator");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByText("Invalid username or password."),
    ).toBeVisible();
  });
  it("supports zero projects and creates a real project through the home action", async () => {
    projects = [];
    restoreSession();
    const user = userEvent.setup();
    renderRoute("/");
    expect(await screen.findByText("No projects yet.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Create project" }));
    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByLabelText("Project name"),
      "  New project  ",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Create project" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByRole("heading", { name: "New project" }),
    ).toBeVisible();
    expect(fetch).toHaveBeenCalledWith(
      "/api/organizations/ORG-12/projects",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "New project" }),
      }),
    );
  });
  it("creates a title-only feature in the second project, renames it, and shows the unavailable history", async () => {
    restoreSession();
    const user = userEvent.setup();
    const { testRouter } = renderRoute("/projects/PRJ-2");
    expect(await screen.findByText("No features yet.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add feature" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("textbox")).toHaveLength(1);
    await user.type(
      within(dialog).getByLabelText("Feature title"),
      "Saved views",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Create feature" }),
    );
    expect(
      await screen.findByRole("heading", {
        name: "Review history is not available yet",
      }),
    ).toBeVisible();
    expect(testRouter.state.location.pathname).toBe(
      "/projects/PRJ-2/features/FEAT-1",
    );
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit feature" }));
    const title = within(screen.getByRole("dialog")).getByLabelText(
      "Feature title",
    );
    await user.clear(title);
    await user.type(title, "Renamed views");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Save changes",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: /Renamed views/ }),
    ).toBeVisible();
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/PRJ-2/features",
      expect.objectContaining({
        body: JSON.stringify({ title: "Saved views" }),
      }),
    );
    expect(
      vi
        .mocked(fetch)
        .mock.calls.map(([url]) => String(url))
        .join(" "),
    ).not.toMatch(/context|repository|analysis|reports|github/);
  });
  it("selects the current feature on a direct link and opens its project branch", async () => {
    features = [
      {
        ...timestamps,
        publicKey: "FEAT-1",
        projectKey: "PRJ-2",
        createdByKey: "USR-7",
        title: "Deep-linked feature",
      },
    ];
    restoreSession();
    renderRoute("/projects/PRJ-2/features/FEAT-1");
    const navigation = await screen.findByRole("navigation", {
      name: "Workspace navigation",
    });
    expect(
      await within(navigation).findByRole("link", {
        name: "Go to Deep-linked feature",
      }),
    ).toBeVisible();
    expect(
      within(navigation).getByRole("button", { name: "Project 2" }),
    ).toHaveAttribute("aria-expanded", "true");
  });
  it("renames a project and updates its breadcrumb", async () => {
    restoreSession();
    const user = userEvent.setup();
    renderRoute("/projects/PRJ-2");
    await user.click(
      await screen.findByRole("button", { name: "Edit project" }),
    );
    const field = within(screen.getByRole("dialog")).getByLabelText(
      "Project name",
    );
    await user.clear(field);
    await user.type(field, "Second renamed");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Save changes",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: /Second renamed/ }),
    ).toBeVisible();
  });
  it.each(["/missing", "/projects/PRJ-99", "/projects/PRJ-2/features/FEAT-99"])(
    "keeps a useful fallback for %s",
    async (path) => {
      restoreSession();
      renderRoute(path);
      expect(
        await screen.findByText(
          /does not exist|could not be found|not available/i,
        ),
      ).toBeVisible();
    },
  );
  it("shows a retryable project error without making removed requests", async () => {
    restoreSession();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        String(input) === "/api/projects/PRJ-99"
          ? Promise.resolve(json({ message: "Unavailable" }, 503))
          : defaultFetch(input, init),
      ),
    );
    renderRoute("/projects/PRJ-99");
    expect(
      await screen.findByText(
        "The project could not be loaded.",
        {},
        { timeout: 5000 },
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});
