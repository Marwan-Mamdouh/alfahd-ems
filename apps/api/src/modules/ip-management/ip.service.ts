import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isIP } from 'class-validator';
import type { IpAddressDto, IpHistoryDto, IpImportResultDto } from '@alfahd/types';
import * as schema from '../../database/schema/index.js';
import { RepositoryService } from '../repository/repository.service.js';
import type { CreateIpDto, UpdateIpDto, IpQueryDto } from './dto/index.js';

@Injectable()
export class IpService {
  constructor(private readonly repo: RepositoryService) {}

  async create(dto: CreateIpDto, actorId: string): Promise<IpAddressDto> {
    const trimmedAddress = dto.address.trim();

    // Strict IPv4 validation (reject CIDR, range, or IPv6)
    if (!isIP(trimmedAddress, '4') || trimmedAddress.includes('/')) {
      throw new BadRequestException(
        'Address must be a valid individual IPv4 host address (no CIDR ranges or IPv6)',
      );
    }

    const existing = await this.repo.ip.findByAddress(trimmedAddress);
    if (existing) {
      throw new ConflictException(`IP address "${trimmedAddress}" already exists`);
    }

    return this.repo.transaction(async (tx) => {
      const created = await this.repo.ip.createIp(
        {
          address: trimmedAddress,
          status: 'FREE',
          isArchived: false,
          notes: dto.notes,
        },
        tx,
      );

      await this.repo.ip.createHistory(
        {
          ipId: created.id,
          fromStatus: 'FREE',
          toStatus: 'FREE',
          action: 'CREATE',
          reason: 'Initial creation',
          actorId,
        },
        tx,
      );

      return this.mapToDto(created);
    });
  }

  async findById(id: string): Promise<IpAddressDto> {
    const ip = await this.repo.ip.findById(id);
    if (!ip) {
      throw new NotFoundException(`IP address with ID "${id}" was not found`);
    }
    return this.mapToDto(ip);
  }

