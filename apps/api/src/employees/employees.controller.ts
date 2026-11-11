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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { Role, type EmployeeDto, type EmployeeLookupDto } from '@alfahd/types';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtUser } from '../auth/strategies/jwt.strategy.js';
import { EmployeesService } from './employees.service.js';
import { CreateEmployeeRequestDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeRequestDto } from './dto/update-employee.dto.js';
import { UpdateEmployeeStatusRequestDto } from './dto/update-employee-status.dto.js';
import { EmployeeQueryRequestDto } from './dto/employee-query.dto.js';
import { EmployeeLookupQueryRequestDto } from './dto/employee-lookup-query.dto.js';
import { routes } from '../common/constants/routes.constants.js';

/**
 * 5 MB upload cap enforced by Multer itself: with memory storage the limit must
 * be applied while the payload streams in, otherwise the whole file is buffered
 * on the heap before the service's own size check ever runs (DoS vector).
 */
const MAX_PHOTO_FILE_SIZE = 5 * 1024 * 1024;

@ApiTags('employees')
@ApiBearerAuth()
@Controller(routes.employees.root)
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

  @Get(routes.employees.lookup)
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF)
  @ApiOperation({ summary: 'Minimal employee/technician lookup for selectors without PII' })
  @ApiOkResponse({ description: 'List of minimal employee lookup records' })
  lookup(@Query() query: EmployeeLookupQueryRequestDto): Promise<EmployeeLookupDto[]> {
    return this.employeesService.lookup(query);
  }

  @Get(routes.employees.id)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: JwtUser },
  ): Promise<EmployeeDto> {
    return this.employeesService.findOne(id, req.user);
  }

  @Patch(routes.employees.id)
  @Roles(Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeRequestDto,
  ): Promise<EmployeeDto> {
    return this.employeesService.update(id, dto);
  }

  @Patch(routes.employees.status)
  @Roles(Role.ADMIN)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeStatusRequestDto,
  ): Promise<EmployeeDto> {
    return this.employeesService.updateStatus(id, dto.status, dto.reason);
  }

  @Post(routes.employees.photo)
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PHOTO_FILE_SIZE },
    }),
  )
  uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ profilePhotoKey: string; url: string }> {
    return this.employeesService.uploadPhoto(id, file);
  }
}
