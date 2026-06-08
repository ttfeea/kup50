import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { JwtPayload } from '../common/types/jwt-payload.type';
import { toSafeUser } from '../common/utils/user.mapper';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

export type AllowedEmailImportSummary = {
  found: number;
  created: number;
  reactivated: number;
  deactivated: number;
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

    for (const row of dataRows) {
      const columns = row.split(',').map((column) => column.trim());

      if (columns.length !== 1 || !this.isValidEmail(columns[0])) {
        skippedInvalid += 1;
        continue;
      }

      const email = this.normalizeEmail(columns[0]);
      seen.add(email);
    }

    const emails = [...seen];
    const existing = await this.prisma.allowedEmail.findMany({
      select: { email: true, active: true },
    });
    const existingByEmail = new Map(
      existing.map((entry) => [entry.email, entry.active]),
    );
    const missing = emails.filter((email) => !existingByEmail.has(email));
    const inactive = emails.filter(
      (email) => existingByEmail.get(email) === false,
    );
    const activeMissing = existing
      .filter((entry) => entry.active && !seen.has(entry.email))
      .map((entry) => entry.email);

    const changes = await this.prisma.$transaction(async (transaction) => {
      const created = missing.length
        ? await transaction.allowedEmail.createMany({
            data: missing.map((email) => ({ email })),
            skipDuplicates: true,
          })
        : { count: 0 };
      const reactivated = inactive.length
        ? await transaction.allowedEmail.updateMany({
            where: { email: { in: inactive } },
            data: { active: true },
          })
        : { count: 0 };
      const deactivated = activeMissing.length
        ? await transaction.allowedEmail.updateMany({
            where: { email: { in: activeMissing } },
            data: { active: false },
          })
        : { count: 0 };

      return { created, reactivated, deactivated };
    });

    return {
      found: emails.length,
      created: changes.created.count,
      reactivated: changes.reactivated.count,
      deactivated: changes.deactivated.count,
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
