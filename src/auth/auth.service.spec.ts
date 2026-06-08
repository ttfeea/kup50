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
      findMany: jest.Mock;
      createMany: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let usersService: {
    findByEmail: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      allowedEmail: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        createMany: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => callback(prisma)),
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

  it('creates, reactivates, and deactivates emails from an authoritative CSV', async () => {
    prisma.allowedEmail.findMany.mockResolvedValue([
      { email: 'keep@example.com', active: true },
      { email: 'return@example.com', active: false },
      { email: 'remove@example.com', active: true },
    ]);
    prisma.allowedEmail.createMany.mockResolvedValue({ count: 1 });
    prisma.allowedEmail.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await service.importAllowedEmails(
      [
        'email',
        ' KEEP@example.com ',
        'return@example.com',
        'new@example.com',
        'new@example.com',
        'not-an-email',
      ].join('\n'),
    );

    expect(result).toEqual({
      found: 3,
      created: 1,
      reactivated: 1,
      deactivated: 1,
      skippedInvalid: 1,
    });
    expect(prisma.allowedEmail.createMany).toHaveBeenCalledWith({
      data: [{ email: 'new@example.com' }],
      skipDuplicates: true,
    });
    expect(prisma.allowedEmail.updateMany).toHaveBeenCalledWith({
      where: { email: { in: ['return@example.com'] } },
      data: { active: true },
    });
    expect(prisma.allowedEmail.updateMany).toHaveBeenCalledWith({
      where: { email: { in: ['remove@example.com'] } },
      data: { active: false },
    });
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
