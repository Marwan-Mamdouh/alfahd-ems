import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index.js';
import type {
  RouterStatus,
  RouterPhysicalCondition,
  RouterDto,
  RouterAssignmentDto,
  RouterReportQueryDto,
} from '@alfahd/types';
import { RepositoryService } from '../repository/repository.service.js';
import type {
  CreateRouterDto,
  AssignRouterDto,
  UpdateRouterConditionDto,
  TransitionRouterDto,
  RouterQueryDto,
} from './dto/index.js';

export const ALLOWED_ROUTER_TRANSITIONS: Record<RouterStatus, readonly RouterStatus[]> = {
  AVAILABLE: ['ASSIGNED_TO_TECHNICIAN'],
  ASSIGNED_TO_TECHNICIAN: ['INSTALLED_AT_CUSTOMER', 'RETURNED', 'DAMAGED', 'LOST'],
  INSTALLED_AT_CUSTOMER: ['RETURNED'],
  RETURNED: ['AVAILABLE', 'UNDER_REPAIR', 'DAMAGED'],
  DAMAGED: ['UNDER_REPAIR', 'DECOMMISSIONED'],
  UNDER_REPAIR: ['AVAILABLE', 'DECOMMISSIONED'],
  LOST: [],
  DECOMMISSIONED: [],
};

@Injectable()
export class RoutersService {
  constructor(
    private readonly repo: RepositoryService,
    @InjectQueue('reports') private readonly reportsQueue: Queue,
  ) {}

