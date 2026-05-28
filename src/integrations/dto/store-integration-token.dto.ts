import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class StoreIntegrationTokenDto {
  @IsString()
  @MinLength(1)
  token: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  accountEmail?: string;
}
