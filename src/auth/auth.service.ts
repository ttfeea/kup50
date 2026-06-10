import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { JwtPayload } from '../common/types/jwt-payload.type';
import { toSafeUser } from '../common/utils/user.mapper';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

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

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
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
