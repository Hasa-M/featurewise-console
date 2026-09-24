import { request } from "@/shared/api";

export interface LoginCredentialsDto {
  readonly username: string;
  readonly password: string;
}

export interface CurrentUserDto {
  readonly userKey: string;
  readonly username: string;
  readonly organizationKey: string;
}

export interface LoginResponseDto {
  readonly accessToken: string;
  readonly expiresInSeconds: number;
  readonly tokenType: "Bearer";
  readonly user: CurrentUserDto;
}

export function login(
  credentials: LoginCredentialsDto,
): Promise<LoginResponseDto> {
  return request<LoginResponseDto>("/auth/login", {
    body: credentials,
    method: "POST",
  });
}

export function getCurrentUser(accessToken: string): Promise<CurrentUserDto> {
  return request<CurrentUserDto>("/auth/me", { accessToken });
}
