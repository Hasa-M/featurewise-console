export interface CurrentUserContext {
  readonly userId: string;
  readonly userKey: string;
  readonly username: string;
  readonly organizationId: string;
  readonly organizationKey: string;
}

export interface CurrentUserResponse {
  readonly userKey: string;
  readonly username: string;
  readonly organizationKey: string;
}
