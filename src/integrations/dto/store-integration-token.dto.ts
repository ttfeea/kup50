import { Transform, TransformFnParams } from 'class-transformer';
import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim() : input;
}

export class StoreIntegrationTokenDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  token: string;

  @Transform(trimString)
  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  accountEmail?: string;
}
