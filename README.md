# AHM Studio V4

This package is a rebuilt frontend/director prototype for AHM Studio.

## What is actually working now

- Proper screenplay parsing with original SCENE headings preserved.
- Dialogue extraction separated from action.
- No fake conversion of every line into a story scene.
- Internal GPU shots are production units, not story scenes.
- Character Library saved in browser localStorage.
- Edit/delete saved characters.
- Add saved characters to a project.
- Mobile-first interface.
- 9:16 / 16:9 / 1:1.
- 1–10 minute target.
- Duration allocation weighted by action/dialogue rather than blindly dividing equally.
- Director plan contains continuity locks and GPU shot map.
- Generation API gateway prepared for a real GPU worker.
- Settings page contains a place to enter credentials for development, while the recommended production method is Vercel Environment Variables.

## IMPORTANT ABOUT REAL VIDEO GENERATION

The browser and Vercel serverless function cannot magically generate a 4-minute AI movie by themselves. A GPU worker is still required.

When funded, deploy a worker that exposes:

POST / -> { status:"queued", jobId }
GET /?jobId=... -> { status:"running", progress:50, message:"...", videoUrl:"..." }

Set these Vercel Environment Variables:

AHM_WORKER_URL=https://your-worker-endpoint
AHM_WORKER_TOKEN=your-secret-token

Do not put a RunPod/private API key into public client JavaScript.

## Suggested worker pipeline

1. Receive AHM project + director plan.
2. Generate or retrieve locked character references.
3. Generate shot clips with the selected video model.
4. Use image/video conditioning to preserve characters where supported.
5. Generate character dialogue/TTS.
6. Mix dialogue, music and SFX.
7. Assemble shots in exact story order with FFmpeg.
8. Burn subtitles if requested.
9. Upload final MP4 to object storage.
10. Return a download URL.

The exact video model and GPU settings should be selected after checking the current model requirements and the rented GPU's VRAM. Do not pay for a long run until a short end-to-end test succeeds.

## Deployment

Upload the files to the GitHub repository root (keep api/generate.js at api/generate.js), connect the repo to Vercel, and deploy.


## Director Trial
TRY DIRECTOR FREE opens a local planning-only trial. It does not call the GPU or consume API credits. Copy the result and send it for review.
