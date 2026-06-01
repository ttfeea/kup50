import { ReportItemSource, WorkItemType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AttachReportItemDto {
  @IsEnum(ReportItemSource)
  source: ReportItemSource;

  @IsEnum(WorkItemType)
  type: WorkItemType;

  @IsString()
  @MinLength(1)
  externalId: string;

  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsDateString()
  activityCreatedAt?: string;

  @IsOptional()
  @IsDateString()
  activityUpdatedAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class AttachReportItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachReportItemDto)
  items: AttachReportItemDto[];
}
