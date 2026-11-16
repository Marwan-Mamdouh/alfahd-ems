import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
  type OverrideAttendanceDto,
} from '@alfahd/types';

export class OverrideAttendanceRequestDto implements OverrideAttendanceDto {
  @IsOptional()
  @IsDateString({ strict: true })
  checkInAt?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  checkOutAt?: string;

  @IsOptional()
  @IsIn(ATTENDANCE_STATUSES)
  status?: AttendanceStatus;

  @IsString()
  @IsNotEmpty({ message: 'Override reason is required' })
  overrideReason: string;
}
