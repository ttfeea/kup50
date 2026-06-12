import { IsString, IsNotEmpty } from 'class-validator';

export class ImportBackupDto {
  @IsString()
  @IsNotEmpty()
  sqlContent: string;
}
