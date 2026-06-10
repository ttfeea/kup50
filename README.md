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
- `JWT_SECRET`: long random signing secret
- `JWT_EXPIRES_IN`: JWT lifetime, currently `60d`
- `FRONTEND_URL`: allowed frontend origin
- `FRONTEND_URLS`: optional comma-separated replacement for multiple origins

Frontend variables are documented in `frontend/.env.example`.

- `VITE_API_URL`: deployed API URL, or `/api` behind a shared reverse proxy

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
8. Route `/api/*` to the NestJS API and strip the `/api` prefix, or set
   `VITE_API_URL` to the API's public root URL.

All report, integration, user, email-draft, and XLSX endpoints require JWT
authentication. Allowed-email imports are intentionally available only through
the deployment CLI command.
