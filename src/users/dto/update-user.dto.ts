import { IsEmail, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullname?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  managerName?: string;

  @IsOptional()
  @IsString()
  managerEmail?: string;

  @IsOptional()
  @IsString()
  reportReceiverEmail?: string;

  @ValidateIf((_, value) => value !== undefined && value !== '')
  @IsEmail()
  reportCcEmail?: string;

  @IsOptional()
  @IsString()
  reportEmailSubjectTemplate?: string;

  @IsOptional()
  @IsString()
  reportEmailBodyTemplate?: string;
}
