import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { getCurrentUser, login, type CurrentUserDto } from "../api";
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
  type AuthUser,
  type SignInCredentials,
} from "./auth-context";

const accessTokenStorageKey = "featurewise.accessToken";

interface AuthProviderProps {
  readonly children: ReactNode;
}

function readStoredAccessToken(): string | null {
  try {
    return window.localStorage.getItem(accessTokenStorageKey);
  } catch {
    return null;
  }
}

function storeAccessToken(accessToken: string): void {
  try {
    window.localStorage.setItem(accessTokenStorageKey, accessToken);
  } catch {
    // Authentication still works for the current page when storage is unavailable.
  }
}

function removeStoredAccessToken(): void {
  try {
    window.localStorage.removeItem(accessTokenStorageKey);
  } catch {
    // There is no recoverable action when browser storage is unavailable.
  }
}

function toAuthUser(user: CurrentUserDto): AuthUser {
  return {
    organizationKey: user.organizationKey,
    userKey: user.userKey,
    username: user.username,
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [accessToken, setAccessToken] = useState(readStoredAccessToken);
  const [status, setStatus] = useState<AuthStatus>(() =>
    accessToken ? "initializing" : "anonymous",
  );
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!accessToken || status !== "initializing") {
      return;
    }

    let active = true;

    void getCurrentUser(accessToken)
      .then((currentUser) => {
        if (!active) {
          return;
        }

        setUser(toAuthUser(currentUser));
        setStatus("authenticated");
      })
      .catch(() => {
        if (!active) {
          return;
        }

        removeStoredAccessToken();
        queryClient.clear();
        setAccessToken(null);
        setUser(null);
        setStatus("anonymous");
      });

    return () => {
      active = false;
    };
  }, [accessToken, queryClient, status]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      status,
      user,
      async signIn(credentials: SignInCredentials) {
        const response = await login(credentials);

        storeAccessToken(response.accessToken);
        setAccessToken(response.accessToken);
        setUser(toAuthUser(response.user));
        setStatus("authenticated");
      },
      signOut() {
        removeStoredAccessToken();
        queryClient.clear();
        setAccessToken(null);
        setUser(null);
        setStatus("anonymous");
      },
    }),
    [accessToken, queryClient, status, user],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
