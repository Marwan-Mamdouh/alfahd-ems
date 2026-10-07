import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { routes } from '../../common/constants/routes.constants.js';
import {
  InboundStockDto,
  OutboundStockDto,
  ReturnStockDto,
  TransferStockDto,
  AdjustStockDto,
  QueryInventoryDto,
  QueryStockMovementsDto,
} from './dto/index.js';

@Controller(routes.inventory.root)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async findAll(@Query() query: QueryInventoryDto) {
    return this.inventoryService.findAllStock(query);
  }

  @Get(routes.inventory.warehouseStock)
  async findWarehouseStock(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Query() query: QueryInventoryDto,
  ) {
    return this.inventoryService.findAllStock({
      ...query,
      warehouseId,
    });
  }

  @Post(routes.inventory.inbound)
  @HttpCode(HttpStatus.CREATED)
  async receiveInbound(@Body() dto: InboundStockDto) {
    return this.inventoryService.receiveInbound(dto);
  }

  @Post(routes.inventory.outbound)
  @HttpCode(HttpStatus.CREATED)
  async issueOutbound(@Body() dto: OutboundStockDto) {
    return this.inventoryService.issueOutbound(dto);
  }

  @Post(routes.inventory.returns)
  @HttpCode(HttpStatus.CREATED)
  async receiveReturn(@Body() dto: ReturnStockDto) {
    return this.inventoryService.receiveReturn(dto);
  }

  @Post(routes.inventory.transfer)
  @HttpCode(HttpStatus.OK)
  async transferStock(@Body() dto: TransferStockDto) {
    return this.inventoryService.transferStock(dto);
  }

  @Post(routes.inventory.adjust)
  @HttpCode(HttpStatus.OK)
  async adjustStock(@Body() dto: AdjustStockDto) {
    return this.inventoryService.adjustStock(dto);
  }

  @Get(routes.inventory.movements)
  async findMovements(@Query() query: QueryStockMovementsDto) {
    return this.inventoryService.findMovements(query);
  }

  @Get(routes.inventory.movementId)
  async findMovementById(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findMovementById(id);
  }
}
