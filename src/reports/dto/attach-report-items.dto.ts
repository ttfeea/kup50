import { ReportItemSource } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
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
  @IsString()
  type?: string;

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
