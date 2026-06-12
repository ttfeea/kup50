import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ImportBackupDto } from './dto/import-backup.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('import-backup')
  @HttpCode(HttpStatus.OK)
  importBackup(@Body() dto: ImportBackupDto) {
    return this.adminService.importBackup(dto.sqlContent);
  }
}
