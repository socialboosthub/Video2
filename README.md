# AHM Studio V6

A mobile-friendly screenplay-to-production-plan studio for AHM Studio.

## V6 fixes
- Section-aware screenplay parser: LOCATION, ACTION, DIALOGUE, EMOTION, CAMERA, SOUND, CONTINUITY.
- Every scripted dialogue line is retained as a production shot.
- Character library is saved in browser localStorage and can be edited/deleted.
- Story scenes are not artificially split into fake 6-second story scenes.
- Internal production shots are generated from actual story beats.
- Continuity locks are attached to every scene.
- Trial mode performs no network/API/GPU calls.
- API keys are not stored in public HTML.
- GPU generation is deliberately disabled until a secure server-side adapter is configured.

## GitHub / Vercel
For a static trial, deploy `index.html` directly. For the included Express server, use a Node deployment. Do not commit real API keys. Put secrets in deployment environment variables.
