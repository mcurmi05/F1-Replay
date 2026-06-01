# F1 Replay

A dashboard for replaying live and past Formula 1 sessions: live timing, track maps, tyre strategy and lap-by-lap telemetry, powered by the [OpenF1 API](https://openf1.org).

## Tech stack

- Vite + React + TypeScript
- Tailwind CSS v4
- React Router

## Getting started

```bash
npm install
npm run dev
```

The development server runs at http://localhost:5173

## Scripts

- `npm run dev` - start the development server with hot reloading
- `npm run build` - type-check and build for production
- `npm run preview` - serve the production build locally
- `npm run lint` - run ESLint

## Routes

- `/home` - landing page with the latest session and a historical session browser
- `/live` - live session view
- `/replay/:sessionKey` - replay a specific session
