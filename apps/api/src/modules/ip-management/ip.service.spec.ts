import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { IpService } from './ip.service.js';
import { RepositoryService } from '../repository/repository.service.js';
import type { IpAddress, IpHistory } from '../../database/schema/index.js';

describe('IpService', () => {
  let service: IpService;

  const mockIp: IpAddress = {
    id: '11111111-1111-4111-8111-111111111111',
    address: '192.168.1.50',
    status: 'FREE',
    isArchived: false,
    customerId: null,
    notes: 'Static gateway IP',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockHistory: IpHistory = {
    id: '22222222-2222-4222-8222-222222222222',
    ipId: mockIp.id,
    fromStatus: 'FREE',
    toStatus: 'FREE',
    action: 'CREATE',
    reason: 'Initial creation',
    actorId: 'admin-id',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockIpRepo = {
    findByAddress: vi.fn(),
    findById: vi.fn(),
    findManyWithPagination: vi.fn(),
    createIp: vi.fn(),
    updateIp: vi.fn(),
    createHistory: vi.fn(),
    findHistoryByIp: vi.fn(),
  };

  const mockRepositoryService = {
    transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb({})),
    ip: mockIpRepo,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpService,
        {
          provide: RepositoryService,
          useValue: mockRepositoryService,
        },
      ],
    }).compile();

    service = module.get<IpService>(IpService);
  });

  describe('create', () => {
    it('creates a new FREE IPv4 address and logs CREATE history', async () => {
      mockIpRepo.findByAddress.mockResolvedValue(undefined);
      mockIpRepo.createIp.mockResolvedValue(mockIp);
      mockIpRepo.createHistory.mockResolvedValue(mockHistory);

      const result = await service.create(
        { address: '192.168.1.50', notes: 'Static gateway IP' },
        'admin-id',
      );

      expect(mockIpRepo.findByAddress).toHaveBeenCalledWith('192.168.1.50');
      expect(mockIpRepo.createIp).toHaveBeenCalledWith(
        {
          address: '192.168.1.50',
          status: 'FREE',
          isArchived: false,
          notes: 'Static gateway IP',
        },
        expect.anything(),
      );
      expect(mockIpRepo.createHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          fromStatus: 'FREE',
          toStatus: 'FREE',
          actorId: 'admin-id',
        }),
        expect.anything(),
      );
      expect(result.address).toBe('192.168.1.50');
      expect(result.status).toBe('FREE');
    });

    it('rejects CIDR subnet notations with 400 Bad Request', async () => {
      await expect(service.create({ address: '192.168.1.0/24' }, 'admin-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects IPv6 addresses with 400 Bad Request', async () => {
      await expect(service.create({ address: '2001:db8::1' }, 'admin-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects invalid host addresses with 400 Bad Request', async () => {
      await expect(service.create({ address: '999.999.999.999' }, 'admin-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException if IP address already exists', async () => {
      mockIpRepo.findByAddress.mockResolvedValue(mockIp);

      await expect(service.create({ address: '192.168.1.50' }, 'admin-id')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findById', () => {
    it('returns an IP address DTO when found', async () => {
      mockIpRepo.findById.mockResolvedValue(mockIp);

      const result = await service.findById(mockIp.id);

      expect(mockIpRepo.findById).toHaveBeenCalledWith(mockIp.id);
      expect(result.id).toBe(mockIp.id);
      expect(result.address).toBe(mockIp.address);
    });

    it('throws NotFoundException when IP is not found', async () => {
      mockIpRepo.findById.mockResolvedValue(undefined);

      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns paginated items and total count', async () => {
      mockIpRepo.findManyWithPagination.mockResolvedValue({
        items: [mockIp],
        total: 1,
      });

      const result = await service.findAll({ page: 1, limit: 10, status: 'FREE' });

      expect(mockIpRepo.findManyWithPagination).toHaveBeenCalledWith({
        status: 'FREE',
        isArchived: undefined,
        search: undefined,
        limit: 10,
        offset: 0,
      });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('update', () => {
    it('updates notes and logs UPDATE_METADATA history', async () => {
      mockIpRepo.findById.mockResolvedValue(mockIp);
      mockIpRepo.updateIp.mockResolvedValue({ ...mockIp, notes: 'Updated notes' });
      mockIpRepo.createHistory.mockResolvedValue(mockHistory);

      const result = await service.update(mockIp.id, { notes: 'Updated notes' }, 'admin-id');

      expect(mockIpRepo.updateIp).toHaveBeenCalledWith(mockIp.id, { notes: 'Updated notes' });
      expect(mockIpRepo.createHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_METADATA',
          actorId: 'admin-id',
        }),
      );
      expect(result.notes).toBe('Updated notes');
    });

    it('throws NotFoundException when updating non-existent IP', async () => {
      mockIpRepo.findById.mockResolvedValue(undefined);

      await expect(
        service.update('non-existent-id', { notes: 'test' }, 'admin-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reserve', () => {
    it('marks a FREE IP as RESERVED and records history', async () => {
      mockIpRepo.findById.mockResolvedValue(mockIp);
      mockIpRepo.updateIp.mockResolvedValue({ ...mockIp, status: 'RESERVED' });
      mockIpRepo.createHistory.mockResolvedValue(mockHistory);

      const result = await service.reserve(mockIp.id, 'Reserved for VIP', 'admin-id');

      expect(mockIpRepo.updateIp).toHaveBeenCalledWith(
        mockIp.id,
        { status: 'RESERVED' },
        expect.anything(),
      );
      expect(mockIpRepo.createHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RESERVE',
          fromStatus: 'FREE',
          toStatus: 'RESERVED',
          reason: 'Reserved for VIP',
        }),
        expect.anything(),
      );
      expect(result.status).toBe('RESERVED');
    });

    it('throws BadRequestException when reserving an archived IP', async () => {
      mockIpRepo.findById.mockResolvedValue({ ...mockIp, isArchived: true });

      await expect(service.reserve(mockIp.id, 'Reason', 'admin-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException when reserving an already RESERVED IP', async () => {
      mockIpRepo.findById.mockResolvedValue({ ...mockIp, status: 'RESERVED' });

      await expect(service.reserve(mockIp.id, 'Reason', 'admin-id')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('release', () => {
    it('releases a RESERVED IP back to FREE and resets customerId', async () => {
      const reservedIp: IpAddress = {
        ...mockIp,
        status: 'RESERVED',
        customerId: 'cust-123',
      };
      mockIpRepo.findById.mockResolvedValue(reservedIp);
      mockIpRepo.updateIp.mockResolvedValue({ ...reservedIp, status: 'FREE', customerId: null });
      mockIpRepo.createHistory.mockResolvedValue(mockHistory);

      const result = await service.release(mockIp.id, 'Client disconnected', 'admin-id');

      expect(mockIpRepo.updateIp).toHaveBeenCalledWith(
        mockIp.id,
        { status: 'FREE', customerId: null },
        expect.anything(),
      );
      expect(mockIpRepo.createHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RELEASE',
          fromStatus: 'RESERVED',
          toStatus: 'FREE',
        }),
        expect.anything(),
      );
      expect(result.status).toBe('FREE');
      expect(result.customerId).toBeNull();
    });

    it('throws ConflictException when releasing an already FREE IP', async () => {
      mockIpRepo.findById.mockResolvedValue(mockIp);

      await expect(service.release(mockIp.id, 'Reason', 'admin-id')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('archive', () => {
    it('archives a FREE IP and logs ARCHIVE history', async () => {
      mockIpRepo.findById.mockResolvedValue(mockIp);
      mockIpRepo.updateIp.mockResolvedValue({ ...mockIp, isArchived: true });
      mockIpRepo.createHistory.mockResolvedValue(mockHistory);

      const result = await service.archive(mockIp.id, 'Decommissioned pool', 'admin-id');

      expect(mockIpRepo.updateIp).toHaveBeenCalledWith(
        mockIp.id,
        { isArchived: true },
        expect.anything(),
      );
      expect(mockIpRepo.createHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ARCHIVE',
          reason: 'Decommissioned pool',
        }),
        expect.anything(),
      );
      expect(result.isArchived).toBe(true);
    });

    it('throws ConflictException when attempting to archive a RESERVED IP', async () => {
      mockIpRepo.findById.mockResolvedValue({ ...mockIp, status: 'RESERVED' });

      await expect(service.archive(mockIp.id, 'Reason', 'admin-id')).rejects.toThrow(
        ConflictException,
      );
    });

    it('is idempotent when IP is already archived', async () => {
      mockIpRepo.findById.mockResolvedValue({ ...mockIp, isArchived: true });

      const result = await service.archive(mockIp.id, 'Reason', 'admin-id');

      expect(mockIpRepo.updateIp).not.toHaveBeenCalled();
      expect(result.isArchived).toBe(true);
    });
  });

  describe('unarchive', () => {
    it('unarchives an archived IP and logs UNARCHIVE history', async () => {
      mockIpRepo.findById.mockResolvedValue({ ...mockIp, isArchived: true });
      mockIpRepo.updateIp.mockResolvedValue({ ...mockIp, isArchived: false });
      mockIpRepo.createHistory.mockResolvedValue(mockHistory);

      const result = await service.unarchive(mockIp.id, 'Restoring IP', 'admin-id');

      expect(mockIpRepo.updateIp).toHaveBeenCalledWith(
        mockIp.id,
        { isArchived: false },
        expect.anything(),
      );
      expect(mockIpRepo.createHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UNARCHIVE',
          reason: 'Restoring IP',
        }),
        expect.anything(),
      );
      expect(result.isArchived).toBe(false);
    });

    it('is idempotent when IP is not archived', async () => {
      mockIpRepo.findById.mockResolvedValue(mockIp);

      const result = await service.unarchive(mockIp.id, 'Reason', 'admin-id');

      expect(mockIpRepo.updateIp).not.toHaveBeenCalled();
      expect(result.isArchived).toBe(false);
    });
  });

  describe('getHistory', () => {
    it('returns history audit trail for an IP', async () => {
      mockIpRepo.findById.mockResolvedValue(mockIp);
      mockIpRepo.findHistoryByIp.mockResolvedValue([mockHistory]);

      const result = await service.getHistory(mockIp.id);

      expect(mockIpRepo.findHistoryByIp).toHaveBeenCalledWith(mockIp.id);
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('CREATE');
    });

    it('throws NotFoundException when IP does not exist', async () => {
      mockIpRepo.findById.mockResolvedValue(undefined);

      await expect(service.getHistory('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('importCsv', () => {
    it('throws BadRequestException if address column is missing from header', async () => {
      const csv = 'notes,something\nmy notes,test';

      await expect(service.importCsv(csv, 'admin-id')).rejects.toThrow(BadRequestException);
    });

    it('returns zeroes for empty content or header-only CSV', async () => {
      const result = await service.importCsv('address,notes', 'admin-id');

      expect(result).toEqual({ total: 0, inserted: 0, skipped: 0, errors: [] });
    });

    it('parses, deduplicates, and imports valid rows while tracking errors and skips', async () => {
      // row 1: valid new IP 10.0.0.1
      // row 2: invalid IP "not-an-ip"
      // row 3: duplicate in file "10.0.0.1"
      // row 4: existing IP in DB "10.0.0.2"
      // row 5: valid new IP 10.0.0.3
      const csv = `address,notes
10.0.0.1,First IP
not-an-ip,Invalid IP
10.0.0.1,Duplicate in file
10.0.0.2,Already in DB
10.0.0.3,Third IP`;

      mockIpRepo.findByAddress.mockImplementation(async (addr: string) => {
        if (addr === '10.0.0.2') return { id: 'existing', address: '10.0.0.2' };
        return undefined;
      });
      mockIpRepo.createIp.mockResolvedValue({ id: 'new-id' });
      mockIpRepo.createHistory.mockResolvedValue({});

      const outcome = await service.importCsv(csv, 'admin-id');

      expect(outcome.total).toBe(5);
      expect(outcome.inserted).toBe(2); // 10.0.0.1 and 10.0.0.3
      expect(outcome.skipped).toBe(2); // 10.0.0.1 (file dup) and 10.0.0.2 (db exists)
      expect(outcome.errors).toHaveLength(1);
      expect(outcome.errors[0]).toEqual({
        row: 3,
        address: 'not-an-ip',
        reason: 'Invalid IPv4 host address format (no CIDR or IPv6 allowed)',
      });
    });
  });
});
