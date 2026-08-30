# AHM Studio V3

This version fixes the screenplay parser problem.

## What it does now
- Preserves the user's original `SCENE 1`, `SCENE 2`, etc.
- Extracts LOCATION, ACTION and character dialogue.
- Keeps global STYLE and IMPORTANT constraints.
- Builds internal short generation shots without turning them into new story scenes.
- Calculates target duration from the selected final-video length.
- Shows character/voice/continuity locks.
- Mobile-friendly.
- Vercel-compatible.
- GPU generation remains disconnected until the RunPod worker is ready.

## Deploy
1. Upload these files to the GitHub repository root.
2. Commit to `main`.
3. Vercel redeploys automatically.
4. Open the site and paste your full screenplay.
5. Press **BUILD AI DIRECTOR PLAN**.

## Next GPU stage
Connect `/api/generate` to the RunPod worker and use the returned shot package to create clips, TTS, subtitles and an FFmpeg final MP4.
