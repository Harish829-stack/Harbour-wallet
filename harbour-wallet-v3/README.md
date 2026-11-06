# Harbour Wallet v3

| Path | What it is |
| --- | --- |
| `apps/extension/` | The Chrome MV3 extension. See its README |
| `apps/backend/` | The Go backend (nine services). See its README |
| `infra/railway/` | Railway config-as-code files, one per service. Guide: `documentation/harbour-v3/operations/railway-deployment.md` |

The extension talks only to the backend API (`VITE_HB_API_URL`); the backend holds every third-party provider key.
