import { BadRequestException } from '@nestjs/common';
import { isDateString } from 'class-validator';

export const CALENDAR_DATE_PATTERN = /^(?!0000)\d{4}-\d{2}-\d{2}$/;

export function parseValidDate(value: string, message: string): Date {
  const date = new Date(value);
  if (!isDateString(value, { strict: true }) || Number.isNaN(date.getTime())) {
    throw new BadRequestException(message);
  }
  return date;
}
