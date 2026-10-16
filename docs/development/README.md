# Development

Onboarding steps, ownership boundaries, and branch conventions.

## Ownership

- **Mobile** (`mobile/`): UI, navigation, localization.
- **Backend** (`backend/`): database, API contracts, AI integrations.

Both developers may read the whole repo; changes to shared configuration or `docs/api/` contracts need coordination with the other side before merging.

## Branches

- `feature/mobile-*`
- `feature/backend-*`
- `feature/ai-*`
- `fix/*`
- `docs/*`

Never commit directly to `main`. Pull latest before starting new work. Resolve conflicts deliberately — never overwrite another developer's work.

## Onboarding

1. Install Node.js (LTS, ≥22.13.0 — required by the current Expo SDK), Python 3.11+, and Git.
2. Clone the repo: `git clone git@github.com:Satyanand-1/Annadata-360.git`
3. Configure `git config user.name` / `user.email`.
4. Authenticate with GitHub (SSH key recommended).
5. Create a feature branch off `main`.
6. Make and test changes (`mobile/`: `npm install && npm run android`; `backend/`: see `backend/README.md`).
7. Commit with a meaningful, feature-specific message.
8. Push the branch and open a pull request using the PR template.
