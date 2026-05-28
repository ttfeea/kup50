import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const now = new Date();
const periodEnd = now;
const periodStart = new Date(now.getTime());
periodStart.setDate(periodStart.getDate() - 30);

try {
  const email = `reportitems-test-${Date.now()}@company.com`;

  const user = await prisma.user.create({
    data: {
      email,
      password: "hash",
      role: "employee",
    },
  });

  const report = await prisma.report.create({
    data: {
      periodStart,
      periodEnd,
      status: "DRAFT",
      userId: user.id,
    },
  });

  // Attach one ReportItem
  const item = await prisma.reportItem.create({
    data: {
      reportId: report.id,
      source: "JIRA",
      externalId: "ISSUE-123",
      title: "Fix login issue",
      url: "https://jira.example/ISSUE-123",
      type: "issue",
      metadata: { stage: "Planned" },
    },
  });

  const loaded = await prisma.report.findFirst({
    where: { id: report.id, userId: user.id },
    include: { reportItems: true },
  });

  console.log(JSON.stringify({
    userId: user.id,
    reportId: report.id,
    attachedItemId: item.id,
    loadedItems: loaded?.reportItems.map((x) => ({
      externalId: x.externalId,
      source: x.source,
      title: x.title,
    })),
  }, null, 2));

  // Cleanup
  await prisma.reportItem.deleteMany({ where: { reportId: report.id } });
  await prisma.report.delete({ where: { id: report.id } });
  await prisma.user.delete({ where: { id: user.id } });
} finally {
  await prisma.$disconnect();
}
