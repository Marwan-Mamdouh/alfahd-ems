import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { Role } from '@alfahd/types';
import { EmployeesService } from './employees.service.js';
import type { User } from '../database/schema/index.js';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let usersServiceMock: any;
  let storageServiceMock: any;
  let sessionServiceMock: any;

  const mockUser: User = {
    id: 'user-123',
    name: 'Ahmed Mostafa',
    email: 'ahmed@alfahd.local',
    passwordHash: 'hash',
    role: 'TECHNICIAN',
    department: 'TECHNICAL',
    phone: '+201012345678',
    nationalId: '29501011234567',
    hireDate: '2026-01-15',
    profilePhotoKey: 'old-key',
    status: 'ACTIVE',
    assignedWarehouseId: 'warehouse-123',
    isActive: true,
    createdAt: new Date('2026-01-15T08:00:00Z'),
    updatedAt: new Date('2026-01-15T08:00:00Z'),
  };

  beforeEach(() => {
    usersServiceMock = {
      createEmployee: vi.fn(),
      findEmployees: vi.fn(),
      findEmployeeById: vi.fn().mockResolvedValue(mockUser),
      updateEmployee: vi.fn(),
      updateEmployeeStatus: vi.fn(),
      updateProfilePhotoKey: vi.fn(),
    };

    storageServiceMock = {
      uploadFile: vi.fn().mockResolvedValue({
        publicId: 'employees/photos/new-key',
        url: 'https://cdn.example.com/new-key.jpg',
      }),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      getOptimizedUrl: vi.fn((key: string) => `https://cdn.example.com/${key}`),
    };

    sessionServiceMock = {
      revokeAllSessions: vi.fn().mockResolvedValue(2),
    };

    service = new EmployeesService(usersServiceMock, storageServiceMock, sessionServiceMock);
  });

  describe('create', () => {
    it('creates an employee and returns EmployeeDto', async () => {
      usersServiceMock.createEmployee.mockResolvedValue(mockUser);

      const result = await service.create({
        name: 'Ahmed Mostafa',
        email: 'ahmed@alfahd.local',
        role: Role.TECHNICIAN,
        assignedWarehouseId: 'warehouse-123',
      });

      expect(result.id).toBe('user-123');
      expect(result.name).toBe('Ahmed Mostafa');
      expect(result.role).toBe('TECHNICIAN');
      expect(usersServiceMock.createEmployee).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('rejects status update if reason is empty', async () => {
      await expect(service.updateStatus('user-123', 'INACTIVE', '   ')).rejects.toThrow(
        BadRequestException,
      );
      expect(usersServiceMock.updateEmployeeStatus).not.toHaveBeenCalled();
    });

    it('revokes all sessions when status is set to INACTIVE', async () => {
      const inactiveUser = { ...mockUser, status: 'INACTIVE', isActive: false };
      usersServiceMock.updateEmployeeStatus.mockResolvedValue(inactiveUser);

      const result = await service.updateStatus('user-123', 'INACTIVE', 'Resigned');

      expect(result.status).toBe('INACTIVE');
      expect(usersServiceMock.updateEmployeeStatus).toHaveBeenCalledWith('user-123', 'INACTIVE');
      expect(sessionServiceMock.revokeAllSessions).toHaveBeenCalledWith('user-123');
    });

    it('does NOT revoke sessions when status is set to ON_LEAVE', async () => {
      const onLeaveUser = { ...mockUser, status: 'ON_LEAVE' };
      usersServiceMock.updateEmployeeStatus.mockResolvedValue(onLeaveUser);

      const result = await service.updateStatus('user-123', 'ON_LEAVE', 'Annual leave');

      expect(result.status).toBe('ON_LEAVE');
      expect(sessionServiceMock.revokeAllSessions).not.toHaveBeenCalled();
    });
  });

  describe('uploadPhoto', () => {
    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

    it('rejects missing or empty file', async () => {
      await expect(service.uploadPhoto('user-123', undefined)).rejects.toThrow(BadRequestException);
    });

    it('rejects file exceeding 5 MB', async () => {
      const largeFile = {
        buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
      } as Express.Multer.File;

      await expect(service.uploadPhoto('user-123', largeFile)).rejects.toThrow(BadRequestException);
    });

    it('rejects file with invalid magic bytes', async () => {
      const invalidFile = {
        buffer: Buffer.from('not an image'),
      } as Express.Multer.File;

      await expect(service.uploadPhoto('user-123', invalidFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('uploads valid JPEG, updates DB, and deletes previous asset', async () => {
      const file = {
        buffer: validJpeg,
      } as Express.Multer.File;

      usersServiceMock.updateProfilePhotoKey.mockResolvedValue({
        ...mockUser,
        profilePhotoKey: 'employees/photos/new-key',
      });

      const result = await service.uploadPhoto('user-123', file);

      expect(result.profilePhotoKey).toBe('employees/photos/new-key');
      expect(storageServiceMock.uploadFile).toHaveBeenCalledWith(
        validJpeg,
        'employees/photos',
        'image/jpeg',
      );
      expect(usersServiceMock.updateProfilePhotoKey).toHaveBeenCalledWith(
        'user-123',
        'employees/photos/new-key',
      );
      expect(storageServiceMock.deleteFile).toHaveBeenCalledWith('old-key');
    });

    it('rolls back uploaded file if DB update fails', async () => {
      const file = {
        buffer: validJpeg,
      } as Express.Multer.File;

      usersServiceMock.updateProfilePhotoKey.mockRejectedValue(new Error('DB write failed'));

      await expect(service.uploadPhoto('user-123', file)).rejects.toThrow('DB write failed');
      expect(storageServiceMock.deleteFile).toHaveBeenCalledWith('employees/photos/new-key');
    });
  });
});
