import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@alfahd/types';
import { WarehousesService } from './warehouses.service.js';
import { routes } from '../../common/constants/routes.constants.js';
import { CreateWarehouseDto, UpdateWarehouseDto, QueryWarehousesDto } from './dto/index.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';

@Controller(routes.warehouses.root)
@UseGuards(JwtAuthGuard)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createWarehouseDto: CreateWarehouseDto) {
    return this.warehousesService.createWarehouse(createWarehouseDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF, Role.CS)
  async findAll(@Query() query: QueryWarehousesDto) {
    return this.warehousesService.findAll(query);
  }

  @Get(routes.warehouses.id)
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF, Role.CS)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.warehousesService.findById(id);
  }

  @Patch(routes.warehouses.id)
  @Roles(Role.ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWarehouseDto: UpdateWarehouseDto,
  ) {
    return this.warehousesService.update(id, updateWarehouseDto);
  }

  @Delete(routes.warehouses.id)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.warehousesService.remove(id);
  }
}
