import { Role, type UserDto } from '@alfahd/types';
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtUser } from '../auth/strategies/jwt.strategy.js';
import { SessionService } from '../redis/session.service.js';
import { ChangePasswordRequestDto, CreateUserRequestDto, UpdateUserRequestDto } from './dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateUserRequestDto): Promise<UserDto> {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll(): Promise<UserDto[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  findOne(@Param('id') id: string): Promise<UserDto> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserRequestDto,
    @Req() req: Request & { user: JwtUser },
  ): Promise<UserDto> {
    if (dto.isActive === false) {
      return this.usersService.deactivate(id, req.user.userId);
    }
    return this.usersService.update(id, dto);
  }

  @Post('change-password')
  async changePassword(
    @Body() dto: ChangePasswordRequestDto,
    @Req() req: Request & { user: JwtUser },
  ): Promise<{ ok: true }> {
    await this.usersService.changePassword(req.user.userId, dto);
    return { ok: true };
  }

  @Post(':id/revoke-session')
  @Roles(Role.ADMIN)
  async revokeSession(@Param('id') id: string): Promise<{ ok: true; revoked: number }> {
    const revoked = await this.sessionService.revokeAllSessions(id);
    return { ok: true, revoked };
  }
}
