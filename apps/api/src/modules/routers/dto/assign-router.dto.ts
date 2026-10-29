import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import type { AssignRouterDto as IAssignRouterDto } from '@alfahd/types';

export class AssignRouterDto implements IAssignRouterDto {
  @ApiProperty({ description: 'Technician user UUID to receive custody of the router' })
  @IsUUID()
  @IsNotEmpty()
  technicianId!: string;

  @ApiPropertyOptional({ description: 'Optional custody transfer notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
