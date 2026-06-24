# AGENTS.md

## Cursor Cloud specific instructions

Seerr is a single Next.js + Express/TypeORM app (media request manager). General contributor setup lives in `CONTRIBUTING.md` ("Development" section) and standard scripts are in `package.json`. Notes below cover only non-obvious, cloud-environment caveats.

### Node version gotcha (important)
The VM's default `node` on `PATH` is `/exec-daemon/node` (v22.14.0), which is **below** this project's `engines` requirement (`^22.19.0`) and will fail `pnpm install` because `.npmrc` sets `engine-strict=true`. The required Node (v22.x from nvm) must take precedence:
- Interactive shells: the project Node is pinned ahead of `/exec-daemon` in `~/.bashrc`, so new terminals already use the correct version (verify with `node -v`).
- The startup update script handles this for dependency install by sourcing nvm and prepending the nvm Node 22 bin before running `pnpm install`.
- If you ever see `v22.14.0`, run `. "$HOME/.nvm/nvm.sh" && export PATH="$(dirname "$(nvm which 22)"):$PATH"` before node/pnpm commands.

### Running the app
- Dev server: `pnpm dev` (nodemon + ts-node, serves both API and Next.js). Listens on **port 5055**; ready when the log prints `Server ready on port 5055`. It is normally run in a long-lived tmux session.
- Database defaults to **SQLite** at `config/db/db.sqlite3` — no external database is required for local dev. PostgreSQL is optional (see `compose.postgres.yaml` / `DB_TYPE=postgres`).
- A fresh/empty database makes the app redirect to `/setup`, whose normal flow requires an external Plex/Jellyfin/Emby server.

### Getting a usable logged-in instance without an external media server
Run `pnpm cypress:prepare` to seed an initialized instance with local login enabled. It copies `cypress/config/settings.cypress.json` over `config/settings.json` and **drops + reseeds** the DB with these accounts (password `test1234`):
- `admin@seerr.dev` (admin)
- `friend@seerr.dev` (standard user)

Stop the dev server before running it (avoids SQLite lock), then restart `pnpm dev`. Log in via the local "Seerr account" form. TMDB-backed discover/search and request creation work out of the box (outbound TMDB access is available).

### Lint / test / build
- `pnpm lint` currently exits non-zero due to a **pre-existing** error in committed code (`src/components/UserList/index.tsx`, unused `User` import) — this is unrelated to your changes.
- `pnpm test` runs the `node:test` suite (`server/**/*.test.ts`).
- `pnpm build`, `pnpm typecheck` per `package.json`.

### Git hooks
Husky is active: `commit-msg` enforces Conventional Commits (commitlint) and `pre-commit` runs `lint-staged` (prettier + eslint on staged files). Keep commit messages conventional.
