import { WorkItemType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

const manualWorkItemTypes = [
  WorkItemType.NOTE,
  WorkItemType.TASK,
  WorkItemType.CUSTOM,
] as const;

export class CreateManualWorkItemDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsEnum(manualWorkItemTypes)
  type: (typeof manualWorkItemTypes)[number];

  @IsOptional()
  @IsString()
  description?: string;
}
