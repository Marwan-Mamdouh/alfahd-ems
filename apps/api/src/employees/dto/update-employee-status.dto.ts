import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { USER_STATUSES, type UserStatus, type UpdateEmployeeStatusDto } from '@alfahd/types';

export class UpdateEmployeeStatusRequestDto implements UpdateEmployeeStatusDto {
  @IsIn(USER_STATUSES)
  status: UserStatus;

  @IsString()
  @IsNotEmpty({ message: 'Reason is required for status change' })
  reason: string;
}
