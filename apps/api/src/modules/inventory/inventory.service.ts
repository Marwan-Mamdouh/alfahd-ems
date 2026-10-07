import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { RepositoryService } from '../repository/repository.service.js';
import type {
  WarehouseInventory,
  StockMovement,
  NewStockMovement,
} from '../../entities/inventory.entity.js';
import type {
  InboundStockDto,
  OutboundStockDto,
  ReturnStockDto,
  TransferStockDto,
  AdjustStockDto,
  QueryInventoryDto,
  QueryStockMovementsDto,
} from './dto/index.js';
import type { InventoryItemWithDetails } from '../repository/repositories/inventory.repository.js';

const DEFAULT_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class InventoryService {
  constructor(private readonly repo: RepositoryService) {}

  private async ensureWarehouseExists(warehouseId: string): Promise<void> {
    const warehouse = await this.repo.warehouses.findById(warehouseId);
    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID "${warehouseId}" was not found`);
    }
  }

  private async ensureProductExists(productId: string): Promise<void> {
    const product = await this.repo.products.findById(productId);
    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" was not found`);
    }
  }

  async receiveInbound(
    dto: InboundStockDto,
  ): Promise<{ inventory: WarehouseInventory; movement: StockMovement }> {
    await this.ensureWarehouseExists(dto.warehouseId);
    await this.ensureProductExists(dto.productId);

    const current = await this.repo.inventory.getStock(dto.warehouseId, dto.productId);
    const currentQty = current?.quantity ?? 0;
    const newQuantity = currentQty + dto.quantity;

    const movement: NewStockMovement = {
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      movementType: 'INBOUND_SUPPLIER',
      quantity: dto.quantity,
      supplierName: dto.supplierName.trim(),
      responsibleUserId: dto.responsibleUserId ?? DEFAULT_SYSTEM_USER_ID,
      notes: dto.notes ? dto.notes.trim() : null,
    };

    return this.repo.inventory.recordMovementInTransaction(movement, newQuantity);
  }

  async issueOutbound(
    dto: OutboundStockDto,
  ): Promise<{ inventory: WarehouseInventory; movement: StockMovement }> {
    await this.ensureWarehouseExists(dto.warehouseId);
    await this.ensureProductExists(dto.productId);

    const current = await this.repo.inventory.getStock(dto.warehouseId, dto.productId);
    const currentQty = current?.quantity ?? 0;

    if (currentQty < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock: available ${currentQty}, requested ${dto.quantity}`,
      );
    }

    const newQuantity = currentQty - dto.quantity;

    const movement: NewStockMovement = {
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      movementType: 'OUTBOUND_TECHNICIAN',
      quantity: dto.quantity,
      technicianId: dto.technicianId,
      responsibleUserId: dto.responsibleUserId ?? DEFAULT_SYSTEM_USER_ID,
      notes: dto.notes ? dto.notes.trim() : null,
    };

    return this.repo.inventory.recordMovementInTransaction(movement, newQuantity);
  }

  async receiveReturn(
    dto: ReturnStockDto,
  ): Promise<{ inventory: WarehouseInventory; movement: StockMovement }> {
    await this.ensureWarehouseExists(dto.warehouseId);
    await this.ensureProductExists(dto.productId);

    const current = await this.repo.inventory.getStock(dto.warehouseId, dto.productId);
    const currentQty = current?.quantity ?? 0;
    const newQuantity = currentQty + dto.quantity;

    const movement: NewStockMovement = {
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      movementType: 'RETURN_TECHNICIAN',
      quantity: dto.quantity,
      technicianId: dto.technicianId,
      responsibleUserId: dto.responsibleUserId ?? DEFAULT_SYSTEM_USER_ID,
      notes: dto.notes ? dto.notes.trim() : null,
    };

    return this.repo.inventory.recordMovementInTransaction(movement, newQuantity);
  }

  async transferStock(
    dto: TransferStockDto,
  ): Promise<{ sourceInventory: WarehouseInventory; destInventory: WarehouseInventory }> {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Cannot transfer stock to the same warehouse');
    }

    await this.ensureWarehouseExists(dto.fromWarehouseId);
    await this.ensureWarehouseExists(dto.toWarehouseId);
    await this.ensureProductExists(dto.productId);

    const sourceCurrent = await this.repo.inventory.getStock(dto.fromWarehouseId, dto.productId);
    const sourceQty = sourceCurrent?.quantity ?? 0;

    if (sourceQty < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock in source warehouse: available ${sourceQty}, requested ${dto.quantity}`,
      );
    }

    const destCurrent = await this.repo.inventory.getStock(dto.toWarehouseId, dto.productId);
    const destQty = destCurrent?.quantity ?? 0;

    const sourceNewQty = sourceQty - dto.quantity;
    const destNewQty = destQty + dto.quantity;

    const movementOut: NewStockMovement = {
      warehouseId: dto.fromWarehouseId,
      productId: dto.productId,
      movementType: 'TRANSFER_WAREHOUSE',
      quantity: -dto.quantity,
      responsibleUserId: dto.responsibleUserId ?? DEFAULT_SYSTEM_USER_ID,
      notes: dto.notes ? dto.notes.trim() : `Transfer to warehouse ${dto.toWarehouseId}`,
    };

    const movementIn: NewStockMovement = {
      warehouseId: dto.toWarehouseId,
      productId: dto.productId,
      movementType: 'TRANSFER_WAREHOUSE',
      quantity: dto.quantity,
      responsibleUserId: dto.responsibleUserId ?? DEFAULT_SYSTEM_USER_ID,
      notes: dto.notes ? dto.notes.trim() : `Transfer from warehouse ${dto.fromWarehouseId}`,
    };

    return this.repo.inventory.executeTransferInTransaction(
      dto.fromWarehouseId,
      dto.toWarehouseId,
      dto.productId,
      dto.quantity,
      sourceNewQty,
      destNewQty,
      movementOut,
      movementIn,
    );
  }

  async adjustStock(
    dto: AdjustStockDto,
  ): Promise<{ inventory: WarehouseInventory; movement: StockMovement }> {
    await this.ensureWarehouseExists(dto.warehouseId);
    await this.ensureProductExists(dto.productId);

    const current = await this.repo.inventory.getStock(dto.warehouseId, dto.productId);
    const currentQty = current?.quantity ?? 0;
    const delta = dto.newQuantity - currentQty;

    const movement: NewStockMovement = {
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      movementType: 'ADJUSTMENT',
      quantity: delta,
      responsibleUserId: dto.responsibleUserId ?? DEFAULT_SYSTEM_USER_ID,
      notes: dto.notes.trim(),
    };

    return this.repo.inventory.recordMovementInTransaction(movement, dto.newQuantity);
  }

  async findAllStock(
    query: QueryInventoryDto,
  ): Promise<{ items: InventoryItemWithDetails[]; total: number }> {
    return this.repo.inventory.findManyInventory({
      warehouseId: query.warehouseId,
      productId: query.productId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  async findMovements(
    query: QueryStockMovementsDto,
  ): Promise<{ items: StockMovement[]; total: number }> {
    return this.repo.inventory.findManyMovements({
      warehouseId: query.warehouseId,
      productId: query.productId,
      movementType: query.movementType,
      technicianId: query.technicianId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  async findMovementById(id: string): Promise<StockMovement> {
    const movement = await this.repo.inventory.findMovementById(id);
    if (!movement) {
      throw new NotFoundException(`Stock movement with ID "${id}" was not found`);
    }

    return movement;
  }
}
