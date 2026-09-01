# AHM RunPod Worker

This worker implements the AHM Studio contract.

## Demo mode

Set:

    AHM_WORKER_MODE=demo

The worker validates the project and returns a manifest. No video is rendered and no model is loaded.

## Production mode

Set:

    AHM_WORKER_MODE=production

Then replace `render_project()` with the actual video workflow.

The project arrives as:

{
  "job_type": "ahm_video_project",
  "director_version": "8.0",
  "project": { ...director plan... }
}

The worker can then call your ComfyUI/Wan pipeline and return URLs/metadata for the rendered assets.
