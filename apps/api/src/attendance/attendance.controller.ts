import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { AttendanceListRequestDto, AttendanceListResponseDto } from './dto/attendance-list.dto.js';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List attendance records and contextual totals',
    description:
      'Employee history uses employee_id without a department filter. Empty results return an empty items array; totals ignore status and pagination.',
  })
  @ApiExtraModels(AttendanceListResponseDto)
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { data: { $ref: getSchemaPath(AttendanceListResponseDto) } },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid filters or date range' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Employee does not exist' })
  list(@Query() query: AttendanceListRequestDto): Promise<AttendanceListResponseDto> {
    return this.attendanceService.list(query);
  }

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
    @Param('id', ParseUUIDPipe) id: string,
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
