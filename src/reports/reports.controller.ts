import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SafeUser } from '../common/utils/user.mapper';
import { CreateReportDto } from './dto/create-report.dto';
import { AttachReportItemsDto } from './dto/attach-report-items.dto';
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

  @Post(':id/items')
  attachItems(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() dto: AttachReportItemsDto,
  ) {
    return this.reportsService.attachReportItems(user.id, id, dto.items);
  }
}
