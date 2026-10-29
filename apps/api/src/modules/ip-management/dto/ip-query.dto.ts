import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { IP_STATUSES, type IpStatus, type IpQueryDto as IIpQueryDto } from '@alfahd/types';

export class IpQueryDto implements IIpQueryDto {
  @ApiPropertyOptional({ enum: IP_STATUSES })
  @IsOptional()
  @IsEnum(IP_STATUSES)
  status?: IpStatus;

  @ApiPropertyOptional({ description: 'Filter by archived flag' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isArchived?: boolean;

  @ApiPropertyOptional({ description: 'Search by address or notes' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
