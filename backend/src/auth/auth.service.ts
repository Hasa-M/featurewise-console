import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { verify } from 'argon2';

import { formatPublicKey, parsePublicKey } from '../common/public-identifiers';
import { PrismaService } from '../database/prisma.service';
import type { LoginRequestDto } from './dto/login-request.dto';
import type {
  CurrentUserContext,
  CurrentUserResponse,
} from './current-user-context';

interface UserWithWorkspace {
  readonly id: string;
  readonly publicNumber: number;
  readonly username: string;
  readonly organizationId: string;
  readonly passwordHash: string;
  readonly isActive: boolean;
  readonly organization: {
    readonly publicNumber: number;
  };
}

interface AuthTokenPayload extends Record<string, unknown> {
  readonly sub: string;
}

export interface LoginResponse {
  readonly accessToken: string;
  readonly expiresInSeconds: number;
  readonly tokenType: 'Bearer';
  readonly user: CurrentUserResponse;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
  ) {}

  async login(dto: LoginRequestDto): Promise<LoginResponse> {
    const user = await this.findUserWithWorkspaceByUsername(
      dto.username.trim(),
    );

    if (
      user === null ||
      !user.isActive ||
      !(await this.passwordMatches(user.passwordHash, dto.password))
    ) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const expiresInSeconds = this.configService.getOrThrow<number>(
      'auth.accessTokenTtlSeconds',
    );
    const currentUser = this.toCurrentUserContext(user);
    const accessToken = await this.jwtService.signAsync(
      {
        sub: currentUser.userKey,
      } satisfies AuthTokenPayload,
      {
        expiresIn: expiresInSeconds,
        secret: this.configService.getOrThrow<string>('auth.tokenSecret'),
      },
    );

    return {
      accessToken,
      expiresInSeconds,
      tokenType: 'Bearer',
      user: this.toCurrentUserResponse(currentUser),
    };
  }

  async authenticateToken(token: string): Promise<CurrentUserContext> {
    const payload = await this.verifyToken(token);
    let publicNumber: number;

    try {
      publicNumber = parsePublicKey('user', payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid authentication token');
    }

    const user = await this.findUserWithWorkspaceByPublicNumber(publicNumber);

    if (user === null || !user.isActive) {
      throw new UnauthorizedException('Invalid authentication token');
    }

    return this.toCurrentUserContext(user);
  }

  toCurrentUserResponse(currentUser: CurrentUserContext): CurrentUserResponse {
    return {
      userKey: currentUser.userKey,
      username: currentUser.username,
      organizationKey: currentUser.organizationKey,
    };
  }

  private async verifyToken(token: string): Promise<AuthTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<
        Record<string, unknown>
      >(token, {
        secret: this.configService.getOrThrow<string>('auth.tokenSecret'),
      });

      if (!this.isAuthTokenPayload(payload)) {
        throw new UnauthorizedException('Invalid authentication token');
      }

      return payload;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid authentication token');
    }
  }

  private isAuthTokenPayload(
    payload: Record<string, unknown>,
  ): payload is AuthTokenPayload {
    return typeof payload.sub === 'string' && payload.sub.trim() !== '';
  }

  private async passwordMatches(
    passwordHash: string,
    password: string,
  ): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  private findUserWithWorkspaceByUsername(
    username: string,
  ): Promise<UserWithWorkspace | null> {
    return this.prismaService.user.findUnique({
      where: {
        username,
      },
      include: this.userWorkspaceInclude(),
    });
  }

  private findUserWithWorkspaceByPublicNumber(
    publicNumber: number,
  ): Promise<UserWithWorkspace | null> {
    return this.prismaService.user.findUnique({
      where: {
        publicNumber,
      },
      include: this.userWorkspaceInclude(),
    });
  }

  private userWorkspaceInclude() {
    return {
      organization: {
        select: { publicNumber: true },
      },
    } as const;
  }

  private toCurrentUserContext(user: UserWithWorkspace): CurrentUserContext {
    return {
      organizationId: user.organizationId,
      organizationKey: formatPublicKey(
        'organization',
        user.organization.publicNumber,
      ),
      userId: user.id,
      userKey: formatPublicKey('user', user.publicNumber),
      username: user.username,
    };
  }
}
