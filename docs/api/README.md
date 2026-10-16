# API Contracts

Source of truth for every endpoint the mobile app consumes. One file per domain (e.g. `auth.md`, `weather.md`, `market-prices.md`, `agri-mart.md`), documented as the backend builds them.

Each contract should cover: method, path, request shape, response shape, auth requirement, and error cases. The mobile team builds screens against what's documented here, not against backend source — keep it current before merging a change that breaks it.
