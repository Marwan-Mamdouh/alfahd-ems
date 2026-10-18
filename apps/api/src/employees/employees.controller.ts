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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { Role, type EmployeeDto } from '@alfahd/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtUser } from '../auth/strategies/jwt.strategy.js';
import { EmployeesService } from './employees.service.js';
import { CreateEmployeeRequestDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeRequestDto } from './dto/update-employee.dto.js';
import { UpdateEmployeeStatusRequestDto } from './dto/update-employee-status.dto.js';
import { EmployeeQueryRequestDto } from './dto/employee-query.dto.js';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateEmployeeRequestDto): Promise<EmployeeDto> {
    return this.employeesService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll(@Query() query: EmployeeQueryRequestDto): Promise<{
    data: EmployeeDto[];
    meta: { page: number; pageSize: number; total: number };
  }> {
    return this.employeesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request & { user: JwtUser }): Promise<EmployeeDto> {
    return this.employeesService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeRequestDto): Promise<EmployeeDto> {
    return this.employeesService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeStatusRequestDto,
  ): Promise<EmployeeDto> {
    return this.employeesService.updateStatus(id, dto.status, dto.reason);
  }

  @Post(':id/photo')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ profilePhotoKey: string; url: string }> {
    return this.employeesService.uploadPhoto(id, file);
  }
}
