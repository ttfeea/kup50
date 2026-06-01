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
import { FetchIntegrationItemsDto } from './dto/fetch-integration-items.dto';
import { StoreIntegrationTokenDto } from './dto/store-integration-token.dto';
import { IntegrationService } from './integration.service';

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Get()
  list(@CurrentUser() user: SafeUser) {
    return this.integrationService.listTokens(user.id);
  }

  @Post(':provider/token')
  storeToken(
    @CurrentUser() user: SafeUser,
    @Param('provider') providerParam: string,
    @Body() dto: StoreIntegrationTokenDto,
  ) {
    const provider = this.integrationService.parseProvider(providerParam);
    return this.integrationService.storeToken(user.id, provider, dto);
  }

  @Delete(':provider')
  disconnect(
    @CurrentUser() user: SafeUser,
    @Param('provider') providerParam: string,
  ) {
    const provider = this.integrationService.parseProvider(providerParam);
    return this.integrationService.disconnect(user.id, provider);
  }

  @Post(':provider/check')
  checkConnection(
    @CurrentUser() user: SafeUser,
    @Param('provider') providerParam: string,
  ) {
    const provider = this.integrationService.parseProvider(providerParam);
    return this.integrationService.checkConnection(user.id, provider);
  }

  @Get(':provider/items')
  fetchItems(
    @CurrentUser() user: SafeUser,
    @Param('provider') providerParam: string,
    @Query() query: FetchIntegrationItemsDto,
  ) {
    const provider = this.integrationService.parseProvider(providerParam);
    return this.integrationService.fetchItems(user.id, provider, {
      limit: query.limit,
    });
  }

  @Get('preview')
  previewItems(
    @CurrentUser() user: SafeUser,
    @Query() query: FetchIntegrationItemsDto,
  ) {
    const since = query.periodDays
      ? new Date(Date.now() - query.periodDays * 24 * 60 * 60 * 1000)
      : undefined;

    return this.integrationService.fetchConfiguredItems(user.id, {
      limit: query.limit,
      since,
    });
  }
}
