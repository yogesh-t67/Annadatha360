# Annadata 360 ERP (web)

Vendor portal and admin panel. Next.js + TypeScript + Tailwind. English only for now.

The browser talks only to this app. Its server forwards to the FastAPI backend and keeps the login tokens in
httpOnly cookies, so page scripts never see them:

- `/api/auth/*`: login, authenticator code, renew, logout (set and clear the cookies)
- `/api/erp/*`: everything else, forwarded to the backend's `/api/v1/erp/*` with the login attached
- `src/proxy.ts`: sends logged-out visitors to `/login`, staff to `/admin`, vendors to `/vendor`

## Run on the laptop

```
# backend first (see backend/README.md), then:
cp .env.example .env        # ERP_API_URL=http://localhost:8010/api/v1
npm install
npm run dev                 # http://localhost:3000
```

The first Super Admin is created on the backend: `python -m app.jobs.create_erp_admin you@example.com "Name"`
(prints a one-time link to set the password).

## When the backend API changes

```
# from backend/ (inside its container or venv)
python -m app.jobs.export_openapi ../web/openapi.json
# then here
npm run api:types           # regenerates src/lib/api-schema.d.ts
npm run typecheck
```
