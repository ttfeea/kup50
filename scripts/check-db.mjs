import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const ping = await prisma.$queryRaw`SELECT 1 AS ok`;
  console.log('DB connect: OK', ping);

  const users = await prisma.user.count();
  const reports = await prisma.report.count();
  console.log(`Counts: users=${users}, reports=${reports}`);
} catch (error) {
  console.error('DB connect: FAIL', error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
