# AHM Studio V7.1 — Clean Replacement

AHM Studio is a screenplay-first AI film director for 9:16 short-form movies.

## What is fixed

- The old V7 placeholder plan/generate endpoints are replaced with real JSON API routes.
- API 404s are JSON, not HTML, preventing browser errors such as `Unexpected token 'T'`.
- Settings has a working close button and stores the RunPod key server-side only.
- Building the Director plan never calls RunPod.
- Generate is the only paid action and requires a saved API key.
- RunPod Serverless uses the documented `/run`, `/status/<job-id>`, and `/health` operations.
- The screenplay parser preserves explicit SCENE blocks, exact dialogue, character bible data, continuity, emotion and sound.
- Production coverage is compact: a scene becomes a small number of cinematic GPU shots instead of one shot per sentence.
- Scenes are grouped into 5 or 6 continuous parts without inventing story events.
- Exact dialogue can be exported as SRT per episode.
- Drafts are stored under `data/projects/` locally.
- A direct HTTP worker mode is included for a custom worker/Pod endpoint.

## Run locally

1. Install Node.js 18+.
2. Copy `.env.example` to `.env`.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.
6. Paste your screenplay and press **BUILD DIRECTOR PLAN**.

No RunPod key is needed for steps 1–6.

## RunPod

For Serverless mode, save the RunPod API key and Endpoint ID in Settings. The
server stores the key and never returns it through `/api/settings`.

The official RunPod Serverless API uses:

- `POST https://api.runpod.ai/v2/<endpoint-id>/run`
- `GET https://api.runpod.ai/v2/<endpoint-id>/status/<job-id>`
- `GET https://api.runpod.ai/v2/<endpoint-id>/health`

The worker must contain your actual video generation workflow. The included
worker is a contract-safe adapter; it does not pretend to render video without
a configured model/workflow.

## GitHub / Vercel note

The project can be deployed as a normal Node/Express service. Do not commit
`.env` or `data/settings.json`. For a public deployment, use platform
environment variables (`RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`) instead of
file-based secret storage.
