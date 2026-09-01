# AHM Studio V7

A screenplay-first AI film web app. It replaces the fragile trial director with a production director that:
- parses explicit SCENE blocks;
- keeps dialogue exact;
- creates compact GPU shot plans instead of exploding every line into a useless shot;
- groups scenes into continuous Part 1–6 episodes;
- creates SRT subtitles from exact dialogue;
- saves projects and character data locally on the server;
- keeps the RunPod API key server-side and never sends it to browser JavaScript;
- submits one structured `ahm_video_project` job to a RunPod Serverless endpoint.

## Run locally
1. Install Node 18+.
2. Copy `.env.example` to `.env`.
3. `npm install`
4. `npm start`
5. Open `http://localhost:3000`.

You can paste the RunPod key and endpoint ID into Settings. The key is stored server-side in `data/settings.json` and is never returned by `/api/settings`. For a deployed service, prefer platform environment variables instead of file storage.

## Important worker contract
The web app sends:

```json
{
  "input": {
    "job_type": "ahm_video_project",
    "director_version": "7",
    "project": {
      "episodes": [
        {"episode":1,"title":"Part 1","duration":40,"scenes":[...]}
      ],
      "format":"9:16",
      "subtitles":true
    }
  }
}
```

Your RunPod worker must accept this contract and return either:

```json
{"episodes":[{"episode":1,"video_url":"https://...","subtitle_url":"https://..."}]}
```

or any JSON object your worker defines. The UI will display the returned job ID and result JSON. This is intentional: the director cannot know the exact model/workflow inside your RunPod endpoint. The endpoint must be configured to render video.

## Cost safety
The Director button only creates the plan locally. It does not call RunPod. The Generate button is the only action that submits a paid job. RunPod's `/run` is asynchronous and is intended for long-running jobs; job status is polled with `/status`. See the official docs for the exact endpoint behavior.
