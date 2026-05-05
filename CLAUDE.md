# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Dev server with Turbopack → http://localhost:3000
npm run build     # Production build
npm run lint      # ESLint (next lint)
npm run start     # Production server (after build)
```

No test framework is configured.

## Environment

```env
NEXT_PUBLIC_API_URL=https://api-dispense.hpk-hms.site   # Backend REST API base
NEXT_PUBLIC_SUPABASE_URL=...                             # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...                        # Supabase anon key
```

For local dev, `next.config.mjs` falls back `API_URL` to `http://localhost:3001`.

## Architecture

**Pure frontend** — Next.js 14 App Router (`use client` on every page), connecting to a
separate backend (`api-dispense.hpk-hms.site`). No server actions or API routes.

### HTTP & API layer — `lib/api.ts`

Single Axios instance (`baseURL = ${NEXT_PUBLIC_API_URL}/api`, 15 s timeout).
All API calls go through domain-grouped objects exported from this file:

| Export | Domain |
|--------|--------|
| `drugApi` | Drug inventory `/drugs/*` |
| `stockApi` | Stock transactions `/stock/*` |
| `dispenseApi` | Prescription dispensing `/dispense/*` |
| `registryApi` | Medical registries `/registry/*` |
| `crudApi` | Generic CRUD for all registries |
| `patientApi` | Patient data `/patients/*` |
| `queueApi` | Queue management `/queue/*` |
| `reportApi` / `extraReportApi` | Reports `/reports/*` |
| `exportApi` | Excel/PDF download URLs |
| `alertApi` | Drug alerts `/alerts/*` |
| `dashboardApi` | Dashboard KPIs `/dashboard/*` |

### Auth — `lib/auth.tsx`

`AuthProvider` wraps the app; `useAuth()` returns the current user.

- **Dev**: localStorage token + backend `/auth/login`
- **Prod**: Supabase JWT in cookies (validated by `middleware.ts`)

`AuthUser` shape: `{ id: uuid, email, role_id, role_name, departments, systems }`

The token is set on `api.defaults.headers.common['Authorization']` at login.

### Shared UI components — `components/`

| Component | Purpose |
|-----------|---------|
| `DataTable` | Reusable paginated table — takes `cols: ColDef[]` and `fetcher: (params) => Promise<{data, total}>` |
| `SearchSelect` | Autocomplete for `patient` / `drug` / `user` / `subwarehouse` types |
| `CrudModal` | Standard create/edit modal wrapper |
| `DetailDrawer` | Slide-out detail panel |
| `ui.tsx` | Design system primitives (Button, Input, Badge, Modal, …) |

### Page pattern

Every page is `'use client'` and follows this structure:

1. `const { user } = useAuth()` — get current user for default form values and auth headers
2. `registryApi.*` / `crudApi.*` calls for data, wrapped in `useState` + `useEffect`
3. `<DataTable cols={...} fetcher={...} />` for listing
4. `<CrudModal>` + `<SearchSelect>` for create/edit forms
5. `toast.success / toast.error` for feedback

### Utilities

- `lib/dateUtils.ts` — Thai date formatting
- `lib/drugUtils.ts` — Drug validation helpers
- `lib/supabase.ts` — Supabase client (SSR-safe)

### Styling

Tailwind CSS 3.4 with custom theme in `tailwind.config.js`:
Thai fonts (IBM Plex Sans Thai / Mono), medical color palette.
