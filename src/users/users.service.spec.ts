import { PrismaService } from '../database/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  it('persists report email settings without changing manager email', async () => {
    const prisma = {
      user: {
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
    };
    const service = new UsersService(prisma as unknown as PrismaService);

    await service.updateById('user-1', {
      reportReceiverEmail: 'reports@example.com',
      reportEmailSubjectTemplate: 'Subject {{month}}',
      reportEmailBodyTemplate: 'Body {{fullname}}',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        managerEmail: undefined,
        reportReceiverEmail: 'reports@example.com',
        reportEmailSubjectTemplate: 'Subject {{month}}',
        reportEmailBodyTemplate: 'Body {{fullname}}',
      }),
    });
  });

  it('updates profile and email settings only for the authenticated user id', async () => {
    const prisma = {
      user: {
        update: jest.fn().mockResolvedValue({ id: 'user-b' }),
      },
    };
    const service = new UsersService(prisma as unknown as PrismaService);

    await service.updateById('user-b', {
      fullname: 'User B',
      reportReceiverEmail: 'b-manager@example.com',
      reportEmailBodyTemplate: 'Body for B',
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-b' },
        data: expect.objectContaining({
          fullname: 'User B',
          reportReceiverEmail: 'b-manager@example.com',
          reportEmailBodyTemplate: 'Body for B',
        }),
      }),
    );
  });
});
