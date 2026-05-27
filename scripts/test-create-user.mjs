import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const user = await prisma.user.create({
    data: {
      email: 'probe@company.com',
      password: 'hash',
      role: 'employee',
    },
  });
  console.log('CREATE OK', user.id);
  await prisma.user.delete({ where: { id: user.id } });
} catch (e) {
  console.error('CREATE FAIL:', e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