  async create(dto: CreateRouterDto, responsibleUserId: string): Promise<RouterDto> {
    const trimmedSerial = dto.serialNumber.trim();

    const existing = await this.repo.routers.findBySerialNumber(trimmedSerial);
    if (existing) {
      throw new ConflictException(`Router with serial number "${trimmedSerial}" already exists`);
    }

    const warehouse = await this.repo.warehouses.findById(dto.warehouseId);
    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID "${dto.warehouseId}" was not found`);
    }
    if (!warehouse.isActive) {
      throw new BadRequestException('Cannot place or register routers in a deactivated warehouse');
    }

    const product = await this.repo.products.findById(dto.productId);
    if (!product) {
      throw new NotFoundException(`Product with ID "${dto.productId}" was not found`);
    }

    const condition: RouterPhysicalCondition = dto.physicalCondition ?? 'SERVICEABLE';

    return this.repo.transaction(async (tx) => {
      // 1. Insert Router row
      const router = await this.repo.routers.createRouter(
        {
          serialNumber: trimmedSerial,
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          status: 'AVAILABLE',
          physicalCondition: condition,
          notes: dto.notes,
        },
        tx,
      );

      // 2. Initial custody row (WAREHOUSE) only if in serviceable warehouse state
      if (condition === 'SERVICEABLE') {
        await this.repo.routers.createAssignment(
          {
            routerId: router.id,
            holderType: 'WAREHOUSE',
            warehouseId: dto.warehouseId,
            assignedBy: responsibleUserId,
            notes: 'Initial warehouse registration',
          },
          tx,
        );
      }

      // 3. Atomically update inventory quantity if marked as a new inbound receipt
      if (dto.isNewReceipt) {
        if (condition === 'SERVICEABLE') {
          const currentStock = await this.repo.inventory.getStock(dto.warehouseId, dto.productId);
          const newQty = (currentStock?.quantity ?? 0) + 1;

          await this.repo.inventory.recordMovementInTransaction(
            {
              warehouseId: dto.warehouseId,
              productId: dto.productId,
              movementType: 'INBOUND_SUPPLIER',
              quantity: 1,
              responsibleUserId,
              notes: `Router receipt serial ${trimmedSerial}`,
            },
            newQty,
          );
        }
      }

      return this.mapToDto(router, null);
    });
  }

  async findById(id: string): Promise<RouterDto> {
    const router = await this.repo.routers.findById(id);
    if (!router) {
      throw new NotFoundException(`Router with ID "${id}" was not found`);
    }
    const activeCustody = await this.repo.routers.findActiveAssignment(id);
    return this.mapToDto(router, activeCustody ?? null);
  }

  async findAll(query: RouterQueryDto): Promise<{ items: RouterDto[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const { items, total } = await this.repo.routers.findManyWithPagination({
      status: query.status,
      physicalCondition: query.physicalCondition,
      warehouseId: query.warehouseId,
      productId: query.productId,
      search: query.search,
      limit,
      offset,
    });

    const dtos: RouterDto[] = [];
    for (const item of items) {
      const activeCustody = await this.repo.routers.findActiveAssignment(item.id);
      dtos.push(this.mapToDto(item, activeCustody ?? null));
    }

    return { items: dtos, total };
  }

  async assign(id: string, dto: AssignRouterDto, responsibleUserId: string): Promise<RouterDto> {
    const router = await this.repo.routers.findById(id);
    if (!router) {
      throw new NotFoundException(`Router with ID "${id}" was not found`);
    }

    // Must be usable: AVAILABLE, SERVICEABLE, and in a warehouse
    if (
      router.status !== 'AVAILABLE' ||
      router.physicalCondition !== 'SERVICEABLE' ||
      !router.warehouseId
    ) {
      throw new ConflictException(
        `Router ${router.serialNumber} is not available for assignment (Status: ${router.status}, Condition: ${router.physicalCondition})`,
      );
    }

    const warehouseId = router.warehouseId;

    return this.repo.transaction(async (tx) => {
      // 1. Release warehouse custody
      await this.repo.routers.releaseActiveAssignment(id, new Date(), tx);

      // 2. Open technician custody
      const assignment = await this.repo.routers.createAssignment(
        {
          routerId: id,
          holderType: 'TECHNICIAN',
          technicianId: dto.technicianId,
          assignedBy: responsibleUserId,
          notes: dto.notes ?? 'Assigned to technician',
        },
        tx,
      );

      // 3. Update router status
      const updatedRouter = await this.repo.routers.updateRouter(
        id,
        {
          status: 'ASSIGNED_TO_TECHNICIAN',
          warehouseId: null,
          externalLocation: null,
        },
        tx,
      );

      // 4. Decrement usable warehouse quantity
      const currentStock = await this.repo.inventory.getStock(warehouseId, router.productId);
      const newQty = Math.max(0, (currentStock?.quantity ?? 0) - 1);

      await this.repo.inventory.recordMovementInTransaction(
        {
          warehouseId,
          productId: router.productId,
          movementType: 'OUTBOUND_TECHNICIAN',
          quantity: 1,
          technicianId: dto.technicianId,
          responsibleUserId,
          notes: `Router assignment serial ${router.serialNumber}`,
        },
        newQty,
      );

      return this.mapToDto(updatedRouter!, assignment);
    });
  }

  async transition(
    id: string,
    dto: TransitionRouterDto,
    responsibleUserId: string,
    externalTx?: NodePgDatabase<typeof schema>,
  ): Promise<RouterDto> {
    const run = async (tx: NodePgDatabase<typeof schema>) => {
      const router = await this.repo.routers.findById(id, tx);
      if (!router) {
        throw new NotFoundException(`Router with ID "${id}" was not found`);
      }

      // Check transition whitelist
      const allowed = ALLOWED_ROUTER_TRANSITIONS[router.status];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid status transition from "${router.status}" to "${dto.status}". Allowed transitions: ${allowed.join(', ') || 'None (Terminal)'}`,
        );
      }

      // Handle custody & stock based on destination
      let newWarehouseId: string | null = router.warehouseId;

      if (dto.status === 'ASSIGNED_TO_TECHNICIAN') {
        throw new BadRequestException(
          'Use POST /routers/:id/assign to assign routers to technicians',
        );
      }

      if (
        dto.status === 'LOST' ||
        dto.status === 'DECOMMISSIONED' ||
        dto.status === 'DAMAGED' ||
        dto.status === 'UNDER_REPAIR'
      ) {
        // Custody is closed and remains empty
        await this.repo.routers.releaseActiveAssignment(id, new Date(), tx);
      } else if (dto.status === 'RETURNED') {
        // Close technician custody
        await this.repo.routers.releaseActiveAssignment(id, new Date(), tx);
        if (dto.targetWarehouseId) {
          newWarehouseId = dto.targetWarehouseId;
        }
      } else if (dto.status === 'AVAILABLE') {
        // Returned router inspected and marked AVAILABLE
        if (dto.targetWarehouseId) newWarehouseId = dto.targetWarehouseId;
        if (!newWarehouseId) {
          throw new BadRequestException(
            'A target warehouse ID is required when making a router AVAILABLE',
          );
        }

        // Restore warehouse custody
        await this.repo.routers.createAssignment(
          {
            routerId: id,
            holderType: 'WAREHOUSE',
            warehouseId: newWarehouseId,
            assignedBy: responsibleUserId,
            notes: dto.notes ?? 'Router returned and verified available',
          },
          tx,
        );

        // Add back to usable stock if condition is serviceable
        if (router.physicalCondition === 'SERVICEABLE') {
          const currentStock = await this.repo.inventory.getStock(newWarehouseId, router.productId);
          const newQty = (currentStock?.quantity ?? 0) + 1;

          await this.repo.inventory.recordMovementInTransaction(
            {
              warehouseId: newWarehouseId,
              productId: router.productId,
              movementType: 'RETURN_TECHNICIAN',
              quantity: 1,
              responsibleUserId,
              notes: `Router returned to inventory: ${router.serialNumber}`,
            },
            newQty,
          );
        }
      }

      const updated = await this.repo.routers.updateRouter(
        id,
        {
          status: dto.status,
          warehouseId: newWarehouseId,
          notes: dto.notes ?? router.notes,
        },
        tx,
      );

      const activeCustody = await this.repo.routers.findActiveAssignment(id, tx);
      return this.mapToDto(updated!, activeCustody ?? null);
    };

    return externalTx ? run(externalTx) : this.repo.transaction(run);
  }

  async updateCondition(
    id: string,
    dto: UpdateRouterConditionDto,
    responsibleUserId: string,
  ): Promise<RouterDto> {
    return this.repo.transaction(async (tx) => {
      const router = await this.repo.routers.findById(id, tx);
      if (!router) {
        throw new NotFoundException(`Router with ID "${id}" was not found`);
      }

      const wasUsable =
        router.status === 'AVAILABLE' &&
        router.physicalCondition === 'SERVICEABLE' &&
        Boolean(router.warehouseId);

      const willBeUsable =
        router.status === 'AVAILABLE' &&
        dto.physicalCondition === 'SERVICEABLE' &&
        Boolean(dto.warehouseId ?? router.warehouseId);

      // Record condition history
      await this.repo.routers.createConditionHistory(
        {
          routerId: id,
          fromCondition: router.physicalCondition,
          toCondition: dto.physicalCondition,
          fromWarehouseId: router.warehouseId,
          toWarehouseId: dto.warehouseId ?? router.warehouseId,
          externalLocation: dto.externalLocation ?? null,
          reason: dto.reason,
          changedBy: responsibleUserId,
        },
        tx,
      );

      // If warehouse damage occurred to an AVAILABLE router:
      // - Keep lifecycle AVAILABLE
      // - Close active custody (custody becomes empty)
      // - Keep physical warehouse location
      // - Decrement usable stock
      if (wasUsable && !willBeUsable && dto.physicalCondition === 'DAMAGED') {
        await this.repo.routers.releaseActiveAssignment(id, new Date(), tx);

        if (router.warehouseId) {
          const currentStock = await this.repo.inventory.getStock(
            router.warehouseId,
            router.productId,
          );
          const newQty = Math.max(0, (currentStock?.quantity ?? 0) - 1);

          await this.repo.inventory.recordMovementInTransaction(
            {
              warehouseId: router.warehouseId,
              productId: router.productId,
              movementType: 'ADJUSTMENT',
              quantity: 1,
              responsibleUserId,
              notes: `Router damaged in warehouse: ${router.serialNumber} (${dto.reason})`,
            },
            newQty,
          );
        }
      }

      // If repaired and restored to SERVICEABLE in warehouse:
      if (!wasUsable && willBeUsable) {
        const targetWarehouse = dto.warehouseId ?? router.warehouseId;
        if (targetWarehouse) {
          await this.repo.routers.createAssignment(
            {
              routerId: id,
              holderType: 'WAREHOUSE',
              warehouseId: targetWarehouse,
              assignedBy: responsibleUserId,
              notes: 'Restored to warehouse custody after repair',
            },
            tx,
          );

          const currentStock = await this.repo.inventory.getStock(
            targetWarehouse,
            router.productId,
          );
          const newQty = (currentStock?.quantity ?? 0) + 1;

          await this.repo.inventory.recordMovementInTransaction(
            {
              warehouseId: targetWarehouse,
              productId: router.productId,
              movementType: 'ADJUSTMENT',
              quantity: 1,
              responsibleUserId,
              notes: `Router repaired and available: ${router.serialNumber}`,
            },
            newQty,
          );
        }
      }

      const updated = await this.repo.routers.updateRouter(
        id,
        {
          physicalCondition: dto.physicalCondition,
          warehouseId: dto.warehouseId ?? router.warehouseId,
          externalLocation: dto.externalLocation ?? router.externalLocation,
        },
        tx,
      );

      const activeCustody = await this.repo.routers.findActiveAssignment(id, tx);
      return this.mapToDto(updated!, activeCustody ?? null);
    });
  }

  async getAssignments(routerId: string): Promise<RouterAssignmentDto[]> {
    const router = await this.repo.routers.findById(routerId);
    if (!router) {
      throw new NotFoundException(`Router with ID "${routerId}" was not found`);
    }
    const assignments = await this.repo.routers.findAssignmentsByRouter(routerId);
    return assignments.map((a) => ({
      id: a.id,
      routerId: a.routerId,
      holderType: a.holderType,
      warehouseId: a.warehouseId,
      technicianId: a.technicianId,
      assignedAt: a.assignedAt.toISOString(),
      releasedAt: a.releasedAt ? a.releasedAt.toISOString() : null,
      assignedBy: a.assignedBy,
      notes: a.notes,
    }));
  }

  async getConditionHistory(routerId: string) {
    const router = await this.repo.routers.findById(routerId);
    if (!router) {
      throw new NotFoundException(`Router with ID "${routerId}" was not found`);
    }
    const history = await this.repo.routers.findConditionHistory(routerId);
    return history.map((h) => ({
      id: h.id,
      routerId: h.routerId,
      fromCondition: h.fromCondition,
      toCondition: h.toCondition,
      fromWarehouseId: h.fromWarehouseId,
      toWarehouseId: h.toWarehouseId,
      externalLocation: h.externalLocation,
      reason: h.reason,
      changedBy: h.changedBy,
      createdAt: h.createdAt.toISOString(),
    }));
  }

  async exportRouterReport(
    query: RouterReportQueryDto,
    requestedBy: string,
  ): Promise<{ jobId: string }> {
    const job = await this.reportsQueue.add(
      'router-inventory-summary',
      {
        type: 'ROUTER_INVENTORY_REPORT',
        params: query,
        requestedBy,
      },
      { jobId: randomUUID() },
    );

    return { jobId: String(job.id) };
  }

  private mapToDto(router: schema.Router, custody: schema.RouterAssignment | null): RouterDto {
    return {
      id: router.id,
      serialNumber: router.serialNumber,
      productId: router.productId,
      status: router.status,
      physicalCondition: router.physicalCondition,
      warehouseId: router.warehouseId,
      externalLocation: router.externalLocation,
      currentHolderType: custody?.holderType ?? null,
      currentHolderId: custody?.technicianId ?? custody?.warehouseId ?? null,
      notes: router.notes,
      createdAt: router.createdAt.toISOString(),
      updatedAt: router.updatedAt.toISOString(),
    };
  }
}
