import { IsString } from 'class-validator';

export class ImportAllowedEmailsDto {
  @IsString()
  csv!: string;
}
