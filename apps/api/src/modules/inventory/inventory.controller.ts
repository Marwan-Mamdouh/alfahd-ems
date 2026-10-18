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
  UseGuards,
} from '@nestjs/common';
import { Role } from '@alfahd/types';
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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { Roles, CurrentUser } from '../../auth/decorators/index.js';
import type { JwtUser } from '../../auth/strategies/jwt.strategy.js';

@Controller(routes.inventory.root)
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF, Role.CS)
  async findAll(@Query() query: QueryInventoryDto) {
    return this.inventoryService.findAllStock(query);
  }

  @Get(routes.inventory.warehouseStock)
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF, Role.CS)
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
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF)
  @HttpCode(HttpStatus.CREATED)
  async receiveInbound(
    @Body() dto: InboundStockDto,
    @CurrentUser() user?: JwtUser,
  ) {
    return this.inventoryService.receiveInbound({
      ...dto,
      responsibleUserId: user?.userId ?? dto.responsibleUserId,
    });
  }

  @Post(routes.inventory.outbound)
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF)
  @HttpCode(HttpStatus.CREATED)
  async issueOutbound(
    @Body() dto: OutboundStockDto,
    @CurrentUser() user?: JwtUser,
  ) {
    return this.inventoryService.issueOutbound({
      ...dto,
      responsibleUserId: user?.userId ?? dto.responsibleUserId,
    });
  }

  @Post(routes.inventory.returns)
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF)
  @HttpCode(HttpStatus.CREATED)
  async receiveReturn(
    @Body() dto: ReturnStockDto,
    @CurrentUser() user?: JwtUser,
  ) {
    return this.inventoryService.receiveReturn({
      ...dto,
      responsibleUserId: user?.userId ?? dto.responsibleUserId,
    });
  }

  @Post(routes.inventory.transfer)
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF)
  @HttpCode(HttpStatus.OK)
  async transferStock(
    @Body() dto: TransferStockDto,
    @CurrentUser() user?: JwtUser,
  ) {
    return this.inventoryService.transferStock({
      ...dto,
      responsibleUserId: user?.userId ?? dto.responsibleUserId,
    });
  }

  @Post(routes.inventory.adjust)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async adjustStock(
    @Body() dto: AdjustStockDto,
    @CurrentUser() user?: JwtUser,
  ) {
    return this.inventoryService.adjustStock({
      ...dto,
      responsibleUserId: user?.userId ?? dto.responsibleUserId,
    });
  }

  @Get(routes.inventory.movements)
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF)
  async findMovements(@Query() query: QueryStockMovementsDto) {
    return this.inventoryService.findMovements(query);
  }

  @Get(routes.inventory.movementId)
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF)
  async findMovementById(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findMovementById(id);
  }
}
