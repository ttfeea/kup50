import { ReportStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateReportDto {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  periodDays?: number;
}
