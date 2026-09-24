import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import { AppShell } from '@/app/layout';
import { AnonymousRoute, AuthenticatedRoute, AuthLoadingPage } from '@/features/auth';
import { LoginPage } from '@/pages/login';
import { NotFoundPage } from '@/pages/not-found';

import { EntityActionsRoute } from './EntityActionsRoute';

export const routes: RouteObject[] = [
  {
    element: <AnonymousRoute />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
    ],
  },
  {
    element: <AuthenticatedRoute />,
    hydrateFallbackElement: <AuthLoadingPage />,
    children: [
      {
        element: <EntityActionsRoute />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                path: '/',
                lazy: async () => ({
                  Component: (await import('@/pages/projects')).ProjectsPage,
                }),
              },
              {
                path: '/projects/:projectKey',
                lazy: async () => ({
                  Component: (await import('@/pages/project')).ProjectPage,
                }),
              },
              {
                path: '/projects/:projectKey/features/:featureKey',
                lazy: async () => ({
                  Component: (await import('@/pages/feature')).FeaturePage,
                }),
              },
              {
                path: '*',
                element: <NotFoundPage />,
              },
            ],
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
