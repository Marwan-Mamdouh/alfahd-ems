import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { EmployeeDto, UserStatus } from '@alfahd/types';
import { Role } from '@alfahd/types';
import { UsersService } from '../users/users.service.js';
import { StorageService } from '../storage/storage.interface.js';
import { SessionService } from '../redis/session.service.js';
import { getImageMimeTypeFromBuffer } from '../common/utils/file.utils.js';
import { toEmployeeDto } from '../database/schema/mappers.js';
import type { CreateEmployeeRequestDto } from './dto/create-employee.dto.js';
import type { UpdateEmployeeRequestDto } from './dto/update-employee.dto.js';
import type { EmployeeQueryRequestDto } from './dto/employee-query.dto.js';
import type { JwtUser } from '../auth/strategies/jwt.strategy.js';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
    private readonly sessionService: SessionService,
  ) {}

  async create(dto: CreateEmployeeRequestDto): Promise<EmployeeDto> {
    const user = await this.usersService.createEmployee(dto);
    return toEmployeeDto(user);
  }

  async findAll(query: EmployeeQueryRequestDto): Promise<{
    data: EmployeeDto[];
    meta: { page: number; pageSize: number; total: number };
  }> {
    // Defaults and bounds (1..100) come from EmployeeQueryRequestDto via the
    // global ValidationPipe — no service-side clamping.
    const result = await this.usersService.findEmployees(query);
    return {
      data: result.data.map(toEmployeeDto),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
      },
    };
  }

  async findOne(id: string, currentUser?: JwtUser): Promise<EmployeeDto> {
    if (currentUser && currentUser.role !== Role.ADMIN && currentUser.userId !== id) {
      throw new ForbiddenException('Access denied');
    }
    const user = await this.usersService.findEmployeeById(id);
    return toEmployeeDto(user);
  }

  async update(id: string, dto: UpdateEmployeeRequestDto): Promise<EmployeeDto> {
    const user = await this.usersService.updateEmployee(id, dto);
    return toEmployeeDto(user);
  }

  async updateStatus(id: string, status: UserStatus, reason: string): Promise<EmployeeDto> {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Reason is mandatory for status changes');
    }

    const updatedUser = await this.usersService.updateEmployeeStatus(id, status);

    // If status is changed to INACTIVE, revoke all active sessions in Redis
    if (status === 'INACTIVE') {
      await this.sessionService.revokeAllSessions(id);
    }

    return toEmployeeDto(updatedUser);
  }

  async uploadPhoto(
    id: string,
    file?: Express.Multer.File,
  ): Promise<{ profilePhotoKey: string; url: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Photo file is required');
    }

    // 5 MB limit
    if (file.buffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds the 5 MB limit');
    }

    // Validate magic bytes
    const mimeType = getImageMimeTypeFromBuffer(file.buffer);
    if (!mimeType) {
      throw new BadRequestException('Invalid file type: only JPEG and PNG are allowed');
    }

    const user = await this.usersService.findEmployeeById(id);
    const oldPhotoKey = user.profilePhotoKey;

    const uploadResult = await this.storageService.uploadFile(
      file.buffer,
      'employees/photos',
      mimeType,
    );

    try {
      await this.usersService.updateProfilePhotoKey(id, uploadResult.publicId);
    } catch (dbError) {
      // Rollback compensation: delete uploaded asset from Cloudinary
      await this.storageService.deleteFile(uploadResult.publicId);
      throw dbError;
    }

    // Upon successful database update, delete previous asset if existed
    if (oldPhotoKey) {
      try {
        await this.storageService.deleteFile(oldPhotoKey);
      } catch (error) {
        // Deletion failure must not fail the request, but it must be visible
        // server-side: silently swallowed errors leak orphaned assets.
        this.logger.warn(
          `Failed to delete superseded profile photo ${oldPhotoKey} from storage: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      profilePhotoKey: uploadResult.publicId,
      url: uploadResult.url,
    };
  }
}
