import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { isIP } from 'class-validator';
import type { IpAddressDto, IpHistoryDto, IpImportResultDto } from '@alfahd/types';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index.js';
import { RepositoryService } from '../repository/repository.service.js';
import type { CreateIpDto, UpdateIpDto, IpQueryDto } from './dto/index.js';

@Injectable()
export class IpService {
  private readonly logger = new Logger(IpService.name);
  constructor(
    private readonly repo: RepositoryService,
    @Optional() @InjectQueue('ip-imports') private readonly ipImportsQueue?: Queue,
  ) {}

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
          metadataBefore: null,
          metadataAfter: { notes: created.notes },
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

  async update(
    id: string,
    dto: UpdateIpDto,
    actorId: string,
    externalTx?: NodePgDatabase<typeof schema>,
  ): Promise<IpAddressDto> {
    const run = async (tx: NodePgDatabase<typeof schema>) => {
      const existing = await this.repo.ip.findByIdForUpdate(id, tx);
      if (!existing) {
        throw new NotFoundException(`IP address with ID "${id}" was not found`);
      }

      const normalizedDtoNotes = dto.notes !== undefined ? dto.notes.trim() || null : undefined;
      const normalizedExistingNotes =
        existing.notes !== null ? existing.notes.trim() || null : null;

      if (normalizedDtoNotes !== undefined && normalizedDtoNotes !== normalizedExistingNotes) {
        const updated = await this.repo.ip.updateIp(id, { notes: normalizedDtoNotes }, tx);

        let reason: string;
        if (existing.notes === null) {
          reason = `Set notes to "${normalizedDtoNotes}"`;
        } else if (normalizedDtoNotes === null) {
          reason = `Cleared notes (was "${existing.notes}")`;
        } else {
          reason = `Updated notes from "${existing.notes}" to "${normalizedDtoNotes}"`;
        }

        await this.repo.ip.createHistory(
          {
            ipId: id,
            fromStatus: existing.status,
            toStatus: existing.status,
            action: 'UPDATE_METADATA',
            reason,
            metadataBefore: { notes: existing.notes },
            metadataAfter: { notes: normalizedDtoNotes },
            actorId,
          },
          tx,
        );

        return this.mapToDto(updated!);
      }

      return this.mapToDto(existing);
    };

    return externalTx ? run(externalTx) : this.repo.transaction(run);
  }

  async reserve(
    id: string,
    reason: string | undefined,
    actorId: string,
    externalTx?: NodePgDatabase<typeof schema>,
  ): Promise<IpAddressDto> {
    const run = async (tx: NodePgDatabase<typeof schema>) => {
      const existing = await this.repo.ip.findByIdForUpdate(id, tx);
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
    };

    return externalTx ? run(externalTx) : this.repo.transaction(run);
  }

  async release(
    id: string,
    reason: string | undefined,
    actorId: string,
    externalTx?: NodePgDatabase<typeof schema>,
  ): Promise<IpAddressDto> {
    const run = async (tx: NodePgDatabase<typeof schema>) => {
      const existing = await this.repo.ip.findByIdForUpdate(id, tx);
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
    };

    return externalTx ? run(externalTx) : this.repo.transaction(run);
  }

  async archive(
    id: string,
    reason: string | undefined,
    actorId: string,
    externalTx?: NodePgDatabase<typeof schema>,
  ): Promise<IpAddressDto> {
    const run = async (tx: NodePgDatabase<typeof schema>) => {
      const existing = await this.repo.ip.findByIdForUpdate(id, tx);
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
    };

    return externalTx ? run(externalTx) : this.repo.transaction(run);
  }

