import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { IpController } from './ip.controller.js';
import { IpService } from './ip.service.js';
import type { JwtUser } from '../../auth/strategies/jwt.strategy.js';
import type { CreateIpDto, UpdateIpDto, IpQueryDto } from './dto/index.js';
import type { IpAddressDto, IpHistoryDto, IpImportResultDto } from '@alfahd/types';

describe('IpController', () => {
  let controller: IpController;

  const mockUser: JwtUser = {
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'admin@alfahd.local',
    tokenId: 'token-123',
    role: 'ADMIN' as any,
  };

  const mockIp: IpAddressDto = {
    id: '22222222-2222-2222-2222-222222222222',
    address: '192.168.10.1',
    status: 'FREE',
    isArchived: false,
    customerId: null,
    notes: 'Subnet gateway',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const mockHistory: IpHistoryDto = {
    id: '33333333-3333-3333-3333-333333333333',
    ipId: mockIp.id,
    fromStatus: 'FREE',
    toStatus: 'RESERVED',
    action: 'RESERVE',
    reason: 'Reserved for test',
    actorId: mockUser.userId,
    createdAt: '2026-01-02T00:00:00.000Z',
  };

  const mockIpService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    reserve: vi.fn(),
    release: vi.fn(),
    archive: vi.fn(),
    unarchive: vi.fn(),
    getHistory: vi.fn(),
    importCsv: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IpController],
      providers: [
        {
          provide: IpService,
          useValue: mockIpService,
        },
      ],
    }).compile();

    controller = module.get<IpController>(IpController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call ipService.create with dto and userId', async () => {
      const dto: CreateIpDto = { address: '192.168.10.1', notes: 'Subnet gateway' };
      mockIpService.create.mockResolvedValue(mockIp);

      const result = await controller.create(dto, mockUser);

      expect(mockIpService.create).toHaveBeenCalledWith(dto, mockUser.userId);
      expect(result).toEqual(mockIp);
    });
  });

  describe('findAll', () => {
    it('should call ipService.findAll with query', async () => {
      const query: IpQueryDto = { page: 1, limit: 20, status: 'FREE' };
      mockIpService.findAll.mockResolvedValue({ items: [mockIp], total: 1 });

      const result = await controller.findAll(query);

      expect(mockIpService.findAll).toHaveBeenCalledWith(query);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return IP address details by UUID', async () => {
      mockIpService.findById.mockResolvedValue(mockIp);

      const result = await controller.findById(mockIp.id);

      expect(mockIpService.findById).toHaveBeenCalledWith(mockIp.id);
      expect(result).toEqual(mockIp);
    });
  });

  describe('update', () => {
    it('should call ipService.update with id, dto, and userId', async () => {
      const dto: UpdateIpDto = { notes: 'Updated notes' };
      mockIpService.update.mockResolvedValue({ ...mockIp, notes: 'Updated notes' });

      const result = await controller.update(mockIp.id, dto, mockUser);

      expect(mockIpService.update).toHaveBeenCalledWith(mockIp.id, dto, mockUser.userId);
      expect(result.notes).toBe('Updated notes');
    });
  });

  describe('reserve', () => {
    it('should call ipService.reserve with id, reason, and userId', async () => {
      mockIpService.reserve.mockResolvedValue({ ...mockIp, status: 'RESERVED' });

      const result = await controller.reserve(mockIp.id, 'Reserved for test', mockUser);

      expect(mockIpService.reserve).toHaveBeenCalledWith(
        mockIp.id,
        'Reserved for test',
        mockUser.userId,
      );
      expect(result.status).toBe('RESERVED');
    });
  });

  describe('release', () => {
    it('should call ipService.release with id, reason, and userId', async () => {
      mockIpService.release.mockResolvedValue({ ...mockIp, status: 'FREE' });

      const result = await controller.release(mockIp.id, 'No longer needed', mockUser);

      expect(mockIpService.release).toHaveBeenCalledWith(
        mockIp.id,
        'No longer needed',
        mockUser.userId,
      );
      expect(result.status).toBe('FREE');
    });
  });

  describe('archive', () => {
    it('should call ipService.archive with id, reason, and userId', async () => {
      mockIpService.archive.mockResolvedValue({ ...mockIp, isArchived: true });

      const result = await controller.archive(mockIp.id, 'Deprecated range', mockUser);

      expect(mockIpService.archive).toHaveBeenCalledWith(
        mockIp.id,
        'Deprecated range',
        mockUser.userId,
      );
      expect(result.isArchived).toBe(true);
    });
  });

  describe('unarchive', () => {
    it('should call ipService.unarchive with id, reason, and userId', async () => {
      mockIpService.unarchive.mockResolvedValue({ ...mockIp, isArchived: false });

      const result = await controller.unarchive(mockIp.id, 'Reinstating range', mockUser);

      expect(mockIpService.unarchive).toHaveBeenCalledWith(
        mockIp.id,
        'Reinstating range',
        mockUser.userId,
      );
      expect(result.isArchived).toBe(false);
    });
  });

  describe('getHistory', () => {
    it('should call ipService.getHistory with id', async () => {
      mockIpService.getHistory.mockResolvedValue([mockHistory]);

      const result = await controller.getHistory(mockIp.id);

      expect(mockIpService.getHistory).toHaveBeenCalledWith(mockIp.id);
      expect(result).toEqual([mockHistory]);
    });
  });

  describe('importCsv', () => {
    it('should extract buffer text and call ipService.importCsv', async () => {
      const mockFile = {
        buffer: Buffer.from('address,notes\n10.0.0.1,Test\n'),
      } as Express.Multer.File;

      const mockResult: IpImportResultDto = {
        total: 1,
        inserted: 1,
        skipped: 0,
        errors: [],
      };
      mockIpService.importCsv.mockResolvedValue(mockResult);

      const result = await controller.importCsv(mockFile, mockUser);

      expect(mockIpService.importCsv).toHaveBeenCalledWith(
        'address,notes\n10.0.0.1,Test\n',
        mockUser.userId,
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle undefined file gracefully', async () => {
      const mockResult: IpImportResultDto = {
        total: 0,
        inserted: 0,
        skipped: 0,
        errors: [],
      };
      mockIpService.importCsv.mockResolvedValue(mockResult);

      const result = await controller.importCsv(undefined as any, mockUser);

      expect(mockIpService.importCsv).toHaveBeenCalledWith('', mockUser.userId);
      expect(result).toEqual(mockResult);
    });
  });
});
