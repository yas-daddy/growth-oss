# Contributing to GrowthOS

Thanks for your interest in improving GrowthOS! This guide covers how to get set up, the conventions we follow, and how to propose changes.

## Getting set up

1. Fork the repository and clone your fork.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the environment template and fill in your own Supabase project's values:

   ```bash
   cp .env.example .env
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

For backend setup (database schema and edge functions), see [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md).

## Project layout

- `src/` — the React + TypeScript frontend (Vite, Tailwind, shadcn-ui).
- `supabase/functions/` — Deno edge functions (platform syncs, AI agents, webhooks).
- `supabase/migrations/` — database schema history. Never edit an existing migration; add a new one.

## Conventions

- **Language:** TypeScript everywhere. Prefer explicit types at module boundaries.
- **Components:** Reuse the shadcn-ui primitives in `src/components/ui` before adding new UI dependencies.
- **Data fetching:** Use TanStack Query hooks (see `src/hooks`) rather than ad-hoc `fetch` in components.
- **Styling:** Tailwind utility classes; avoid inline styles.
- **Imports:** Use the `@/` path alias for anything under `src/`.

## Before you open a pull request

Run the checks locally and make sure they pass:

```bash
npm run lint
npm run build
```

Then:

1. Create a branch with a descriptive name (e.g. `fix/keyword-bid-rounding`).
2. Keep each PR focused on a single change. Small, reviewable PRs merge faster.
3. Write a clear description: what changed, why, and how you tested it.
4. Reference any related issue.

## Reporting bugs and requesting features

Open an issue describing the problem or proposal. For bugs, include reproduction steps, what you expected, and what actually happened. Please don't include real API keys, access tokens, or other secrets in issues or PRs.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
