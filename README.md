# CASE RUSH

A dark-theme virtual case-opening game, built with **Next.js 15**, **PostgreSQL**, **Prisma** and an HTTP/Socket.IO production server.

## Current status
This GitHub repository now contains a **new working starter implementation**, not yet the complete previous CASE RUSH V2 release. Features included in source: registration/login, secure session cookie, 500 starting Coins, one free starter case, nine seeded cases with disclosed probabilities, crypto-random single openings, saved inventory and one-time immediate sales. Real-time battle functionality, bots, upgrades, 30-minute LUCK event, complete administration, locale switch, external CS2 images and enhanced security protections are **not yet included**. UI and server behavior must still be tested on a deployed instance before public use.

**Do not represent this as a finished live multiplayer game.**

## Run locally
1. Install Node.js, PostgreSQL and run the PostgreSQL server.
2. `npm install`
3. Copy `.env.example` to `.env` and set a valid `DATABASE_URL`.
4. `npm run db:push`
5. `npm run db:seed`
6. `npm run dev`

## Publish online
See [DEPLOY_RENDER.md](DEPLOY_RENDER.md) for the Render Blueprint deployment instructions. GitHub Pages alone cannot host Next.js API routes, PostgreSQL and Socket.IO.

This project uses **virtual Coins only**, without deposits or cash withdrawals. Before publicly releasing: carry out security and load tests, add login rate limits and full audit logging, revise database migrations, replace illustrative skin names with properly licensed assets, fill legal pages, and inspect hosting pricing and data persistence.
