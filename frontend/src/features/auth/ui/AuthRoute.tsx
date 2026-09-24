import { LoaderCircle } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../model/use-auth';
import styles from './AuthRoute.module.css';

interface RedirectState {
  readonly from?: string;
}

export function AuthLoadingPage() {
  return (
    <main className={styles.loadingPage}>
      <div className={styles.loadingContent} role={'status'}>
        <LoaderCircle
          aria-hidden={true}
          className={styles.spinner}
          size={18}
          strokeWidth={1.75}
        />
        Loading workspace...
      </div>
    </main>
  );
}

export function AuthenticatedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'initializing') {
    return <AuthLoadingPage />;
  }

  if (status === 'anonymous') {
    const from =
      location.pathname + location.search + location.hash;

    return <Navigate replace state={{ from }} to={'/login'} />;
  }

  return <Outlet />;
}

export function AnonymousRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'initializing') {
    return <AuthLoadingPage />;
  }

  if (status === 'authenticated') {
    const state = location.state as RedirectState | null;
    const destination =
      typeof state?.from === 'string' && state.from.startsWith('/')
        ? state.from
        : '/';

    return <Navigate replace to={destination} />;
  }

  return <Outlet />;
}
