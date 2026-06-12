import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async importBackup(sqlContent: string): Promise<{ success: boolean; message: string }> {
    try {
      // Execute the raw SQL backup against the connected database.
      // Prisma's $executeRawUnsafe runs arbitrary SQL; we split on statement
      // boundaries so each statement is sent individually.
      const statements = sqlContent
        .split(/;\s*\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        await this.prisma.$executeRawUnsafe(statement);
      }

      return { success: true, message: 'Backup imported successfully' };
    } catch (error: any) {
      throw new InternalServerErrorException({
        error: 'Import failed',
        details: error.message,
      });
    }
  }
}
