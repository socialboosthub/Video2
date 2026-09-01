"""AHM Studio V7.1 RunPod Serverless worker contract.

This handler is intentionally model-agnostic. A RunPod endpoint must have a
real video workflow (for example a ComfyUI/Wan workflow) behind it. The web
app sends one structured project with 5-6 continuous parts, exact dialogue,
character locks and subtitle requirements.

Set AHM_RENDERER=demo only if you want to test the endpoint contract without
rendering video. Demo mode returns a JSON manifest and NEVER creates video.
For paid rendering, replace render_project() with your actual GPU workflow.
"""
import os
import runpod


def render_project(project):
    if os.getenv("AHM_RENDERER", "").lower() == "demo":
        return {
            "ok": True,
            "mode": "demo",
            "message": "AHM contract accepted. No video was rendered in demo mode.",
            "episodes": [
                {"episode": e["episode"], "title": e["title"], "duration": e["duration"], "status": "accepted"}
                for e in project.get("episodes", [])
            ],
        }
    raise RuntimeError(
        "AHM worker is connected but no video renderer is configured. "
        "Attach your ComfyUI/Wan workflow in worker/handler.py before paid generation."
    )


def handler(job):
    inp = job.get("input") or {}
    if inp.get("job_type") != "ahm_video_project":
        raise ValueError("Unsupported job_type")
    project = inp.get("project")
    if not isinstance(project, dict):
        raise ValueError("Missing project payload")
    return render_project(project)


runpod.serverless.start({"handler": handler})
