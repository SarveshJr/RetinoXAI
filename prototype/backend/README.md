# RetinoXAI — MATLAB backend

Pure-MATLAB REST server that runs the RetinoXAI screening pipeline against the
trained ResNet-50 + EfficientNet-B5 ensemble and returns JSON to the React
clinician frontend.

The HTTP server is built on `java.net.ServerSocket` from the JVM that ships with
MATLAB, so **no MATLAB web toolbox (Production Server / Web App Server) is
required**. It runs fully offline on local hardware.

## Requirements

- MATLAB R2021b or newer
- Toolboxes: Image Processing, Computer Vision, Deep Learning,
  Statistics & Machine Learning (Medical Imaging Toolbox for the full U-Net)
- The trained models in `../main_model/ada/`:
  - `resnet50_processed_IDRiD_APTOS.mat`
  - `efficientnetB5_processed_IDRiD_APTOS.mat`

## Run

```matlab
cd prototype/backend
startServer            % http://localhost:8080  (Ctrl+C to stop)
% or: RetinoXAIServer(8080)
```

On start it loads and caches both backbones. If a model or toolbox is missing,
each stage falls back to a clearly-flagged deterministic estimate
(`inferenceMode: "estimate"`) so the server always returns a valid response.

## Endpoints

| Method | Path | Body | Returns |
|--------|------|------|---------|
| `GET`  | `/api/health` | — | engine status + frozen config |
| `POST` | `/api/screen` | `{ patient, eye, imageBase64 }` | full `ScreeningResult` |
| `POST` | `/api/signoff`| `{ id, finalGrade, note, reviewedBy }` | `{ ok: true }` |
| `GET`  | `/api/worklist` | — | `[]` (worklist is held client-side) |
| `GET`  | `/api/analytics` | — | digital-twin + validation metrics |
| `*`    | other paths | — | serves `../frontend/dist` when built |

`imageBase64` is a `data:image/...;base64,...` string. Every response carries
permissive CORS headers, and the frontend dev server proxies `/api` here.

`/api/screen` returns `original`, `enhanced`, `gradcam` and `segmentation` images
as base64 PNG data URLs — the frontend shows the **real MATLAB Grad-CAM++** when
they are present.

## Pipeline package (`+retinoxai`)

| File | Stage |
|------|-------|
| `frozenConfig.m` | Locked ensemble weights, threshold, metrics, model paths |
| `fundaQ8.m` | Stage 1 — 8-parameter quality score (0–16) |
| `preprocessFundus.m` | Stage 2 — illumination norm → CLAHE → anisotropic diffusion |
| `segmentStructures.m` | Stage 3 — lesion segmentation + per-quadrant counts |
| `ensembleGrade.m` | Stage 4/6 — weighted-softmax ensemble + temperature calibration |
| `icdrRuleEngine.m` | Stage 5 — ICDR 4:2:1 rule cross-check |
| `gradCAMpp.m` | Stage 8 — Grad-CAM++ heatmap overlay |
| `runPipeline.m` | Orchestrates all stages → `ScreeningResult` struct |
| `loadModels.m` | Loads & caches the `.mat` networks |
| `imToDataURL.m` | Encodes an image matrix as a base64 PNG data URL |

## Configuration

Model paths and the frozen ensemble config live in `+retinoxai/frozenConfig.m`.
Edit the `resnetModelFile` / `efficientNetModelFile` fields if your models are
elsewhere.

## Notes

- Single-threaded (one request at a time) — sufficient for camp-scale demo and
  for the Simulink-validated 40 patients/hour throughput.
- The `.mat` files store MATLAB `DAGNetwork`/`dlnetwork` objects, which execute
  only inside MATLAB — this is why the inference backend is MATLAB, per the
  problem statement's MATLAB pipeline requirement.
