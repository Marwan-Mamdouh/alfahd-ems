import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIP, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { CreateIpDto as ICreateIpDto } from '@alfahd/types';

export class CreateIpDto implements ICreateIpDto {
  @ApiProperty({ description: 'IPv4 host address (individual IP only)', example: '192.168.1.100' })
  @IsIP(4, {
    message: 'Address must be a valid individual IPv4 host address (no CIDR ranges or IPv6)',
  })
  @IsNotEmpty()
  address!: string;

  @ApiPropertyOptional({ description: 'Optional operational notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
