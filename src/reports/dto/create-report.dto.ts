import { ReportStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class CreateReportDto {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;
}
