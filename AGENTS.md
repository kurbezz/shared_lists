AGENTS: Repository Agent Guide

This document tells agentic coding assistants how to build, lint, test, and follow code-style rules for this repository. It is written for short-lived agents that must operate safely and predictably.

- Repository layout: root contains `backend/` (Rust) and `frontend/` (React + TypeScript + Vite).

- Primary commands (run from repository root):

  - Build backend (local dev):

```bash
# Build and run the backend server
cd backend && cargo build --workspace && cargo run
```

  - Build frontend (dev / production):

```bash
# Start dev server (HMR)
npm --prefix frontend run dev
# Production build
npm --prefix frontend run build
```

  - Lint frontend (ESLint):

```bash
# Lint whole frontend (fails on warnings in hooks)
npm --prefix frontend run lint
# Fail on warnings (used in pre-commit)
npm --prefix frontend run lint -- --max-warnings=0
```

  - Format & lint backend (Rust):

```bash
cd backend
cargo fmt --all
cargo clippy --manifest-path backend/Cargo.toml --all-targets --all-features -- -D warnings
```

  - Run the whole test suite (backend):

```bash
cd backend && cargo test --all-features --verbose
```

  - Run a single Rust test (most useful):

```bash
# Run tests that match substring 'test_create_and_list_pages'
cd backend && cargo test test_create_and_list_pages -- --nocapture

# Or target by module path:
cd backend && cargo test routes::pages::test_create_and_list_pages -- --nocapture
```

Notes on single-test selection: cargo matches by test name substring by default. If there are many similar names, prefer the fully-qualified module path to avoid accidental runs.

- Running backend + frontend together locally:

  1. Start backend: `cd backend && cargo run` (or `cargo run --release` for production timing) — default port set in environment via `.env`/`backend/.env.example`.
  2. Start frontend: `npm --prefix frontend run dev` (points to the frontend URL configured in `backend/src/config.rs`).

- Docker / CI

  - The backend has a `Dockerfile` at `backend/Dockerfile` and a CI job at `backend/.github/workflows/rust.yml` that runs `cargo test`.

- Hooks

  - Pre-commit hook: `.githooks/pre-commit` (applies Rust checks with `RUSTFLAGS=-D warnings`, optional `cargo clippy`, and runs `npm --prefix frontend run lint -- --max-warnings=0`). Agents should not bypass hooks; follow them locally or explain if you cannot run them.

Style Guide and Conventions
- General

  - Be conservative: prefer explicitness over clever one-liners. Add small comments only where the intent is non-obvious.
  - Avoid editing files unrelated to the task. If you must, explain why in the commit message.

- Rust (backend)

  - Formatting: run `cargo fmt --all` before committing. Follow rustfmt defaults unless a repository-level config exists.
  - Linting: run `cargo clippy --all-targets --all-features -- -D warnings`. Treat clippy warnings as errors in CI/hooks.
  - Imports / modules: group imports in this order: `std::...`, external crates, `crate::...` (or `super::...`), and local modules. Use `use` statements at top of file and prefer explicit imports over glob imports (`*`).
  - Naming:
    - Types / structs / enums: `PascalCase` (e.g. `AppError`, `Config`).
    - Functions / variables / fields: `snake_case` (e.g. `setup_db`, `server_addr`).
    - Constants: `SCREAMING_SNAKE_CASE`.
  - Error handling:
    - Prefer returning `Result<T, AppError>` (repository uses `thiserror` & `anyhow` patterns). Convert lower-level errors into `AppError` with meaningful messages.
    - Do not use `unwrap()`/`expect()` in production code. Reserve them for tests or where a panic is acceptable and document the reason.
    - Implement `IntoResponse` for shared HTTP error mapping (see `backend/src/error.rs`). Use that central mapping consistently.
  - Concurrency / async:
    - Use `tokio` async primitives. Prefer `async fn` and `.await` rather than blocking calls. Use `Arc` for shared state passed into routes (this repo follows that pattern).
  - Tests:
    - Use `#[tokio::test]` for async tests and `anyhow::Result<()>` as the return for convenience (consistent across repo).
    - Use test helper `backend/src/tests_utils.rs` when setting up DB or fixtures.

- TypeScript / React (frontend)

  - Formatting: repository does not include Prettier by default — follow semantic formatting: keep code readable, short lines, and consistent indentation (2 spaces preferred by Vite/TS defaults). Run the TypeScript compiler (`tsc -b`) as part of builds.
  - Linting: use `npm --prefix frontend run lint` which is configured in `frontend/eslint.config.js`. Run with `--max-warnings=0` in CI or pre-commit.
  - Imports:
    - Order imports: external packages (React, libs), absolute app imports (if any), then relative imports. Keep import paths concise. Prefer named imports over default when library exports named items.
    - Keep one import per line only when necessary; group related named imports.
  - Naming:
    - React components and types: `PascalCase` (e.g. `ShareDialog`, `AuthProvider`).
    - Variables / functions: `camelCase` (e.g. `createTestUser`, `fetchPage`).
    - Files: components in `src/components/` use PascalCase file names for default-exported components.
    - Types / interfaces: `PascalCase`. Do not prefix interfaces with `I` (prefer `User`, `ApiKey` over `IUser`).
  - Types & safety:
    - Prefer explicit return types on exported functions. Keep `any` out; prefer narrow types or generics.
    - Keep API client calls centralized in `frontend/src/api/client.ts` so error handling and auth headers are consistent.
  - Error handling:
    - Use `try/catch` in async code; surface user-friendly messages and log/debug internal errors.
    - Avoid leaving `console.log`/`debugger` in committed code.

- Tests & CI specifics

  - Running single backend test: prefer `cd backend && cargo test <test_name> -- --nocapture`. When a test is nested in modules use the module path: `cargo test routes::lists::test_items_crud`.
  - To run tests with clippy/format gating locally (matching pre-commit): `RUSTFLAGS='-D warnings' cargo test` and `cargo clippy -- -D warnings`.
  - GitHub Actions: backend CI job executes `cd backend && cargo test --all-features --verbose` (see `backend/.github/workflows/rust.yml`). Keep changes compatible with CI.

- Cursor / Copilot rules

  - If present, include repository-level agent rules. This repo does not contain `.cursor/rules/` or `.cursorrules` nor `.github/copilot-instructions.md` at the time this file was generated — agents should search these paths before acting and include any rules they find in follow-up commits.

- Safety & operational rules for agents

  1. Do not change secrets or `.env` files. `backend/.env` exists and may contain local credentials — do not commit secrets.
  2. Do not amend other authors' commits. Create new commits only when requested.
  3. Avoid heavy refactors in the same change as a feature/bugfix. Split into separate PRs.
  4. When running commands that modify state (migrations, db), prefer read-only or dev/test flags. Use `backend/migrations` SQLs only in controlled runs.

- When in doubt

  - Run the test that relates to your change first (single test). Run linters/formatters. Make minimal, well-tested edits and include a short explanation in the commit message.

References
- See `backend/.githooks/pre-commit` for the exact pre-commit checks.
- See `backend/Cargo.toml` for backend dependencies and `frontend/package.json` for frontend scripts.

If you want, I can (pick one):
1. Add a small `Makefile` or `justfile` to unify these commands.
2. Add CI steps to run clippy and frontend lint in the root workflow.
3. Add `rustfmt.toml` or `eslint` rules to enforce the style explicitly.
