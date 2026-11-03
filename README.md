# Splitwise Lite

> New here? [`TASK.md`](./TASK.md) has what we're asking you to do —
> this file is just stack and setup.

The expense-splitting app a few of our friend groups and roommate
households actually use to track who paid for what and settle up. It's
small, but the balances it shows are the ones people act on — someone
transfers real money based on what this app tells them they owe. Treat
bugs here the way you'd treat bugs in anything else that touches money.

## Stack

- **Backend:** Express + [tRPC](https://trpc.io) on an in-memory data
  store. There's no persistence layer yet — a server restart clears
  everything. That's a known gap (migrating to a real database is tracked
  separately), not a design statement; don't read anything else into it.
- **Frontend:** Vite + React + [shadcn/ui](https://ui.shadcn.com) (Tailwind v4)
- **Types:** shared end-to-end between client and server via tRPC, no
  separate API schema to maintain

## Getting started

```bash
npm install
npm run dev
```

This starts both workspaces:

- API server on [http://localhost:4000](http://localhost:4000)
- Web app on [http://localhost:5173](http://localhost:5173) (proxies `/trpc`
  requests to the API server)

Seed data is loaded on server start: three users (Alice, Bob, Carol) and
one group ("Weekend Trip") with a few example expenses.

You can log in as any of the demo users from the login page, or use the
"Acting as" picker in the header to switch who you're currently browsing
as.

## Project structure

```
server/
  src/
    lib/          in-memory store, seed data, domain logic (balances, etc.)
    routers/      tRPC routers (auth, users, groups, expenses, settlements)
    index.ts      Express app entrypoint
client/
  src/
    routes/       page-level components (login, groups list, group detail)
    components/   UI components, incl. shadcn/ui primitives in components/ui/
    context/      current-user context
    lib/          tRPC client setup, formatting helpers
```

## Scripts

| Command                | Description                        |
| ----------------------- | ----------------------------------- |
| `npm run dev`           | Run API server and web app together |
| `npm run dev:server`    | Run just the API server             |
| `npm run dev:client`    | Run just the web app                |
| `npm run typecheck -w server` | Type-check the server           |
| `npm run build -w client`     | Production build of the web app |
| `npm test -w server`          | Run server tests                |
| `npm run test:coverage -w server` | Run server tests with coverage |
| `npm test -w client`          | Run client tests                |
