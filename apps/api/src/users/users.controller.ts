import { Role } from '@alfahd/types';
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtUser } from '../auth/strategies/jwt.strategy.js';
import { AuthOkResponseDto } from '../auth/dto.js';
import { SessionService } from '../redis/session.service.js';
import {
  ChangePasswordRequestDto,
  CreateUserRequestDto,
  RevokeSessionResponseDto,
  UpdateUserRequestDto,
  UserResponseDto,
} from './dto.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiCreatedResponse({ description: 'User successfully created', type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed or email already exists' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Requires Admin role' })
  create(@Body() dto: CreateUserRequestDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all users' })
  @ApiOkResponse({ description: 'List of all users', type: [UserResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Requires Admin role' })
  findAll(): Promise<UserResponseDto[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get a specific user by ID' })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    example: 'a0000000-0000-0000-0000-000000000001',
  })
  @ApiOkResponse({ description: 'User found', type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Requires Admin role' })
  findOne(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update or deactivate a user' })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    example: 'a0000000-0000-0000-0000-000000000001',
  })
  @ApiOkResponse({ description: 'User updated successfully', type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Requires Admin role' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserRequestDto,
    @Req() req: Request & { user: JwtUser },
  ): Promise<UserResponseDto> {
    if (dto.isActive === false) {
      return this.usersService.deactivate(id, req.user.userId);
    }
    return this.usersService.update(id, dto);
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Change your own password' })
  @ApiOkResponse({ description: 'Password changed successfully', type: AuthOkResponseDto })
  @ApiBadRequestResponse({ description: 'Current password incorrect or validation error' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  async changePassword(
    @Body() dto: ChangePasswordRequestDto,
    @Req() req: Request & { user: JwtUser },
  ): Promise<AuthOkResponseDto> {
    await this.usersService.changePassword(req.user.userId, dto);
    return { ok: true };
  }

  @Post(':id/revoke-session')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Revoke all sessions for a user' })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    example: 'a0000000-0000-0000-0000-000000000001',
  })
  @ApiOkResponse({ description: 'Sessions revoked successfully', type: RevokeSessionResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Requires Admin role' })
  async revokeSession(@Param('id') id: string): Promise<RevokeSessionResponseDto> {
    const revoked = await this.sessionService.revokeAllSessions(id);
    return { ok: true, revoked };
  }
}
