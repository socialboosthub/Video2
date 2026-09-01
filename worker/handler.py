"""AHM Studio V8 RunPod Serverless worker.

Demo mode is intentionally non-rendering. It verifies that the web app,
RunPod endpoint and worker contract are connected before GPU money is spent.

Production mode is the integration point for the actual ComfyUI/Wan/video
workflow chosen by the project owner.
"""
import os
import runpod


def validate_project(project):
    if not isinstance(project, dict):
        raise ValueError("project must be an object")
    if not project.get("episodes"):
        raise ValueError("project has no episodes")
    if not project.get("characters"):
        # Character-free projects are technically possible, so this is a warning
        # rather than a hard failure.
        pass


def render_project(project):
    mode = os.getenv("AHM_WORKER_MODE", "demo").lower()

    validate_project(project)

    if mode == "demo":
        return {
            "ok": True,
            "mode": "demo",
            "message": "AHM worker contract accepted. No video was rendered.",
            "directorVersion": project.get("version", "unknown"),
            "format": project.get("format"),
            "targetLength": project.get("targetLength"),
            "episodes": [
                {
                    "episode": e.get("episode"),
                    "title": e.get("title"),
                    "duration": e.get("duration"),
                    "scenes": len(e.get("scenes", [])),
                    "status": "accepted",
                }
                for e in project.get("episodes", [])
            ],
        }

    if mode != "production":
        raise RuntimeError(
            "Unsupported AHM_WORKER_MODE. Use demo or production."
        )

    # ---------------------------------------------------------------
    # PRODUCTION INTEGRATION POINT
    # ---------------------------------------------------------------
    # Connect your actual ComfyUI/Wan/video workflow here.
    #
    # The AHM Director has already prepared:
    #   project["characters"]
    #   project["global"]
    #   project["episodes"][...]["scenes"]
    #   scene["shots"]
    #   exact scene dialogue
    #
    # Do not pretend a video exists unless your renderer actually created it.
    raise RuntimeError(
        "Production worker is enabled, but no video renderer is connected. "
        "Attach your real ComfyUI/Wan workflow in render_project() first."
    )


def handler(job):
    inp = job.get("input") or {}

    if inp.get("job_type") != "ahm_video_project":
        raise ValueError("Unsupported job_type")

    project = inp.get("project")
    return render_project(project)


runpod.serverless.start({"handler": handler})
