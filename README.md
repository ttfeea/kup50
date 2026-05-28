# KUP50 API — Phase 1

NestJS REST API for internal employee reporting with email/password auth and JWT.

## Stack

- NestJS 11 + TypeScript
- PostgreSQL + Prisma
- JWT + bcrypt

## API (Phase 1)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/auth/register` | No | Register (company email only) |
| POST | `/auth/login` | No | Login |
| GET | `/users/me` | JWT | Current user |
| POST | `/reports` | JWT | Create report |
| GET | `/reports` | JWT | List own reports |
| GET | `/reports/:id` | JWT | Get own report |

## Setup

1. Copy env and configure:

   ```powershell
   Copy-Item .env.example .env
   ```

   Required: `DATABASE_URL`, `JWT_SECRET`, `COMPANY_EMAIL_DOMAIN`.

2. Install and migrate:

   ```powershell
   npm install
   npx prisma migrate deploy
   ```

3. Run:

   ```powershell
   npm run start:dev
   ```

## Create report

```http
POST /reports
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "status": "DRAFT"
}
```

Status: `DRAFT` | `SUBMITTED` (default `DRAFT`).

Reports are always owned by the logged-in user (`userId` from JWT).
The reporting period is calculated by the backend, and Jira/GitLab work is stored as report items.
