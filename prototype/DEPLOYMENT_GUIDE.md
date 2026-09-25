# RetinoXAI — Setup & Deployment Guide (run on another system)

This guide takes the RetinoXAI prototype from **zero to running** on a fresh
machine: what to copy, what to install, how to start the MATLAB backend and the
React frontend, and — at every step — the mistakes people usually make and how
to fix them.

The app has two parts that run **at the same time**:

```
  Browser  ──►  Frontend (Vite/React, port 5173)  ──/api──►  Backend (MATLAB, port 8080)
                                                             └► ResNet-50 + EfficientNet-B5 (.mat)
```

The frontend works on its own in **demo mode**. The MATLAB backend adds **live
inference** on uploaded images.

---

## 1. What to export from this folder

Copy these into one root folder on the new machine, keeping the **exact layout**:

```
RetinoXAI/                         ← root folder (any name/location)
├── prototype/
│   ├── backend/                   ← REQUIRED  (all .m files + the +retinoxai package)
│   └── frontend/                  ← REQUIRED  (source, config) — see exclude list below
└── main_model/
    └── ada/                       ← REQUIRED for live inference (large .mat files)
        ├── resnet50_processed_IDRiD_APTOS.mat        (~87 MB)
        └── efficientnetB5_processed_IDRiD_APTOS.mat  (~104 MB)
```

**Include**
- `prototype/backend/` — everything (`RetinoXAIServer.m`, `+retinoxai/*.m`).
- `prototype/frontend/` — `src/`, `public/`, `index.html`, `package.json`,
  `package-lock.json`, `vite.config.ts`, `tsconfig*.json`, `.claude/launch.json`,
  and (optional) `e2e/`, `playwright.config.ts`.
- `main_model/ada/` — the **two** `.mat` files listed above.

**Do NOT copy** (they are re-created / not needed — they bloat the export):
- `prototype/frontend/node_modules/`  → re-created by `npm install`
- `prototype/frontend/dist/`, `prototype/frontend/test-results/`, `playwright-report/`
- `scripts/`, `*.slx`, `_temp_matlab_*` → training / Simulink assets, not needed to run the app.
- `efficientnetB5_processed_weighted.mat` → not used by the frozen config.

> ⚠️ **Common mistake:** copying `node_modules` between machines (Windows↔Mac,
> or different Node versions) → native module errors.
> **Fix:** never copy it; run `npm install` on the target instead.

> ⚠️ **Common mistake:** flattening the folders (putting `main_model` *inside*
> `prototype/`). The backend looks for models at **`<root>/main_model/ada`**,
> i.e. two levels above `backend/`. Wrong layout → `ResNet-50 not loaded`.
> **Fix:** keep `prototype/` and `main_model/` as **siblings** (see tree above),
> or edit the path — see Step 4.

---

## 2. Target-system requirements

**Backend (MATLAB)**
- **MATLAB** R2023b or newer (developed/tested on **R2026b**).
- Toolboxes (required):
  - **Image Processing Toolbox** — `rgb2gray`, `imresize`, `imgaussfilt`, `imdiffusefilt`, `imbinarize`, `adapthisteq`, `fibermetric`, `regionprops`, `im2uint8`.
  - **Deep Learning Toolbox** — `dlnetwork`, `dlarray`, `predict`.
  - **Deep Learning Toolbox Converter for ONNX Model Format** — needed to load the
    ONNX-imported EfficientNet-B5 (its `FlattenInto2dLayer` is an ONNX layer class).
- No web toolbox needed — the server uses MATLAB's built-in Java (`java.net.ServerSocket`).

**Frontend (Node)**
- **Node.js ≥ 20.19** (Vite 8 requirement; 22 LTS or 24 also fine) and **npm**.
- Any modern browser (Chrome/Edge/Firefox).

> ⚠️ **Common mistake:** old Node (16/18) → Vite 8 fails with
> `Unsupported engine` or a cryptic ESM error.
> **Fix:** install Node ≥ 20.19 (`node -v` to check).

