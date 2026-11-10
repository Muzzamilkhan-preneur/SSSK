# SSSK

Saaf Sarak is a mobile app with a backend: **FastAPI with Firestore and Supabase Storage**
behind an **Expo + expo-router** app in strict TypeScript. The app runs as a
web preview in the browser, in Expo Go on a phone, and as a native build.
The citizen, Mayor, and contractor report lifecycle is implemented end to end.

Versions are not written down here. Every package is at whatever
`package.json` pins; open that file only when a version actually matters.

## Layout

```
expo/
  backend/   FastAPI + Firebase Admin (Firestore) + Supabase Storage + Pydantic v2
  frontend/  Expo + expo-router (file-based routes under app/)
  tests/     optional backend pytest package
```

## Running

Supervisor runs everything in the pod (see "Pod conventions"). By hand, from
two terminals:

```bash
cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload   # http://localhost:8001
cd frontend && yarn expo start --port 3000                             # web preview + Expo Go QR
```

### Firebase configuration

Create a Firebase project with Firestore enabled and a Supabase project with a
private Storage bucket named `saaf-sarak`. Download the Firebase service-account
JSON and set these backend environment variables:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account", "...":"..."}
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_STORAGE_BUCKET=saaf-sarak
OPENAI_API_KEY=your-openai-api-key
```

Keep the service-account JSON and API key in the hosting provider's secret
store. Never commit them. The mobile app only needs the public
`EXPO_PUBLIC_BACKEND_URL`.

## How the app reaches the backend

Every backend route lives under `/api`, because the backend mounts one
`APIRouter(prefix="/api")`. During local development, the frontend and backend run on separate ports.
In production, the frontend calls the Render backend directly through
`EXPO_PUBLIC_BACKEND_URL`.

The app reads that URL from `EXPO_PUBLIC_BACKEND_URL` in its `.env` (filled in
by the platform) and calls `EXPO_PUBLIC_BACKEND_URL + "/api/..."`. The URL has
to be absolute because the same bundle runs on a phone in Expo Go, where a
relative `/api` has nothing to reach. So: never `localhost`, never a port,
never a relative path. Only `EXPO_PUBLIC_*` names are visible to the app, and
Metro bakes their values in at bundle time, so a `.env` change takes effect
only after you restart the Metro program (`expo`).

## Backend

FastAPI, async throughout. The venv is `/root/.venv` (`python` on PATH);
dependencies come from `backend/requirements.txt`.

- **Entry point.** `backend/server.py` creates `app`, creates
  `api_router = APIRouter(prefix="/api")`, registers routes **on the router**,
  then calls `app.include_router(api_router)`. CORS allows the local web preview
  and deployed frontend origins. Never attach a
  route to `app` directly; it lands outside `/api` and the phone cannot reach
  it.
- **The route pattern.** Copy the `status` route: a Pydantic model for the
  body and one for the response (`StatusCheckCreate`, `StatusCheck`), an
  `async def` handler decorated with
  `@api_router.post("/status", response_model=StatusCheck)`, and an awaited
  Firestore call inside. FastAPI validates the body before your handler runs; a bad
  body gets an automatic `422` with `{"detail": [...]}`.
- **Growing.** When `server.py` gets crowded, move models to `backend/models/`
  and routes to `backend/routers/`, one module per resource, each exporting an
  `APIRouter` that `server.py` mounts with `api_router.include_router(...)`.
- **Firebase/Supabase.** `server.py` uses `FirestoreDatabase` for app data and
  Supabase Storage for uploaded images. Configure both providers' secrets in
  `backend/.env`;
  importing `server` remains lazy until a database or storage call.
- **Ids.** Documents use a string `id` from `uuid4`, not `ObjectId`, which
  cannot be turned into JSON. Keep the `uuid4` default-factory pattern and
  leave `_id` out of every response.
- **Config.** `backend/.env` holds Firebase service-account configuration and
  `OPENAI_API_KEY`, loaded with `python-dotenv`.
- **AI dispatch demo.** The mayor queue links to a 100-report synthetic
  simulation. `POST /api/mayor/dispatch-demo/run` sends only generated report
  text to the configured model; it does not read or write Firestore. Expected
  incident labels are kept out of the model input and used only to score its
  grouping results. Crew assignments are capacity-checked suggestions using
  simulated crews, never real contractor assignments. Each run makes one model
  request and returns provider token usage when available. Repeated requests
  reuse a five-minute, process-local cache to avoid duplicate model charges.
  The cache is not access control or a shared quota; keep this endpoint on a
  trusted test deployment until server-side mayor authentication and shared
  rate limits are available.
- **Dates.** Store aware UTC (`datetime.now(timezone.utc)`, never `utcnow()`).
- **Quick check.** `cd backend && python -c 'import server'` catches
  syntax and import errors without waiting for the supervisor log.

## Frontend

- The app is built with Expo, React Native and React, written in strict
  TypeScript. The version is as per mentioned in `package.json`. Check there
  if it matters. Metro, the dev server, listens on port `3000` and
  does two jobs at once: it serves the web preview you see in the browser, and
  it serves the manifest that Expo Go downloads when a phone scans the QR
  code. The import alias `@/*` points at the root of the app folder, so
  `@/src/theme` means `frontend/src/theme.ts`.
- **Routing** is expo-router, file-based: every file under `app/` is a screen
  (`app/profile/settings.tsx` is `/profile/settings`), `_layout.tsx` files
  define navigators, typed routes are on. Non-screen code (components, hooks,
  the API module, utilities) goes under `src/`. `app/index.tsx` is a
  placeholder; replace it.
- **Root layout.** `app/_layout.tsx` wraps the app in `ErrorBoundary` →
  `QueryClientProvider` → `KeyboardProvider` → `<Stack>`. Keep those when you
  rewrite it; add your route groups and login gating inside the `Stack`.
- **Theme.** `src/theme.ts` holds the color tokens (keys match the `color`
  block of `/app/design_guidelines.json`), `useTheme()` and `makeStyles()`.
  Every color in a `.tsx` file comes from it; see `TEMPLATE.md` §5.
- **Storage.** `import { storage } from "@/src/utils/storage"`: `getItem`,
  `setItem`, `removeItem` for ordinary data; `secureGet`, `secureSet`,
  `secureRemove` for tokens. Never import AsyncStorage, SecureStore, MMKV or
  `expo-sqlite/kv-store` directly.
- **Uploads.** `import { uploadForm } from "@/src/utils/upload"` for every
  file upload: `uploadForm(url, { fields, files: { image: { uri, name, mimeType } } })`.
  Never append `{ uri, name, type }` to a `FormData` yourself and never set
  `Content-Type`; that passes in the web preview and throws
  `Unsupported FormDataPart implementation` on a phone (see `TEMPLATE.md` §9).
- **Data.** TanStack Query is wired (`src/query-client.ts`, provider in the
  root layout). Use `useQuery` and `useMutation` against one typed API module
  (`src/api.ts`, see `TEMPLATE.md` §4), not fetch inside `useEffect`. Nothing
  generates types across the Python boundary: write a TypeScript interface
  mirroring each Pydantic model and change both in the same edit.
- **Error boundary.** `src/components/error-boundary.tsx` is mounted once at
  the root; a render crash shows a reload screen instead of a blank app. Do not
  add more.
- **testIDs.** `constants/testIds/` is the registry (`auth.js` ships); one file
  per feature, re-exported from `index.js`. React Native uses `testID`, with
  kebab-case values by role.
- **`app.json`** is yours: name, slug, scheme, icon/splash, plugins,
  permissions. `ios.bundleIdentifier` and `android.package` are set by the
  platform; leave them unless the user asks.
- **Packages.** `yarn expo install <package>` for SDK-matched versions. Never
  npm; avoid plain `yarn add` for Expo/RN packages. The `preinstall` guard
  refuses `expo-av`, `expo-barcode-scanner`, `expo-background-fetch` and
  `expo-file-system/legacy`.

## TypeScript

`tsconfig.json` extends `expo/tsconfig.base` with `strict: true`. In the pod:

```bash
cd /app/frontend && yarn tsc --noEmit
```

Metro only transpiles, so this is the only place type errors show up. Lint
with `yarn lint` from the same directory (`expo lint`).

## When the build is complete (tier 1)

Run three checks once, in the same turn: a curl smoke over the key `/api`
endpoints through `EXPO_PUBLIC_BACKEND_URL` (status plus one field, and one
request that should fail); `yarn tsc --noEmit` from the app dir; and one
happy-path walk through the core journey on the web preview at a phone
viewport. All clean → restart Metro and finish. Any failure is a real bug: fix
it, re-run that check, then hand over to the testing subagent. No typecheck,
lint or smoke passes while still building; tier 1 runs exactly once.

## Testing

**Backend (pytest).** Specs in `tests/` at the template root as `test_*.py`.
The ini lives in `backend/`, so pass it explicitly or its settings are skipped:

```bash
cd /app && pytest -c backend/pytest.ini tests
```

`backend/pytest.ini` sets `addopts = -n 2 --dist loadscope`, so tests already
run in parallel; do not pass your own `-n`. Serial is `-n 0`, never
`-p no:xdist` (it errors, because `addopts` still passes `-n`). Tests hit the
live uvicorn process on `8001`, the same app the preview shows.

The dispatch simulation tests are self-contained and use no database or model
API calls:

```bash
cd backend
python -m pytest -q tests/test_dispatch_demo_data.py tests/test_dispatch_agent.py tests/test_dispatch_decisions.py
```

**Frontend (web preview).** The testing subagent drives `http://localhost:3000`
with Playwright at a phone viewport and writes
`/app/test_reports/iteration_N.json`. It cannot open Expo Go, so native-only
chrome (native tabs, SF Symbols, permission prompts) is checked by following
`TEMPLATE.md` §6 to §8, not by screenshot. Give it every login through
`memory/test_credentials.md`.

## Deployment

Deploy the FastAPI backend to your chosen host and configure the Firebase
service-account and `OPENAI_API_KEY` secrets there. Set
`EXPO_PUBLIC_BACKEND_URL` to the backend's public HTTPS URL before building the
mobile app. Use your own Expo/EAS account to generate the Android APK.
