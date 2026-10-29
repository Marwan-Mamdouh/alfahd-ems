import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import type { UpdateIpDto as IUpdateIpDto } from '@alfahd/types';

export class UpdateIpDto implements IUpdateIpDto {
  @ApiPropertyOptional({ description: 'Updated operational notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
