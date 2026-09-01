# AHM Studio V8

AHM Studio is a screenplay-first episodic AI film director.

## What this version does

- Parses explicit screenplay scenes.
- Locks characters, dialogue, continuity and production constraints.
- Creates a cinematic shot plan.
- Creates subtitle SRT files.
- Saves projects locally when the server filesystem is persistent.
- Connects securely to a RunPod Serverless endpoint through server-side environment variables.
- Includes a `demo` worker mode for testing the complete RunPod request/status pipeline without spending GPU credits.

## Important: actual video rendering

The web app is a gateway/director. RunPod must have a real video-generation worker behind the endpoint.

The included worker is deliberately safe in `demo` mode. It validates the AHM payload and returns a manifest. It does NOT generate video.

For real video generation, connect your chosen ComfyUI/Wan workflow to `worker/handler.py` and deploy that worker as the RunPod endpoint.

## Render deployment

Create a Render Web Service from this repository.

Build command:

    npm install

Start command:

    npm start

Health check:

    /api/health

Add these environment variables in Render:

    RUNPOD_API_KEY=your_real_key
    RUNPOD_ENDPOINT_ID=your_endpoint_id
    AHM_WORKER_MODE=demo

Do not put the RunPod key in GitHub or in public JavaScript. Render environment variables are intended for secrets.

## First test — no GPU charge

1. Deploy the web service.
2. Leave `AHM_WORKER_MODE=demo`.
3. Open the app.
4. Load the Golden Fish test.
5. Click BUILD DIRECTOR PLAN.
6. Click TEST RUNPOD CONNECTION.
7. If the endpoint and worker are correctly deployed, the test job should complete and show the demo manifest.

## Production rendering

After the demo contract works:

1. Deploy a real video worker to RunPod.
2. Set `AHM_WORKER_MODE=production` on the RunPod worker.
3. Set the same endpoint ID in Render.
4. Run one short test generation.
5. Only then increase duration/parts/GPU settings.

## Architecture

Browser
  -> Render /api/director/plan
  -> Render /api/generate
  -> RunPod Serverless /run
  -> AHM worker
  -> video workflow
  -> RunPod /status/{jobId}
  -> Render
  -> Browser

## Security

The RunPod API key is read only by `server.js` from `RUNPOD_API_KEY`.
It is never sent to the browser.

Render's filesystem should not be treated as permanent storage. For durable projects, connect a database/object storage later.
