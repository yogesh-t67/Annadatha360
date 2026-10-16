# Annadata 360 (అన్నదాత 360)

Voice-first Android farming assistant for farmers in Andhra Pradesh and Telangana. Weather, market prices, crop advisory, an AI assistant, government schemes, and a farm-input marketplace in one app.

## Repository structure

```
Annadata-360/
├── mobile/     React Native + Expo + TypeScript app
├── backend/    FastAPI + PostgreSQL API
├── docs/
│   ├── architecture/
│   ├── api/            API contracts — source of truth for frontend/backend integration
│   └── development/
└── .github/
```

## Stack

- **Mobile**: React Native, Expo, TypeScript
- **Backend**: Python, FastAPI, PostgreSQL

## Getting started (mobile)

```
cd mobile
npm install
npm run android   # requires an Android emulator or device
```

## Getting started (backend)

See `backend/README.md` once the backend scaffold lands.

## Workflow

- `main` is the stable branch. Never commit directly to it.
- Branch per feature: `feature/mobile-*`, `feature/backend-*`, `feature/ai-*`, `fix/*`, `docs/*`.
- Changes enter `main` through pull requests.
- Mobile and backend ownership is split — see `docs/development/` for boundaries. Changes to `docs/api/` contracts need a heads-up to both sides before merging.
