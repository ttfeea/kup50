import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ImportAllowedEmailsDto } from './dto/import-allowed-emails.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('allowed-emails/import')
  importAllowedEmails(@Body() dto: ImportAllowedEmailsDto) {
    return this.authService.importAllowedEmails(dto.csv);
  }
}
