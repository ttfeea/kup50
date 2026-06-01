import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class StoreIntegrationTokenDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  token: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MinLength(1)
  accountEmail?: string;
}
