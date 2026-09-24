import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUserContext } from '../auth/current-user-context';
import {
  ParsePublicKeyPipe,
  type ParsedPublicNumber,
} from '../common/public-identifiers';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { WorkspaceService } from './workspace.service';

@Controller()
@UseGuards(AuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get('organizations/:organizationKey')
  async getOrganization(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('organizationKey', new ParsePublicKeyPipe('organization'))
    organizationPublicNumber: ParsedPublicNumber,
  ) {
    return this.workspaceService.getOrganization(
      currentUser,
      organizationPublicNumber.value,
    );
  }

  @Patch('organizations/:organizationKey')
  async updateOrganization(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('organizationKey', new ParsePublicKeyPipe('organization'))
    organizationPublicNumber: ParsedPublicNumber,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.workspaceService.updateOrganization(
      currentUser,
      organizationPublicNumber.value,
      dto,
    );
  }

  @Get('organizations/:organizationKey/projects')
  async listProjects(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('organizationKey', new ParsePublicKeyPipe('organization'))
    organizationPublicNumber: ParsedPublicNumber,
  ) {
    return this.workspaceService.listProjects(
      currentUser,
      organizationPublicNumber.value,
    );
  }

  @Get('projects/:projectKey')
  async getProject(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('projectKey', new ParsePublicKeyPipe('project'))
    projectPublicNumber: ParsedPublicNumber,
  ) {
    return this.workspaceService.getProject(
      currentUser,
      projectPublicNumber.value,
    );
  }

  @Post('organizations/:organizationKey/projects')
  async createProject(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('organizationKey', new ParsePublicKeyPipe('organization'))
    organizationPublicNumber: ParsedPublicNumber,
    @Body() dto: CreateProjectDto,
  ) {
    return this.workspaceService.createProject(
      currentUser,
      organizationPublicNumber.value,
      dto,
    );
  }

  @Patch('projects/:projectKey')
  async updateProject(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('projectKey', new ParsePublicKeyPipe('project'))
    projectPublicNumber: ParsedPublicNumber,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.workspaceService.updateProject(
      currentUser,
      projectPublicNumber.value,
      dto,
    );
  }
}