  async findAll(query: IpQueryDto): Promise<{ items: IpAddressDto[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const { items, total } = await this.repo.ip.findManyWithPagination({
      status: query.status,
      isArchived: query.isArchived,
      search: query.search,
      limit,
      offset,
    });

    return {
      items: items.map((ip) => this.mapToDto(ip)),
      total,
    };
  }

  async update(id: string, dto: UpdateIpDto, actorId: string): Promise<IpAddressDto> {
    const existing = await this.repo.ip.findById(id);
    if (!existing) {
      throw new NotFoundException(`IP address with ID "${id}" was not found`);
    }

    const updated = await this.repo.ip.updateIp(id, { notes: dto.notes });

    await this.repo.ip.createHistory({
      ipId: id,
      fromStatus: existing.status,
      toStatus: existing.status,
      action: 'UPDATE_METADATA',
      reason: 'Updated notes',
      actorId,
    });

    return this.mapToDto(updated!);
  }

  async reserve(id: string, reason: string | undefined, actorId: string): Promise<IpAddressDto> {
    return this.repo.transaction(async (tx) => {
      const existing = await this.repo.ip.findById(id, tx);
      if (!existing) {
        throw new NotFoundException(`IP address with ID "${id}" was not found`);
      }

      if (existing.isArchived) {
        throw new BadRequestException('Cannot reserve an archived IP address');
      }

      if (existing.status === 'RESERVED') {
        throw new ConflictException(`IP address "${existing.address}" is already reserved`);
      }

      const updated = await this.repo.ip.updateIp(id, { status: 'RESERVED' }, tx);

      await this.repo.ip.createHistory(
        {
          ipId: id,
          fromStatus: 'FREE',
          toStatus: 'RESERVED',
          action: 'RESERVE',
          reason: reason ?? 'Manual admin reservation',
          actorId,
        },
        tx,
      );

      return this.mapToDto(updated!);
    });
  }

  async release(id: string, reason: string | undefined, actorId: string): Promise<IpAddressDto> {
    return this.repo.transaction(async (tx) => {
      const existing = await this.repo.ip.findById(id, tx);
      if (!existing) {
        throw new NotFoundException(`IP address with ID "${id}" was not found`);
      }

      if (existing.status === 'FREE') {
        throw new ConflictException(`IP address "${existing.address}" is already free`);
      }

      const updated = await this.repo.ip.updateIp(
        id,
        {
          status: 'FREE',
          customerId: null,
        },
        tx,
      );

      await this.repo.ip.createHistory(
        {
          ipId: id,
          fromStatus: 'RESERVED',
          toStatus: 'FREE',
          action: 'RELEASE',
          reason: reason ?? 'Manual admin release',
          actorId,
        },
        tx,
      );

      return this.mapToDto(updated!);
    });
  }

  async archive(id: string, reason: string | undefined, actorId: string): Promise<IpAddressDto> {
    return this.repo.transaction(async (tx) => {
      const existing = await this.repo.ip.findById(id, tx);
      if (!existing) {
        throw new NotFoundException(`IP address with ID "${id}" was not found`);
      }

      if (existing.status === 'RESERVED') {
        throw new ConflictException(
          `Cannot archive a RESERVED IP address (${existing.address}). Release it first.`,
        );
      }

      if (existing.isArchived) {
        return this.mapToDto(existing);
      }

      const updated = await this.repo.ip.updateIp(id, { isArchived: true }, tx);

      await this.repo.ip.createHistory(
        {
          ipId: id,
          fromStatus: existing.status,
          toStatus: existing.status,
          action: 'ARCHIVE',
          reason: reason ?? 'Archived by admin',
          actorId,
        },
        tx,
      );

      return this.mapToDto(updated!);
    });
  }

  async unarchive(id: string, reason: string | undefined, actorId: string): Promise<IpAddressDto> {
    return this.repo.transaction(async (tx) => {
      const existing = await this.repo.ip.findById(id, tx);
      if (!existing) {
        throw new NotFoundException(`IP address with ID "${id}" was not found`);
      }

      if (!existing.isArchived) {
        return this.mapToDto(existing);
      }

      const updated = await this.repo.ip.updateIp(id, { isArchived: false }, tx);

      await this.repo.ip.createHistory(
        {
          ipId: id,
          fromStatus: existing.status,
          toStatus: existing.status,
          action: 'UNARCHIVE',
          reason: reason ?? 'Restored by admin',
          actorId,
        },
        tx,
      );

      return this.mapToDto(updated!);
    });
  }

  async getHistory(ipId: string): Promise<IpHistoryDto[]> {
    const existing = await this.repo.ip.findById(ipId);
    if (!existing) {
      throw new NotFoundException(`IP address with ID "${ipId}" was not found`);
    }

    const history = await this.repo.ip.findHistoryByIp(ipId);
    return history.map((h) => ({
      id: h.id,
      ipId: h.ipId,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      action: h.action,
      reason: h.reason,
      actorId: h.actorId,
      createdAt: h.createdAt.toISOString(),
    }));
  }

  async importCsv(csvContent: string, actorId: string): Promise<IpImportResultDto> {
    const lines = csvContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length <= 1) {
      return { total: 0, inserted: 0, skipped: 0, errors: [] };
    }

    // Header check
    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const addressColIndex = headers.indexOf('address');

    if (addressColIndex === -1) {
      throw new BadRequestException('CSV must contain an "address" column header');
    }

    const notesColIndex = headers.indexOf('notes');

    const result: IpImportResultDto = {
      total: lines.length - 1,
      inserted: 0,
      skipped: 0,
      errors: [],
    };

    const seenInFile = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const rowNum = i + 1; // 1-based index (with header)
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      const rawAddress = parts[addressColIndex];
      const rawNotes = notesColIndex !== -1 ? parts[notesColIndex] : undefined;

      if (!rawAddress) {
        result.errors.push({
          row: rowNum,
          address: '',
          reason: 'Empty address field',
        });
        continue;
      }

      if (!isIP(rawAddress, '4') || rawAddress.includes('/')) {
        result.errors.push({
          row: rowNum,
          address: rawAddress,
          reason: 'Invalid IPv4 host address format (no CIDR or IPv6 allowed)',
        });
        continue;
      }

      if (seenInFile.has(rawAddress)) {
        result.skipped += 1;
        continue;
      }
      seenInFile.add(rawAddress);

      // Check if already in DB
      const existing = await this.repo.ip.findByAddress(rawAddress);
      if (existing) {
        result.skipped += 1;
        continue;
      }

      try {
        await this.repo.transaction(async (tx) => {
          const created = await this.repo.ip.createIp(
            {
              address: rawAddress,
              status: 'FREE',
              isArchived: false,
              notes: rawNotes,
            },
            tx,
          );

          await this.repo.ip.createHistory(
            {
              ipId: created.id,
              fromStatus: 'FREE',
              toStatus: 'FREE',
              action: 'CREATE',
              reason: 'Bulk CSV import',
              actorId,
            },
            tx,
          );
        });

        result.inserted += 1;
      } catch (err: any) {
        result.errors.push({
          row: rowNum,
          address: rawAddress,
          reason: err.message ?? 'Database insertion error',
        });
      }
    }

    return result;
  }

  private mapToDto(ip: schema.IpAddress): IpAddressDto {
    return {
      id: ip.id,
      address: ip.address,
      status: ip.status,
      isArchived: ip.isArchived,
      customerId: ip.customerId,
      notes: ip.notes,
      createdAt: ip.createdAt.toISOString(),
      updatedAt: ip.updatedAt.toISOString(),
    };
  }
}
