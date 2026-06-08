import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SafeUser } from '../common/utils/user.mapper';
import { FetchIntegrationItemsDto } from '../integrations/dto/fetch-integration-items.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { AttachReportItemsDto } from './dto/attach-report-items.dto';
import { CreateManualWorkItemDto } from './dto/create-manual-work-item.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateReportDto) {
    return this.reportsService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: SafeUser) {
    return this.reportsService.getReportsWithItems(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.reportsService.getReportWithItems(user.id, id);
  }

  @Delete(':id')
  deleteDraft(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.reportsService.deleteDraft(user.id, id);
  }

  @Get(':id/fetch-items')
  fetchItems(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Query() query: FetchIntegrationItemsDto,
  ) {
    return this.reportsService.fetchPreviewItems(
      user.id,
      id,
      query.limit,
      query.periodDays,
      query.periodStart,
      query.periodEnd,
    );
  }

  @Post(':id/items')
  attachItems(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() dto: AttachReportItemsDto,
  ) {
    return this.reportsService.attachReportItems(user.id, id, dto.items);
  }

  @Post(':id/manual-items')
  addManualItem(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() dto: CreateManualWorkItemDto,
  ) {
    return this.reportsService.addManualWorkItem(user.id, id, dto);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.reportsService.confirmReport(user.id, id);
  }
}
