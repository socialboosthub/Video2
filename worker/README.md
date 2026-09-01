# AHM Worker

The web app submits a single `ahm_video_project` payload to RunPod Serverless.
The worker contract is deliberately model-agnostic because the exact Wan/ComfyUI
workflow is not part of the V7 source bundle.

Before spending GPU credits, connect your actual video workflow inside
`handler.py`. Set `AHM_RENDERER=demo` to verify the RunPod endpoint contract
without rendering a video.
