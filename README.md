# AHM Studio
Mobile-first AI story video generator.

## V1
Story editor, character designer, video settings, scene planner, development rendering queue and production-plan download.

## Development mode
The render button currently simulates generation. No GPU credits are required.

## Production architecture
AHM Studio → Vercel API → RunPod → ComfyUI → Wan → FFmpeg → final MP4.

## Deploy
Import this GitHub repository into Vercel and deploy with defaults.

Never put secret API keys in frontend JavaScript. Use Vercel Environment Variables or the GPU worker.
