import { IsLatitude, IsLongitude, IsNumber } from 'class-validator';
import type { CheckInRequestDto } from '@alfahd/types';

export class CheckInDto implements CheckInRequestDto {
  @IsNumber()
  @IsLatitude()
  lat: number;

  @IsNumber()
  @IsLongitude()
  lng: number;
}
