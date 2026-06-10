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
});
