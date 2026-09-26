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
} from '@nestjs/common';
import { WarehousesService } from './warehouses.service.js';
import { routes } from '../../common/constants/routes.constants.js';
import { CreateWarehouseDto, UpdateWarehouseDto, QueryWarehousesDto } from './dto/index.js';

@Controller(routes.warehouses.root)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createWarehouseDto: CreateWarehouseDto) {
    return this.warehousesService.createWarehouse(createWarehouseDto);
  }

  @Get()
  async findAll(@Query() query: QueryWarehousesDto) {
    return this.warehousesService.findAll(query);
  }

  @Get(routes.warehouses.id)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.warehousesService.findById(id);
  }

  @Patch(routes.warehouses.id)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWarehouseDto: UpdateWarehouseDto,
  ) {
    return this.warehousesService.update(id, updateWarehouseDto);
  }

  @Delete(routes.warehouses.id)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.warehousesService.remove(id);
  }
}