> ⚠️ **Common mistake:** missing the ONNX converter support package → EfficientNet
> won't load and the server drops to **ESTIMATE fallback**.
> **Fix:** MATLAB → *Home ▸ Add-Ons ▸ Get Add-Ons* → install
> *"Deep Learning Toolbox Converter for ONNX Model Format"*. Check what you have
> with `ver` in MATLAB.

---

## 3. Step-by-step — Frontend (do this first; it can run alone)

**3.1 Install dependencies**
```bash
cd RetinoXAI/prototype/frontend
npm install
```

**3.2 Start the dev server**
```bash
npm run dev
```
Open the printed URL: **http://localhost:5173**

> ⚠️ **`npm run dev` fails / blank page**
> - *`vite: command not found`* → `npm install` didn't finish; run it again.
> - *Port 5173 busy* → Vite auto-picks 5174; use whatever URL it prints.
> - *White screen* → open DevTools (F12) console; a red error usually means a
>   stale `node_modules` — delete it and `npm install` again.

At this point the top badge reads **"Demo simulation"** (no backend yet). That's
expected — continue to Step 4 to enable live inference.

---

## 4. Step-by-step — Backend (MATLAB)

**4.1 Confirm the model files are in place**
```
RetinoXAI/main_model/ada/resnet50_processed_IDRiD_APTOS.mat
RetinoXAI/main_model/ada/efficientnetB5_processed_IDRiD_APTOS.mat
```

**4.2 Start the server** — pick ONE:

*Option A — inside the MATLAB desktop (Command Window):*
```matlab
cd 'C:\path\to\RetinoXAI\prototype\backend'
RetinoXAIServer(8080)
```

*Option B — headless from a terminal (no MATLAB window):*
```bash
# Windows
"C:\Program Files\MATLAB\R2026b\bin\matlab.exe" -batch "cd('C:\path\to\RetinoXAI\prototype\backend'); RetinoXAIServer(8080)"

# macOS / Linux
matlab -batch "cd('/path/to/RetinoXAI/prototype/backend'); RetinoXAIServer(8080)"
```

**4.3 Read the startup banner.** Success looks like:
```
[RetinoXAI] Loaded ResNet-50 from ...\main_model\ada\resnet50_processed_IDRiD_APTOS.mat
[RetinoXAI] Loaded EfficientNet-B5 from ...\main_model\ada\efficientnetB5_processed_IDRiD_APTOS.mat
 Inference: LIVE (both backbones loaded)
 Listening on http://localhost:8080
```
Leave this window open. Stop the server with **Ctrl+C**.

> ⚠️ **`'matlab' is not recognized`** (Option B) → MATLAB isn't on PATH.
> **Fix:** use the full path to `matlab.exe` (as shown), or add
> `...\MATLAB\R20xx\bin` to your PATH.

> ⚠️ **`ResNet-50 not loaded (Unable to find file...)`** → wrong folder layout.
> **Fix:** put `main_model/` beside `prototype/` (Step 1). To use a different
> location instead, edit `prototype/backend/+retinoxai/frozenConfig.m` → set
> `modelDir = fullfile('C:','your','path','main_model','ada');`.

> ⚠️ **`Inference: ESTIMATE fallback`** even though files exist →
> the ONNX converter is missing, **or** you edited a `.m` file and MATLAB cached
> the old models.
> **Fix:** install the ONNX converter (Step 2); then reset the cache with
> `clear functions` (or restart MATLAB) before re-running `RetinoXAIServer(8080)`.

> ⚠️ **`Address already in use` / port 8080 busy** → a previous server is still
> running.
> **Fix:** stop it (Ctrl+C in its window), or start on another port
> `RetinoXAIServer(8090)` **and** point the frontend at it (Step 5).

> ⚠️ **Windows Firewall pop-up** on first run → MATLAB opening a socket.
> **Fix:** click *Allow access* (Private networks is enough for localhost).

---

## 5. Connect the two & verify

With **both** running, reload **http://localhost:5173**. The top badge should
flip from *"Demo simulation"* to **"MATLAB engine"** (green) = live.

Quick backend check from a terminal:
```bash
curl http://127.0.0.1:8080/api/health
# → {"status":"online", ... ,"modelVersion":"RetinoXAI-ensemble-v2 (frozen)"}
```

