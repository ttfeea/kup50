import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const rootDir = process.cwd();
const ignoredDirs = new Set([
  '.git',
  'dist',
  'node_modules',
  'coverage',
  'frontend/dist',
  'frontend/node_modules',
]);

function isIgnored(filePath) {
  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  return [...ignoredDirs].some(
    (ignored) => relativePath === ignored || relativePath.startsWith(`${ignored}/`),
  );
}

function findCsvFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (isIgnored(entryPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...findCsvFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) {
      files.push(entryPath);
    }
  }

  return files;
}

function resolveCsvPath() {
  const requestedPath = process.argv[2];

  if (requestedPath) {
    const csvPath = path.resolve(rootDir, requestedPath);
    if (!existsSync(csvPath) || !statSync(csvPath).isFile()) {
      throw new Error(`CSV file not found: ${csvPath}`);
    }
    return csvPath;
  }

  const csvFiles = findCsvFiles(rootDir);

  if (csvFiles.length === 0) {
    throw new Error('No CSV file found in the project folder.');
  }

  if (csvFiles.length > 1) {
    throw new Error(
      `Multiple CSV files found. Pass one path explicitly:\n${csvFiles.join('\n')}`,
    );
  }

  return csvFiles[0];
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseEmails(csv) {
  const rows = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const dataRows = rows[0]?.toLowerCase() === 'email' ? rows.slice(1) : rows;
  const emails = new Set();
  let invalid = 0;

  for (const row of dataRows) {
    const columns = row.split(',').map((column) => column.trim());

    if (columns.length !== 1) {
      invalid += 1;
      continue;
    }

    const email = normalizeEmail(columns[0]);
    if (!isValidEmail(email)) {
      invalid += 1;
      continue;
    }

    emails.add(email);
  }

  return {
    totalRows: dataRows.length,
    emails: [...emails],
    invalid,
  };
}

async function main() {
  const csvPath = resolveCsvPath();
  const csv = readFileSync(csvPath, 'utf8');
  const parsed = parseEmails(csv);

  if (parsed.totalRows === 0) {
    console.warn(`Warning: CSV file is empty: ${csvPath}`);
  }

  const emailSet = new Set(parsed.emails);
  const existing = await prisma.allowedEmail.findMany({
    select: { email: true, active: true },
  });
  const existingByEmail = new Map(
    existing.map((entry) => [entry.email, entry.active]),
  );
  const missing = parsed.emails.filter((email) => !existingByEmail.has(email));
  const inactive = parsed.emails.filter(
    (email) => existingByEmail.get(email) === false,
  );
  const activeMissing = existing
    .filter((entry) => entry.active && !emailSet.has(entry.email))
    .map((entry) => entry.email);

  const changes = await prisma.$transaction(async (transaction) => {
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

  console.log(`CSV file: ${path.relative(rootDir, csvPath)}`);
  console.log(`Emails found: ${parsed.emails.length}`);
  console.log(`Created: ${changes.created.count}`);
  console.log(`Reactivated: ${changes.reactivated.count}`);
  console.log(`Deactivated: ${changes.deactivated.count}`);
  console.log(`Skipped invalid: ${parsed.invalid}`);
  console.log('Allowed email import completed successfully.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
