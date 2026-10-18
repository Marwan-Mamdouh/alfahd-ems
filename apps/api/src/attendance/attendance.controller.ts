import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role, type AttendanceRecordDto } from '@alfahd/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtUser } from '../auth/strategies/jwt.strategy.js';
import { AttendanceService } from './attendance.service.js';
import { CheckInDto } from './dto/check-in.dto.js';
import { OverrideAttendanceRequestDto } from './dto/override-attendance.dto.js';
import { AttendanceQueryRequestDto } from './dto/attendance-query.dto.js';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @Roles(Role.TECHNICIAN)
  checkIn(
    @Body() dto: CheckInDto,
    @Req() req: Request & { user: JwtUser },
  ): Promise<AttendanceRecordDto> {
    return this.attendanceService.checkIn(req.user.userId, dto.lat, dto.lng);
  }

  @Post('check-out')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.TECHNICIAN)
  checkOut(@Req() req: Request & { user: JwtUser }): Promise<AttendanceRecordDto> {
    return this.attendanceService.checkOut(req.user.userId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  override(
    @Param('id') id: string,
    @Body() dto: OverrideAttendanceRequestDto,
    @Req() req: Request & { user: JwtUser },
  ): Promise<AttendanceRecordDto> {
    return this.attendanceService.override(id, req.user.userId, dto);
  }

  @Get('report')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  getReport(
    @Query() query: AttendanceQueryRequestDto,
    @Req() req: Request & { user: JwtUser },
  ): Promise<{ jobId: string }> {
    return this.attendanceService.enqueueReport(query, req.user.userId);
  }
}