> ⚠️ **Badge stays "Demo simulation" / empty API replies** → the frontend proxy
> can't reach MATLAB.
> **Fix checklist:**
> - Backend window shows `Listening on ... 8080`? If not, fix Step 4 first.
> - The proxy targets **`127.0.0.1`**, not `localhost` (see `vite.config.ts`).
>   On Windows `localhost` can resolve to IPv6 `::1`, which MATLAB's IPv4 socket
>   refuses — that empties every reply. Keep it as `127.0.0.1`.
> - Using a non-default backend port? Set it before `npm run dev`:
>   `VITE_API_TARGET=http://127.0.0.1:8090 npm run dev` (Windows PowerShell:
>   `$env:VITE_API_TARGET="http://127.0.0.1:8090"; npm run dev`).
> - Restart the Vite dev server after any `vite.config.ts` change (config isn't hot-reloaded).

---

## 6. Using the app (sanity flow)

1. **New Screening** → *Upload* → drop a fundus image.
2. The **FundaQ-8 quality gate** scores it (0–16). A non-fundus/blurry image is
   rejected with reasons and the pipeline is blocked → use *Recapture*.
3. A good image passes → **Run screening pipeline** → result (grade, confidence,
   Grad-CAM++, lesions) → **Open full case review**.

> ⚠️ **"Run" button greyed out** → the uploaded image failed the quality gate
> (by design). Upload a clearer fundus photo.

> ℹ️ **Known limitation:** the loaded networks are currently *uninitialised
> dlnetworks*, so grading/Grad-CAM fall back to a heuristic rather than the
> trained ensemble. The HTTP path, quality gate, and UI are fully live; true
> model grading needs the `initialize()` fix in `+retinoxai/loadModels.m`.

---

## 7. Optional — end-to-end tests (Playwright)

```bash
cd RetinoXAI/prototype/frontend
npm install
npx playwright install chromium     # or use system Edge (see below)
npx playwright test
```
> ⚠️ **Chromium download fails / behind a firewall** → use the system browser:
> the config already sets `channel: 'msedge'`, so on Windows you can skip the
> download and just run `npx playwright test`. On Mac/Linux without Edge, remove
> `channel` from `playwright.config.ts` or run `npx playwright install chromium`.
> Tests expect both servers (5173 + 8080) already running.

---

## 8. Quick reference (cheat sheet)

| Action | Command |
|---|---|
| Install frontend | `cd prototype/frontend && npm install` |
| Run frontend | `npm run dev` → http://localhost:5173 |
| Run backend (desktop) | `cd prototype/backend` then `RetinoXAIServer(8080)` |
| Run backend (headless) | `matlab -batch "cd('.../backend'); RetinoXAIServer(8080)"` |
| Reset MATLAB model cache | `clear functions` then re-run the server |
| Health check | `curl http://127.0.0.1:8080/api/health` |
| Stop backend | Ctrl+C in the MATLAB window |
| Change backend port | `RetinoXAIServer(8090)` + `VITE_API_TARGET=http://127.0.0.1:8090` |

## 9. Troubleshooting summary

| Symptom | Cause | Fix |
|---|---|---|
| `ResNet-50 not loaded` | Models in wrong folder | `main_model/` beside `prototype/`, or edit `frozenConfig.m` |
| `Inference: ESTIMATE fallback` | ONNX converter missing / stale cache | Install ONNX add-on; `clear functions`; restart |
| Badge stuck on "Demo simulation" | Proxy can't reach backend | Backend up? proxy = `127.0.0.1`? restart Vite |
| Empty API replies / 502 | `localhost`→IPv6 vs IPv4 socket | Keep proxy target `127.0.0.1` |
| `'matlab' not recognized` | MATLAB not on PATH | Use full path to `matlab.exe` |
| `vite: command not found` | Deps not installed | `npm install` |
| Vite `Unsupported engine` | Node too old | Node ≥ 20.19 |
| Port 8080 busy | Old server running | Ctrl+C it, or use another port |
| `npm install` copied and failing | `node_modules` copied across machines | Delete it, `npm install` fresh |
