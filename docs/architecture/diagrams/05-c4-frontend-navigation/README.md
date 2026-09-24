# Console navigation

```mermaid
flowchart TD
  Login[/login] --> Auth[AuthProvider and protected routes]
  Auth --> Shell[AppShell / PageStructure]
  Shell --> Home[/ Projects]
  Home --> Project[/projects/:projectKey]
  Project --> Feature[/projects/:projectKey/features/:featureKey]
  Feature --> Unavailable[Review history unavailable]
  Shell --> Query[TanStack Query cache]
  Home --> Actions[Workspace and feature action providers]
  Project --> Actions
  Feature --> Actions
```

AppShell owns the single main landmark and persistent selected navigation.
Lazy pages register breadcrumbs and actions through PageHeader registration.
The home lists and creates projects; a project lists/creates/renames features;
the feature page supports title rename and soft deletion. Organization rename
stays in the existing shell. Error, loading, empty and route fallback states
remain local to their surface. Logout clears the session cache.
