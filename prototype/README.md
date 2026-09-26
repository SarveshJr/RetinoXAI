# RetinoXAI — Explainable AI for Diabetic Retinopathy Screening

**Smart India Hackathon 2026 · Problem SIH26038 · Team HACK PROCESSING UNIT (SIH26-A0H-T316)**

A finale-grade prototype of the RetinoXAI clinician platform: a doctor-facing
web application backed by a **pure-MATLAB** inference engine that runs the full
9-stage DR screening pipeline (FundaQ-8 → adaptive enhancement → U-Net
segmentation → ResNet-50 + EfficientNet-B5 ensemble grading → ICDR 4:2:1 rule
engine → temperature-scaled confidence → validate & flag → Grad-CAM++ →
auto-report), with a MATLAB–Simulink digital twin for throughput planning.

```
prototype/
├── frontend/     React + TypeScript clinician platform (Vite)
├── backend/      Pure-MATLAB REST server + pipeline package (+retinoxai)
└── README.md     (this file)
```

---

## What the judges see

| Screen | What it demonstrates |
|--------|----------------------|
| **Dashboard** | Live camp KPIs, grade distribution, session throughput, cost saving, validated model metrics |
| **New Screening** | Upload/select a fundus → animated 9-stage pipeline → grade + calibrated confidence + Grad-CAM++ + rule cross-check |
| **Case Review** | Layered fundus viewer (original / enhanced / segmentation / Grad-CAM++), ensemble distribution, FundaQ-8 breakdown, ICDR 4:2:1 quadrant map, lesion evidence, **doctor sign-off** (human-in-the-loop), printable report |
| **Worklist** | Priority-sorted patient queue (referable first), filters, teleconsult referral |
| **Analytics** | MATLAB–Simulink digital twin (40 patients/hr, ~320/8h, 100s sequential: 10s AI + 90s doctor review), bandwidth/connectivity model, district-scale planner (100k+/yr), confusion matrix, ensemble-vs-single ablation, weight/threshold tuning |
| **Pipeline & Model** | Full architecture, ensemble composition, datasets, MATLAB toolboxes, frozen config |

The interface also ships a ⌘K command palette (navigate + patient search), animated
metric counters, page transitions and full light/dark theming.
| **Settings** | Theme, report language, offline-first, referable threshold, DPDP/CDSCO compliance posture |

Frozen validated metrics shown throughout (Iteration 2, internal test):
**93.13 % referable sensitivity · 94.27 % specificity · 81.34 % 5-class accuracy**
(ResNet-50 0.35 / EfficientNet-B5 0.65, referable threshold 0.37).

---

## Running it

### 1. Frontend (always works, standalone)

```bash
cd prototype/frontend
npm install
npm run dev
```

Open `http://localhost:5173`. If the MATLAB backend is not running, the app
transparently uses a **deterministic clinical simulation** (frozen ensemble
config) so every screen is fully demonstrable. A status pill in the top bar
shows whether inference is **live (MATLAB engine)** or **demo simulation**.

### 2. Backend (pure MATLAB — real model inference)

```matlab
% In MATLAB, from the repository:
cd prototype/backend
startServer          % listens on http://localhost:8080
```

Requirements: MATLAB R2021b+ with Image Processing, Computer Vision, Deep
Learning and Statistics & ML toolboxes. It loads the trained `.mat` models from
`../main_model/ada/` and runs the real pipeline. The Vite dev server already
proxies `/api` → `http://localhost:8080` (see `frontend/vite.config.ts`), so
with both running the frontend uses live MATLAB inference. See
[`backend/README.md`](backend/README.md) for endpoints and model wiring.

> The backend never needs an internet connection — it is **offline-first** by
> design for ambulance and remote-camp deployment.

---

## Architecture

```
 Doctor's browser                     MATLAB engine (offline, on local hardware)
┌────────────────────┐   /api (JSON)  ┌───────────────────────────────────────┐
│ React clinician app │ ─────────────▶ │ RetinoXAIServer (java.net.ServerSocket)│
│  · worklist         │ ◀───────────── │  └─ +retinoxai.runPipeline             │
│  · Grad-CAM++ viewer│   base64 imgs  │       FundaQ-8 · enhance · U-Net ·     │
│  · sign-off         │                │       ensemble · 4:2:1 · Grad-CAM++    │
└────────────────────┘                │     (resnet50 / efficientnetB5 .mat)   │
                                       └───────────────────────────────────────┘
```

The frontend is resilient: unreachable backend → labelled demo simulation;
reachable backend that lacks a model or toolbox → the pipeline returns a clearly
flagged deterministic estimate instead of failing.

---

## Frontend tech stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Radix UI primitives (shadcn
pattern) · Recharts · Framer Motion · react-dropzone · Zustand · lucide-react ·
sonner. Clinical design system with light/dark themes, WCAG-AA contrast, ICDR
grade colour scale, and full loading/empty/error states.

## Backend tech stack

Pure MATLAB. HTTP served via the JVM bundled with MATLAB (`java.net.ServerSocket`)
— no web toolbox required. Pipeline in the `+retinoxai` package. Toolboxes:
Image Processing, Computer Vision, Deep Learning, Medical Imaging, Statistics &
ML, Simulink (SimEvents for the digital twin).

---

## Mapping to the problem statement

1. **Image quality assessment & enhancement** — FundaQ-8 gate + illumination
   normalization / CLAHE / anisotropic diffusion, with recapture feedback.
2. **Retinal structure segmentation** — multiclass U-Net (disc, fovea, vessels,
   MA, haemorrhage, exudate, NV) + **sub-pixel Hessian** MA detection + B0 verifier.
3. **DR severity grading** — ICDR 0–4, >90 % sensitivity / >85 % specificity for
   referable DR (achieved 93.13 % / 94.27 %). Ablation shows the ensemble
   outperforms either backbone alone (Expected-Solution requirement).
4. **Explainability** — Grad-CAM++ maps, lesion-level evidence tied to ICDR
   criteria, calibrated confidence, annotated auto-report, <30 s doctor review.
5. **Simulink workflow simulation** — digital twin covering acquisition rates,
   **bandwidth constraints** (offline-first buffer + sync), processing throughput
   and review capacity, with a **district-scale planner** optimising resource
   allocation for 100,000+ patients/year (40 patients/hr, ~320 per 8-hour session; 10s AI + 90s doctor review = 100s total sequential).
