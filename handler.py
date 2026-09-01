"""AHM Worker contract example.

This is deliberately model-agnostic. Connect your actual video model/ComfyUI
workflow in `render_project`. The web app sends one project containing 5–6
continuous episodes and exact dialogue.
"""
import runpod, os, json

def render_project(project):
    # TODO: replace this with your actual Wan/ComfyUI/video-model pipeline.
    # Return public URLs after rendering/uploading each MP4 and SRT.
    raise RuntimeError("Connect your video model workflow in worker/handler.py before generating paid video jobs.")

def handler(job):
    inp=job.get("input",{})
    if inp.get("job_type") != "ahm_video_project":
        raise ValueError("Unsupported job_type")
    return render_project(inp["project"])

runpod.serverless.start({"handler": handler})
