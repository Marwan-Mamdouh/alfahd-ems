import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { RepositoryService } from '../repository/repository.service.js';
import type { Warehouse } from '../../entities/warehouses.entity.js';
import type { CreateWarehouseDto, UpdateWarehouseDto, QueryWarehousesDto } from './dto/index.js';

@Injectable()
export class WarehousesService {
  constructor(private readonly repo: RepositoryService) {}

  async createWarehouse(dto: CreateWarehouseDto): Promise<Warehouse> {
    const trimmedName = dto.name.trim();

    const existing = await this.repo.warehouses.findByName(trimmedName);
    if (existing) {
      throw new ConflictException(`Warehouse with name "${trimmedName}" already exists`);
    }

    return this.repo.warehouses.create({
      name: trimmedName,
      address: dto.address.trim(),
      latitude: dto.latitude,
      longitude: dto.longitude,
      geofenceRadiusMeters: dto.geofenceRadiusMeters ?? 150,
      managerId: dto.managerId ?? null,
    });
  }

  async findAll(query: QueryWarehousesDto): Promise<{ items: Warehouse[]; total: number }> {
    return this.repo.warehouses.findManyWithPagination({
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });
  }

  async findById(id: string): Promise<Warehouse> {
    const warehouse = await this.repo.warehouses.findById(id);
    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID "${id}" was not found`);
    }
    return warehouse;
  }

  async update(id: string, dto: UpdateWarehouseDto): Promise<Warehouse> {
    const existing = await this.repo.warehouses.findById(id);
    if (!existing) {
      throw new NotFoundException(`Warehouse with ID "${id}" was not found`);
    }

    const updates: Partial<Warehouse> = {};

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      if (trimmedName !== existing.name) {
        const nameConflict = await this.repo.warehouses.findByName(trimmedName);
        if (nameConflict && nameConflict.id !== id) {
          throw new ConflictException(`Warehouse name "${trimmedName}" is already taken`);
        }
        updates.name = trimmedName;
      }
    }

    if (dto.address !== undefined) updates.address = dto.address.trim();
    if (dto.latitude !== undefined) updates.latitude = dto.latitude;
    if (dto.longitude !== undefined) updates.longitude = dto.longitude;
    if (dto.geofenceRadiusMeters !== undefined) {
      updates.geofenceRadiusMeters = dto.geofenceRadiusMeters;
    }
    if (dto.managerId !== undefined) updates.managerId = dto.managerId;

    const updated = await this.repo.warehouses.updateWarehouse(id, updates);
    if (!updated) {
      throw new NotFoundException(`Warehouse with ID "${id}" was not found`);
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.repo.warehouses.findById(id);
    if (!existing) {
      throw new NotFoundException(`Warehouse with ID "${id}" was not found`);
    }

    const { canDelete, reason } = await this.repo.warehouses.canDeleteWarehouse(id);
    if (!canDelete) {
      throw new ConflictException(
        reason ?? 'Cannot delete warehouse due to active inventory or staff',
      );
    }

    await this.repo.warehouses.deleteById(id);
  }
}
