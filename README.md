# Chapters of a Life — website

Website for Chapters of a Life (personalised memorial books).

Built with **Next.js** (a website framework), hosted on **Netlify**.
Planned: **Supabase** (logins, database, photo uploads) and **Stripe** (payments).

## Everyday commands

Run these in the Terminal, inside this folder:

| Command | What it does |
| --- | --- |
| `npm install` | Downloads the building blocks the site needs (only needed once, or after they change). |
| `npm run dev` | Starts a preview of the site at http://localhost:3000 — changes show up as you save. Press Ctrl+C to stop. |
| `npm run build` | Checks the site builds correctly, the same way Netlify will. |

## Where things live

- `src/app/page.tsx` — the home page.
- `src/app/layout.tsx` — the frame around every page (page title, fonts).
- `src/app/globals.css` — styles used across the whole site.
- `public/` — images and files served as-is (e.g. `public/logo.png` → `/logo.png`).
- New pages: make a folder in `src/app` with a `page.tsx` inside, e.g. `src/app/about/page.tsx` → `/about`.

## Secret keys

Copy `.env.example` to `.env.local` and fill in the values. Never share or upload `.env.local`.
Put the same values in Netlify under *Site configuration → Environment variables*.
