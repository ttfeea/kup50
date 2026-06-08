import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { JwtPayload } from '../common/types/jwt-payload.type';
import { toSafeUser } from '../common/utils/user.mapper';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

export type AllowedEmailImportSummary = {
  totalRows: number;
  created: number;
  skippedDuplicates: number;
  skippedInvalid: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const allowed = await this.prisma.allowedEmail.findUnique({
      where: { email },
    });

    if (!allowed?.active) {
      throw new ForbiddenException('Access denied');
    }

    const user =
      (await this.usersService.findByEmail(email)) ??
      (await this.usersService.create({ email }));

    return this.buildAuthResponse(user);
  }

  async importAllowedEmails(csv: string): Promise<AllowedEmailImportSummary> {
    const rows = csv
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const dataRows = rows[0]?.toLowerCase() === 'email' ? rows.slice(1) : rows;
    const seen = new Set<string>();
    let skippedInvalid = 0;
    let duplicateRows = 0;

    for (const row of dataRows) {
      const columns = row.split(',').map((column) => column.trim());

      if (columns.length !== 1 || !this.isValidEmail(columns[0])) {
        skippedInvalid += 1;
        continue;
      }

      const email = this.normalizeEmail(columns[0]);
      if (seen.has(email)) {
        duplicateRows += 1;
        continue;
      }

      seen.add(email);
    }

    const emails = [...seen];
    const result = await this.prisma.allowedEmail.createMany({
      data: emails.map((email) => ({ email })),
      skipDuplicates: true,
    });

    return {
      totalRows: dataRows.length,
      created: result.count,
      skippedDuplicates: duplicateRows + emails.length - result.count,
      skippedInvalid,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  private buildAuthResponse(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: toSafeUser(user),
    };
  }
}
