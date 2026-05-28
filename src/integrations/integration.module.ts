import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GitHubClient } from './clients/github.client';
import { GitLabClient } from './clients/gitlab.client';
import { JiraClient } from './clients/jira.client';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';

@Module({
  imports: [AuthModule],
  controllers: [IntegrationController],
  providers: [IntegrationService, JiraClient, GitLabClient, GitHubClient],
  exports: [IntegrationService],
})
export class IntegrationModule {}
