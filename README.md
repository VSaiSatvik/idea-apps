# Idea Apps — five store-ready mobile apps + one backend

| App | Folder | Bundle ID | Platforms |
|---|---|---|---|
| AskOnce Circles | `apps/circles` | com.saisatvik.askoncecircles | Android + iOS |
| Wasl (invoice recovery) | `apps/wasl` | com.saisatvik.wasl | Android + iOS |
| Vouch Crawls | `apps/vouch` | com.saisatvik.vouchcrawls | Android + iOS |
| SideDesk | `apps/sidedesk` | com.saisatvik.sidedesk | Android + iOS |
| Family Shield | `apps/familyshield` | com.saisatvik.familyshield | Android (protection) · iOS (family member side) |

All five use one backend in `backend/` (Express + TypeScript).

## Run locally

```bash
cd backend && npm install && npm test && npm start        # API on http://localhost:8080
cd apps/circles && npm install
EXPO_PUBLIC_API_URL=http://YOUR-LAPTOP-IP:8080 npx expo start   # scan the QR with Expo Go
```

Family Shield's protection uses a custom Android module (`apps/familyshield/modules/shield-native`), so it needs a
development build (`eas build --profile development --platform android`) rather than Expo Go.

## Before launch

1. Deploy `backend/` (see `render.yaml`) and note its https URL.
2. Push this repo to GitHub as `idea-apps` and turn on Pages from the `/docs` folder.
3. `./fill-placeholders.sh https://your-api.onrender.com your-github-username you@example.com`
4. Per app: `npx eas-cli@latest init`, then `eas build --profile production`, then `eas submit`.

The full step-by-step guide is in the "Launch Guide" doc.

## Reviewer demo accounts (seeded on the server)

Password: value of `DEMO_PASSWORD` (default `ReviewDemo2026!` — change it in production).
`review@demo.app`, `venue@demo.app`, `creator@demo.app`, `business@demo.app`, `student@demo.app`, `admin@demo.app`
(put `admin@demo.app` in `ADMIN_EMAILS` so reviewers can see admin screens).

## Placeholders & helpers

- `apps/make-icons.py` — regenerates the placeholder icons (swap in designed icons when you have them).
- `docs/build.py` — regenerates privacy + support pages.
