# Repository Guidelines

## Project Structure & Module Organization
- `client/src` contains the Vite + React UI, organised by feature folders (`components`, `contexts`, `stores`, `dungeons`) with the `@/` alias pointing here.
- Static assets, deployment manifests, and service configs live under `client/public`, `client/manifest_*.json`, and `client/app.yaml`; keep filenames predictable for builds.
- `contracts/src` holds the Cairo world: `systems` expose entrypoints, `models` define storage, and `utils` share helpers exported through `lib.cairo`; tests stay colocated with their modules.
- Deployment automation sits in `contracts/scripts` with matching `dojo_*.toml`; regenerate `manifest_*.json` after publishing a new Torii world.

## Build, Test, and Development Commands
- `cd client && pnpm install` installs UI dependencies; rerun whenever the lockfile or `patches/` changes.
- `pnpm dev` (port 5173) and `pnpm preview` serve the app; `pnpm build` runs `tsc -b` before building the production bundle.
- `pnpm lint` runs the eslint/typescript-eslint config; add `--fix` before committing formatting-only adjustments.
- `cd contracts && sozo build` compiles Cairo; `sozo test` executes inline `#[test]` specs; `scarb fmt` keeps 4-space indentation and 120-column lines.

## Coding Style & Naming Conventions
- TypeScript uses 2-space indents, double quotes, and eslint defaults; prefer typed function components and centralise shared state in `contexts` or `stores`.
- Use `PascalCase` for components, `camelCase` for hooks/utilities, and align filenames with their exported symbol (e.g., `PlayerCard.tsx`).
- Cairo modules follow `snake_case`; register new modules in `lib.cairo` and document non-obvious logic with concise comments.

## Testing Guidelines
- Contract specs sit beside their logic (e.g., `contracts/src/systems/game/contracts.cairo`); name tests by behaviour (`#[test] fn defeats_beast()`).
- Before opening a PR, run `sozo build && sozo test`, plus `pnpm build` and `pnpm lint` for UI changes; note manual dungeon flows exercised.
- Remove generated `target/` artefacts from commits; only source and manifest files should land in version control.

## Commit & Pull Request Guidelines
- Follow the repo’s short, imperative commit messages (e.g., `fix counts and mobile list`); keep each change focused.
- Reference related issues or tickets and mention affected manifests or network slots when contracts move.
- PR descriptions should cover the change summary, screenshots for UI updates, commands executed, and deployment steps when applicable.

## Configuration & Security Tips
- Client env values load from `app.yaml` and `VITE_` variables; never commit secrets to the repo or manifests.
- Keep `manifest_*`, `dojo_*.toml`, and `torii-*.toml` in sync after deployments so the client points at the latest world addresses.
