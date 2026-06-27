# CLAUDE.md — Project Guide

Instructions and commands for development, linting, and building this project.

## Development Commands

-   **Start Dev Server**: `npm run dev`
-   **Production Build**: `npm run build`
-   **Run Production Server**: `npm run start`
-   **Run Linter**: `npm run lint`

## Project Structure Guidelines

-   **Route Handlers**: Put API routes under `app/api/` matching Next.js App Router guidelines.
-   **Components**: Keep client-side components in `components/` and mark them with `"use client"`. Keep page routing and data fetching in `app/` files as Server Components.
-   **Database Access**: Utilize the lazy-loaded Supabase client `supabase` in `lib/db.ts` to perform administrative database queries safely.
-   **Signature Verification**: The webhook route `/api/webhook/github` MUST read raw body text via `await req.text()` before parsing JSON to ensure the HMAC signature matches.
-   **Encrypted Secrets**: Ensure OAuth tokens and webhook secrets are encrypted using functions in `lib/crypto.ts` before insertion into the DB.
