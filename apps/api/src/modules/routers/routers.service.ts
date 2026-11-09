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
  RouterStatusHistoryDto,
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

  async create(
    dto: CreateRouterDto,
    responsibleUserId: string,
    externalTx?: NodePgDatabase<typeof schema>,
  ): Promise<RouterDto> {
    const trimmedSerial = dto.serialNumber.trim();

    const existing = await this.repo.routers.findBySerialNumber(trimmedSerial, externalTx);
    if (existing) {
      throw new ConflictException(`Router with serial number "${trimmedSerial}" already exists`);
    }

    const condition: RouterPhysicalCondition = dto.physicalCondition ?? 'SERVICEABLE';

    const run = async (tx: NodePgDatabase<typeof schema>) => {
      // Product lock precedes warehouse locks, matching generic inventory writes.
      const product = await this.repo.products.findByIdForUpdate(dto.productId, tx);
      if (!product) {
        throw new NotFoundException(`Product with ID "${dto.productId}" was not found`);
      }
      if (!product.isSerialized) await this.repo.products.markSerialized(dto.productId, tx);
      // Lock warehouse row to serialize concurrent placement/deactivation
      const warehouse = await this.repo.warehouses.findByIdForUpdate(dto.warehouseId, tx);
      if (!warehouse) {
        throw new NotFoundException(`Warehouse with ID "${dto.warehouseId}" was not found`);
      }
      if (!warehouse.isActive) {
        throw new BadRequestException(
          'Cannot place or register routers in a deactivated warehouse',
        );
      }

      // 1. If registering existing stock (!isNewReceipt), enforce audited registration capacity
      if (!dto.isNewReceipt) {
        // Lock inventory row to serialize concurrent onboarding and prevent over-registration
        const inventory = await this.repo.inventory.getStockForUpdate(
          dto.warehouseId,
          dto.productId,
          tx,
        );
        const currentStock = inventory?.quantity ?? 0;

        {
          if (currentStock <= 0) {
            throw new ConflictException(
              `Cannot onboard router into existing stock: warehouse "${warehouse.name}" has 0 recorded stock for product "${product.name}". Use a new receipt (isNewReceipt: true) to receive new inventory.`,
            );
          }

          const registeredCount = await this.repo.routers.countRegisteredUsableInWarehouse(
            dto.warehouseId,
            dto.productId,
            tx,
          );

          const availableCapacity = currentStock - registeredCount;
          if (availableCapacity <= 0) {
            throw new ConflictException(
              `Cannot onboard router into existing stock: all ${currentStock} recorded units for product "${product.name}" in warehouse "${warehouse.name}" already have registered serial numbers.`,
            );
          }
        }
      }

      // 2. Insert Router row
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

      // 3. Initial custody row (WAREHOUSE) only if in serviceable warehouse state
      if (condition === 'SERVICEABLE') {
        await this.repo.routers.createAssignment(
          {
            routerId: router.id,
            holderType: 'WAREHOUSE',
            warehouseId: dto.warehouseId,
            assignedBy: responsibleUserId,
            notes: dto.isNewReceipt
              ? 'New inbound shipment receipt'
              : 'Existing stock serial onboarding',
          },
          tx,
        );
      }

      // 4. Handle stock delta:
      // Case A: New inbound receipt of serviceable router -> +1 stock
      if (dto.isNewReceipt && condition === 'SERVICEABLE') {
        await this.repo.inventory.recordMovementWithDelta(
          {
            warehouseId: dto.warehouseId,
            productId: dto.productId,
            movementType: 'INBOUND_SUPPLIER',
            quantity: 1,
            responsibleUserId,
            notes: `Router receipt serial ${trimmedSerial}`,
          },
          1,
          tx,
        );
      }

      // Case B: Damaged opening unit reconciliation -> -1 stock (with explicit audit evidence)
      if (!dto.isNewReceipt && condition !== 'SERVICEABLE') {
        await this.repo.inventory.recordMovementWithDelta(
          {
            warehouseId: dto.warehouseId,
            productId: dto.productId,
            movementType: 'ADJUSTMENT',
            quantity: 1,
            responsibleUserId,
            notes: `Explicit reconciliation: opening stock unit registered as ${condition} (serial: ${trimmedSerial})`,
          },
          -1,
          tx,
        );

        await this.repo.routers.createConditionHistory(
          {
            routerId: router.id,
            fromCondition: 'SERVICEABLE',
            toCondition: condition,
            fromWarehouseId: dto.warehouseId,
            toWarehouseId: dto.warehouseId,
            externalLocation: null,
            reason:
              dto.notes ?? `Initial onboarding inspection identified opening unit as ${condition}`,
            changedBy: responsibleUserId,
          },
          tx,
        );
      }

      return this.mapToDto(router, null);
    };

    try {
      return await (externalTx ? run(externalTx) : this.repo.transaction(run));
    } catch (err: unknown) {
      const dbError = err as { code?: string; cause?: { code?: string }; message?: string };
      if (
        dbError?.code === '23505' ||
        dbError?.cause?.code === '23505' ||
        dbError?.message?.includes('duplicate key value violates unique constraint')
      ) {
        throw new ConflictException(
          `A router with serial number "${trimmedSerial}" already exists`,
        );
      }
      throw err;
    }
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

  async assign(
    id: string,
    dto: AssignRouterDto,
    responsibleUserId: string,
    externalTx?: NodePgDatabase<typeof schema>,
  ): Promise<RouterDto> {
    const run = async (tx: NodePgDatabase<typeof schema>) => {
      // 1. Lock router row first to serialize competing assignments
      const router = await this.repo.routers.findByIdForUpdate(id, tx);
      if (!router) {
        throw new NotFoundException(`Router with ID "${id}" was not found`);
      }

      // 2. Validate state inside the protected operation
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

      // Lock warehouse row to serialize against warehouse deactivation
      await this.repo.warehouses.findByIdForUpdate(warehouseId, tx);

      // 3. Release active warehouse custody
      await this.repo.routers.releaseActiveAssignment(id, new Date(), tx);

      // 4. Open technician custody
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

      // 5. Update router status
      const updatedRouter = await this.repo.routers.updateRouter(
        id,
        {
          status: 'ASSIGNED_TO_TECHNICIAN',
          warehouseId: null,
          externalLocation: null,
        },
        tx,
      );

      // 6. Decrement usable warehouse quantity with atomic delta
      await this.repo.inventory.recordMovementWithDelta(
        {
          warehouseId,
          productId: router.productId,
          movementType: 'OUTBOUND_TECHNICIAN',
          quantity: 1,
          technicianId: dto.technicianId,
          responsibleUserId,
          notes: `Router assignment serial ${router.serialNumber}`,
        },
        -1,
        tx,
      );

      return this.mapToDto(updatedRouter!, assignment);
    };

    return externalTx ? run(externalTx) : this.repo.transaction(run);
  }

  async transition(
    id: string,
    dto: TransitionRouterDto,
    responsibleUserId: string,
    externalTx?: NodePgDatabase<typeof schema>,
  ): Promise<RouterDto> {
    if (!dto.reason || typeof dto.reason !== 'string' || dto.reason.trim().length === 0) {
      throw new BadRequestException('A non-empty reason is required for lifecycle transitions');
    }
    const trimmedReason = dto.reason.trim();

    const run = async (tx: NodePgDatabase<typeof schema>) => {
      const router = await this.repo.routers.findByIdForUpdate(id, tx);
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
      } else if (dto.status === 'INSTALLED_AT_CUSTOMER') {
        // Customer identity and target validation are deferred to a later milestone.
        throw new BadRequestException(
          'Customer installation is unavailable until customer custody targets are supported',
        );
      } else if (dto.status === 'RETURNED') {
        if (router.status === 'INSTALLED_AT_CUSTOMER' && !dto.targetWarehouseId) {
          throw new BadRequestException(
            'A target warehouse ID is required when returning a router from customer installation',
          );
        }

        // Close technician or customer custody
        await this.repo.routers.releaseActiveAssignment(id, new Date(), tx);
        if (dto.targetWarehouseId) {
          newWarehouseId = dto.targetWarehouseId;
        }

        // Validate and lock destination warehouse
        if (newWarehouseId) {
          const targetWh = await this.repo.warehouses.findByIdForUpdate(newWarehouseId, tx);
          if (!targetWh) {
            throw new NotFoundException(`Warehouse with ID "${newWarehouseId}" was not found`);
          }
          if (!targetWh.isActive) {
            throw new BadRequestException('Cannot return router to a deactivated warehouse');
          }
        }
      } else if (dto.status === 'AVAILABLE') {
        // Returned router inspected and marked AVAILABLE
        if (dto.targetWarehouseId) newWarehouseId = dto.targetWarehouseId;
        if (!newWarehouseId) {
          throw new BadRequestException(
            'A target warehouse ID is required when making a router AVAILABLE',
          );
        }

        // Validate and lock destination warehouse
        const targetWh = await this.repo.warehouses.findByIdForUpdate(newWarehouseId, tx);
        if (!targetWh) {
          throw new NotFoundException(`Warehouse with ID "${newWarehouseId}" was not found`);
        }
        if (!targetWh.isActive) {
          throw new BadRequestException('Cannot place router in a deactivated warehouse');
        }

        // Unserviceable routers have neither usable stock nor warehouse custody.
        if (router.physicalCondition === 'SERVICEABLE') {
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
          await this.repo.inventory.recordMovementWithDelta(
            {
              warehouseId: newWarehouseId,
              productId: router.productId,
              movementType: 'RETURN_TECHNICIAN',
              quantity: 1,
              responsibleUserId,
              notes: `Router returned to inventory: ${router.serialNumber}`,
            },
            1,
            tx,
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

      // Record lifecycle status transition audit trail atomically
      await this.repo.routers.createStatusHistory(
        {
          routerId: id,
          fromStatus: router.status,
          toStatus: dto.status,
          reason: trimmedReason,
          changedBy: responsibleUserId,
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
    externalTx?: NodePgDatabase<typeof schema>,
  ): Promise<RouterDto> {
    const run = async (tx: NodePgDatabase<typeof schema>) => {
      const router = await this.repo.routers.findByIdForUpdate(id, tx);
      if (!router) {
        throw new NotFoundException(`Router with ID "${id}" was not found`);
      }

      if (router.status === 'LOST' || router.status === 'DECOMMISSIONED') {
        throw new BadRequestException(
          `Cannot update condition or location of a router with terminal status "${router.status}"`,
        );
      }

      // Explicit location resolution:
      // 1. External placement clears warehouse placement.
      // 2. Explicit warehouse target moves router to that warehouse and clears externalLocation.
      // 3. Otherwise, retain existing placement.
      let newWarehouseId: string | null = router.warehouseId;
      let newExternalLocation: string | null = router.externalLocation;

      if (
        dto.externalLocation !== undefined &&
        dto.externalLocation !== null &&
        dto.externalLocation.trim() !== ''
      ) {
        newWarehouseId = null;
        newExternalLocation = dto.externalLocation.trim();
      } else if (dto.warehouseId !== undefined) {
        newWarehouseId = dto.warehouseId;
        newExternalLocation = null;
      }

      // Lock all involved warehouses in deterministic order to prevent deadlocks
      const warehouseIdsToLock = Array.from(
        new Set([router.warehouseId, newWarehouseId].filter(Boolean) as string[]),
      ).sort();

      for (const whId of warehouseIdsToLock) {
        const wh = await this.repo.warehouses.findByIdForUpdate(whId, tx);
        if (!wh) {
          throw new NotFoundException(`Warehouse with ID "${whId}" was not found`);
        }
        if (whId === newWarehouseId && !wh.isActive) {
          throw new BadRequestException('Cannot place router in a deactivated warehouse');
        }
      }

      // Usable contribution rule (Contract §5.1):
      // A serialized router contributes exactly one usable unit to warehouse W iff:
      // 1. Lifecycle is AVAILABLE
      // 2. Physical condition is SERVICEABLE
      // 3. Physical location is warehouse W
      // All other states contribute zero.
      const oldUsableWarehouseId: string | null =
        router.status === 'AVAILABLE' &&
        router.physicalCondition === 'SERVICEABLE' &&
        Boolean(router.warehouseId)
          ? router.warehouseId
          : null;

      const newUsableWarehouseId: string | null =
        router.status === 'AVAILABLE' &&
        dto.physicalCondition === 'SERVICEABLE' &&
        Boolean(newWarehouseId)
          ? newWarehouseId
          : null;

      // Record condition and location audit history
      await this.repo.routers.createConditionHistory(
        {
          routerId: id,
          fromCondition: router.physicalCondition,
          toCondition: dto.physicalCondition,
          fromWarehouseId: router.warehouseId,
          toWarehouseId: newWarehouseId,
          externalLocation: newExternalLocation,
          reason: dto.reason,
          changedBy: responsibleUserId,
        },
        tx,
      );

      // Apply deltas and custody changes atomically based on usable contribution transition
      if (oldUsableWarehouseId !== newUsableWarehouseId) {
        // Case 1: Inter-warehouse move between eligible warehouses (A -> B)
        if (oldUsableWarehouseId && newUsableWarehouseId) {
          // Decrement source warehouse stock
          await this.repo.inventory.recordMovementWithDelta(
            {
              warehouseId: oldUsableWarehouseId,
              productId: router.productId,
              movementType: 'TRANSFER_WAREHOUSE',
              quantity: 1,
              responsibleUserId,
              notes: `Inter-warehouse transfer: ${router.serialNumber} (${dto.reason})`,
            },
            -1,
            tx,
          );

          // Increment destination warehouse stock
          await this.repo.inventory.recordMovementWithDelta(
            {
              warehouseId: newUsableWarehouseId,
              productId: router.productId,
              movementType: 'TRANSFER_WAREHOUSE',
              quantity: 1,
              responsibleUserId,
              notes: `Inter-warehouse transfer: ${router.serialNumber} (${dto.reason})`,
            },
            1,
            tx,
          );

          // Move custody once: release old warehouse assignment, open new warehouse assignment
          await this.repo.routers.releaseActiveAssignment(id, new Date(), tx);
          await this.repo.routers.createAssignment(
            {
              routerId: id,
              holderType: 'WAREHOUSE',
              warehouseId: newUsableWarehouseId,
              assignedBy: responsibleUserId,
              notes: dto.reason ?? 'Transferred to warehouse custody',
            },
            tx,
          );
        }
        // Case 2: Usable contribution removed (SERVICEABLE -> DAMAGED or UNDER_REPAIR, or sent external)
        else if (oldUsableWarehouseId && !newUsableWarehouseId) {
          await this.repo.inventory.recordMovementWithDelta(
            {
              warehouseId: oldUsableWarehouseId,
              productId: router.productId,
              movementType: 'ADJUSTMENT',
              quantity: 1,
              responsibleUserId,
              notes: `Router no longer usable (${dto.physicalCondition}): ${router.serialNumber} (${dto.reason})`,
            },
            -1,
            tx,
          );

          // Close active custody; custody becomes empty
          await this.repo.routers.releaseActiveAssignment(id, new Date(), tx);
        }
        // Case 3: Restoring serviceability into warehouse stock (DAMAGED / UNDER_REPAIR -> SERVICEABLE)
        else if (!oldUsableWarehouseId && newUsableWarehouseId) {
          await this.repo.inventory.recordMovementWithDelta(
            {
              warehouseId: newUsableWarehouseId,
              productId: router.productId,
              movementType: 'ADJUSTMENT',
              quantity: 1,
              responsibleUserId,
              notes: `Router restored to serviceable stock: ${router.serialNumber} (${dto.reason})`,
            },
            1,
            tx,
          );

          // Restore warehouse custody
          await this.repo.routers.createAssignment(
            {
              routerId: id,
              holderType: 'WAREHOUSE',
              warehouseId: newUsableWarehouseId,
              assignedBy: responsibleUserId,
              notes: dto.reason ?? 'Restored to warehouse custody',
            },
            tx,
          );
        }
      } else {
        // If neither was usable, but router is sent to external repair, ensure active custody is closed
        if (!newUsableWarehouseId && dto.externalLocation) {
          await this.repo.routers.releaseActiveAssignment(id, new Date(), tx);
        }
      }

      const updated = await this.repo.routers.updateRouter(
        id,
        {
          physicalCondition: dto.physicalCondition,
          warehouseId: newWarehouseId,
          externalLocation: newExternalLocation,
        },
        tx,
      );

      const activeCustody = await this.repo.routers.findActiveAssignment(id, tx);
      return this.mapToDto(updated!, activeCustody ?? null);
    };

    return externalTx ? run(externalTx) : this.repo.transaction(run);
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

  async getStatusHistory(routerId: string): Promise<RouterStatusHistoryDto[]> {
    const router = await this.repo.routers.findById(routerId);
    if (!router) {
      throw new NotFoundException(`Router with ID "${routerId}" was not found`);
    }
    const history = await this.repo.routers.findStatusHistory(routerId);
    return history.map((h) => ({
      id: h.id,
      routerId: h.routerId,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
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
