import runpod
import json
import urllib.request
import urllib.parse
import time
import os

# ComfyUI runs locally inside the RunPod container on port 8188
COMFY_SERVER = "http://127.0.0.1:8188"

def queue_workflow(workflow):
    """Sends the workflow JSON to ComfyUI for processing."""
    data = json.dumps({"prompt": workflow}).encode('utf-8')
    req = urllib.request.Request(f"{COMFY_SERVER}/prompt", data=data)
    response = urllib.request.urlopen(req)
    return json.loads(response.read())

def check_status(prompt_id):
    """Polls ComfyUI to see if the video is finished."""
    req = urllib.request.Request(f"{COMFY_SERVER}/history/{prompt_id}")
    response = urllib.request.urlopen(req)
    return json.loads(response.read())

def handler(job):
    """The main entry point that RunPod triggers when Express sends a job."""
    job_input = job.get('input', {})
    project = job_input.get('project', {})
    scenes = project.get('scenes', [])
    
    if not scenes:
        return {"error": "No scenes found in the AHM Director plan."}

    print(f"🎬 Incoming Job: Generating {len(scenes)} scenes...")

    # 1. LOAD YOUR BASE WORKFLOW
    # with open('workflow_api.json', 'r') as f:
    #     workflow = json.load(f)
    
    # 2. INJECT PROMPTS FROM YOUR PLAN
    # Example: workflow["3"]["inputs"]["text"] = scenes[0]["shots"][0]["visualPrompt"]

    # 3. QUEUE IN COMFYUI
    # queued_job = queue_workflow(workflow)
    # prompt_id = queued_job['prompt_id']
    
    # 4. WAIT FOR COMPLETION
    # (In reality, you'd loop and sleep here until check_status(prompt_id) returns the file)
    
    # 5. UPLOAD TO CLOUD STORAGE (AWS S3, Cloudflare R2, etc.)
    # video_url = upload_to_s3("output.mp4")

    # 6. RETURN SUCCESS TO EXPRESS
    return {
        "status": "COMPLETED",
        "message": "Render finished successfully.",
        "videoUrl": "https://your-storage-bucket.com/final-video.mp4" 
    }

# Start the Serverless handler
runpod.serverless.start({"handler": handler})
