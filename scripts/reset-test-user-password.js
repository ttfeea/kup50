const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = 'sofiia.tarasenko@precisely.com';
  const plainPassword = 'Password123';

  const hash = await bcrypt.hash(plainPassword, 10);
  const updated = await prisma.user.update({
    where: { email },
    data: { password: hash },
  });

  const verified = await bcrypt.compare(plainPassword, updated.password);

  console.log(JSON.stringify({
    email: updated.email,
    id: updated.id,
    passwordSetTo: plainPassword,
    verificationPassed: verified,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
