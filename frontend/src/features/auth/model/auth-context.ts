import { createContext } from "react";

export interface AuthUser {
  readonly userKey: string;
  readonly username: string;
  readonly organizationKey: string;
}

export type AuthStatus = "initializing" | "authenticated" | "anonymous";

export interface SignInCredentials {
  readonly username: string;
  readonly password: string;
}

export interface AuthContextValue {
  readonly accessToken: string | null;
  readonly status: AuthStatus;
  readonly user: AuthUser | null;
  signIn(credentials: SignInCredentials): Promise<void>;
  signOut(): void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