  async unarchive(
    id: string,
    reason: string | undefined,
    actorId: string,
    externalTx?: NodePgDatabase<typeof schema>,
  ): Promise<IpAddressDto> {
    const run = async (tx: NodePgDatabase<typeof schema>) => {
      const existing = await this.repo.ip.findByIdForUpdate(id, tx);
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
    };

    return externalTx ? run(externalTx) : this.repo.transaction(run);
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
      metadataBefore: (h.metadataBefore as Record<string, unknown> | null) ?? null,
      metadataAfter: (h.metadataAfter as Record<string, unknown> | null) ?? null,
      actorId: h.actorId,
      createdAt: h.createdAt.toISOString(),
    }));
  }

  async enqueueImportCsv(
    fileBuffer: Buffer | undefined,
    actorId: string,
  ): Promise<{ jobId: string }> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('A non-empty CSV file is required');
    }

    if (fileBuffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException('CSV file exceeds maximum size limit of 5MB');
    }

    const text = fileBuffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length <= 1) {
      throw new BadRequestException('CSV must contain a header and at least one data row');
    }

    if (lines.length - 1 > 5000) {
      throw new BadRequestException('CSV exceeds maximum limit of 5,000 rows');
    }

    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    if (!headers.includes('address')) {
      throw new BadRequestException('CSV must contain an "address" column header');
    }

    if (!this.ipImportsQueue) {
      throw new BadRequestException('Import queue is not configured');
    }

    const job = await this.ipImportsQueue.add(
      'ip-csv-import',
      {
        type: 'IP_CSV_IMPORT',
        csvContent: text,
        requestedBy: actorId,
      },
      {
        jobId: randomUUID(),
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    return { jobId: String(job.id) };
  }

  async processImportJob(
    csvContent: string,
    actorId: string,
    jobId: string,
  ): Promise<IpImportResultDto> {
    const clean = csvContent.replace(/^\uFEFF/, '');
    const lines = clean.split(/\r?\n/).map((line) => line.trim());
    while (lines.length > 0 && !lines[lines.length - 1]) lines.pop();

    const headerIndex = lines.findIndex((line) => line.length > 0);
    if (headerIndex < 0 || lines.slice(headerIndex + 1).every((line) => !line)) {
      return { total: 0, inserted: 0, skipped: 0, errors: [] };
    }

    // Header check
    const headerLine = lines[headerIndex].toLowerCase();
    const headers = headerLine.split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const addressColIndex = headers.indexOf('address');

    if (addressColIndex === -1) {
      throw new BadRequestException('CSV must contain an "address" column header');
    }

    const notesColIndex = headers.indexOf('notes');

    const result: IpImportResultDto = {
      total: lines.slice(headerIndex + 1).filter(Boolean).length,
      inserted: 0,
      skipped: 0,
      errors: [],
    };

    const seenInFile = new Set<string>();

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const rowNum = i + 1; // 1-based index (with header)
      if (!lines[i]) {
        continue;
      }
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

      let outcome: { outcome: string; reason: string | null };
      try {
        outcome = await this.repo.transaction(async (tx) => {
          await this.repo.ip.lockImportJob(jobId, tx);
          const previous = await this.repo.ip.findImportOutcome(jobId, rowNum, tx);
          if (previous) return previous;
          const existing = await this.repo.ip.findByAddress(rawAddress, tx);
          if (existing) {
            const history = await this.repo.ip.findHistoryByIp(existing.id, tx);
            const value = history.some(
              (h) => h.action === 'CREATE' && h.reason === `Bulk CSV import (job:${jobId})`,
            )
              ? 'inserted'
              : 'skipped';
            await this.repo.ip.recordImportOutcome(jobId, rowNum, value, null, tx);
            return { outcome: value, reason: null };
          }
          const created = await this.repo.ip.createIpOnConflictDoNothing(
            {
              address: rawAddress,
              status: 'FREE',
              isArchived: false,
              notes: rawNotes,
            },
            tx,
          );

          if (!created) {
            // Concurrent duplicate insertion conflict handled safely by ON CONFLICT DO NOTHING
            await this.repo.ip.recordImportOutcome(jobId, rowNum, 'skipped', null, tx);
            return { outcome: 'skipped', reason: null };
          }

          await this.repo.ip.createHistory(
            {
              ipId: created.id,
              fromStatus: 'FREE',
              toStatus: 'FREE',
              action: 'CREATE',
              reason: `Bulk CSV import (job:${jobId})`,
              metadataBefore: null,
              metadataAfter: { notes: created.notes },
              actorId,
            },
            tx,
          );

          await this.repo.ip.recordImportOutcome(jobId, rowNum, 'inserted', null, tx);
          return { outcome: 'inserted', reason: null };
        });
      } catch (err: unknown) {
        this.logger.error(
          `IP import job ${jobId}, row ${rowNum} failed`,
          err instanceof Error ? err.stack : String(err),
        );
        outcome = await this.repo.transaction(async (tx) => {
          await this.repo.ip.lockImportJob(jobId, tx);
          const previous = await this.repo.ip.findImportOutcome(jobId, rowNum, tx);
          if (previous) return previous;
          await this.repo.ip.recordImportOutcome(
            jobId,
            rowNum,
            'error',
            'Unable to import row',
            tx,
          );
          return { outcome: 'error', reason: 'Unable to import row' };
        });
      }
      if (outcome.outcome === 'inserted') result.inserted += 1;
      else if (outcome.outcome === 'skipped') result.skipped += 1;
      else
        result.errors.push({
          row: rowNum,
          address: rawAddress,
          reason: outcome.reason ?? 'Unable to import row',
        });
    }

    return result;
  }

  async importCsv(csvContent: string, actorId: string): Promise<IpImportResultDto> {
    return this.processImportJob(csvContent, actorId, randomUUID());
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
