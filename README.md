# KUP50

KUP50 is a NestJS and React application for building Jira-centered employee
creative-work reports, previewing the final eight-column HR table, preparing
email drafts, and downloading XLSX reports.

## Requirements

- Node.js 20+
- PostgreSQL
- Jira API token for Jira reports
- Optional GitHub or GitLab token for merge-request fallback matching

## Local Setup

```powershell
Copy-Item .env.example .env
npm install
npm install --prefix frontend
npx prisma migrate deploy
npm run dev:all
```

The API runs on `http://localhost:3000` and Vite runs on
`http://localhost:5173`.

## Environment

Backend variables are documented in `.env.example`.

- `DATABASE_URL`: PostgreSQL connection string
- `DIRECT_URL`: direct PostgreSQL connection string used by Prisma migrations
- `JWT_SECRET`: long random signing secret
- `JWT_EXPIRES_IN`: JWT lifetime, currently `60d`
- `FRONTEND_URL`: additional allowed frontend origin
- `FRONTEND_URLS`: optional comma-separated additional origins

Frontend variables are documented in `frontend/.env.example`. Production uses
`frontend/.env.production`, which points to the public Railway API.

- `VITE_API_BASE_URL`: public root URL of the backend, such as
  `https://your-api.up.railway.app`

Vite embeds `VITE_*` variables during the frontend build. Vercel may override
`VITE_API_BASE_URL` for the Production environment. A production build without
it fails with a clear configuration error instead of deploying a blank page or
silently sending requests to the frontend origin. Local Vite development
defaults explicitly to `http://localhost:3000`.

## Allowed Emails

Import the authoritative CSV allowlist before users sign in:

```powershell
npm run allowed-emails:import -- .\allowed-emails.csv
```

The CSV may contain an `email` header. Missing addresses are deactivated, so
review the file before importing it.

## Validation

```powershell
npm run build
npm test -- --runInBand
npx prisma validate
npx prisma generate
npm run build --prefix frontend
```

## Production

1. Set production backend and frontend environment variables.
2. Install dependencies with `npm ci` in the root and `frontend`.
3. Run `npx prisma migrate deploy`.
4. Import the allowed-email CSV.
5. Build the backend and frontend.
6. Start the API with `npm run start:prod`.
7. Serve `frontend/dist` through a static host or reverse proxy.
8. Set `VITE_API_BASE_URL` to the API's public root URL before building the
   frontend.

All report, integration, user, email-draft, and XLSX endpoints require JWT
authentication. Allowed-email imports are intentionally available only through
the deployment CLI command.
