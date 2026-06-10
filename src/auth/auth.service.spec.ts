import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService allowlist', () => {
  let service: AuthService;
  let prisma: {
    allowedEmail: {
      findUnique: jest.Mock;
    };
  };
  let usersService: {
    findByEmail: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      allowedEmail: {
        findUnique: jest.fn(),
      },
    };
    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };

    service = new AuthService(
      usersService as unknown as UsersService,
      { sign: jest.fn(() => 'token') } as unknown as JwtService,
      prisma as unknown as PrismaService,
    );
  });

  it('allows active emails and rejects inactive emails', async () => {
    const user = {
      id: 'user-1',
      email: 'active@example.com',
      role: 'employee',
    };
    prisma.allowedEmail.findUnique.mockResolvedValue({ active: true });
    usersService.findByEmail.mockResolvedValue(user);

    await expect(
      service.login({ email: ' ACTIVE@example.com ' }),
    ).resolves.toMatchObject({
      accessToken: 'token',
      user,
    });

    prisma.allowedEmail.findUnique.mockResolvedValue({ active: false });
    await expect(
      service.login({ email: 'inactive@example.com' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
