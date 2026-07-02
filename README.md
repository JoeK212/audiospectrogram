# sound / relief

Turns an audio recording's spectrogram into a 3D relief and exports CNC
G-code to carve it. Single-file HTML/JS, no build step, runs entirely in
the browser — nothing is uploaded anywhere.

**Live status: v1.7.** Version and changelog also live as a comment block
at the top of `index.html` — that's the source of truth if this file and
the code ever drift apart.

## Files

Public repo (this is what's on GitHub / deployed via Netlify):

- `index.html` — the whole app. ~670KB, mostly because three.js r128 is
  embedded inline (no CDN dependency — see "Known landmines" below).
- `netlify.toml` — static site, no build step, no functions. Just serves
  the repo root.
- `README.md` — this file.

Local-only (not committed — see `.gitignore`), same convention as the
rest of the Joe.K tool suite:

- `audit_deploy.js` — run before shipping a new version:
  `node audit_deploy.js index.html`. Every check in it exists because of
  a real bug hit during development, not precautionary boilerplate.
- `HANDOFF_vX.X.X.md` (if present) — session handoff notes.

## Deployment

Static site, GitHub → Netlify continuous deployment, same pattern as
Modulor Massing and FIGURE/GROUND. No build command, no environment
variables, no serverless functions — `netlify.toml` just points
`publish` at the repo root. Every push to the connected branch ships
automatically.

## Pipeline

Audio file → Web Audio `decodeAudioData` → hand-rolled radix-2 FFT (STFT,
1024-sample window, 768 overlap) → dB-normalized spectrogram → bilinear-
resampled onto a board-resolution grid (rows = frequency, cols = time) →
Three.js terrain mesh for preview → raster (zigzag) toolpath → G-code
(optional multi-level stepdown roughing pass + finishing pass).

Time → X axis, frequency → Y axis, loudness → Z depth (or inverted, if
the "invert" toggle is on). Board dimensions are always stored in mm
internally; the mm/in toggle only affects display and typed input — the
exported G-code is always mm (`G21`).

The STL export is generated straight from the same heightmap grid used
for the G-code — same board mm, same depths, same coordinate space —
so it's a faithful preview of what will actually get cut, not the
exaggerated/rotated three.js viewport. It's a closed/manifold solid
(relief on top, flat base, side walls) since slicers expect watertight
geometry, and — like G-code export — it doesn't touch the three.js
mesh/scene at all, so it still works if the 3D preview fails to build.

The viewport has a small nav toolbar: Home/Top/Front/Right view
presets, a toggleable machine-origin marker (X0/Y0 — positioned in the
G-code/STL corner-origin frame, which is different from the preview's
centered-on-board frame), and a section push/pull tool that clips the
preview with a draggable plane so you can check the actual carve depth
at any point before cutting.

## Known landmines (why the audit script checks what it checks)

1. **Never reference `THREE.*` outside a function.** A top-level
   `new THREE.Vector3(...)` at parse time once killed the *entire*
   script silently if three.js failed to load — before any event
   listener, including error handlers, had attached. All THREE usage
   now lives inside `initScene()`/`buildMesh()`, called well after
   critical wiring runs.
2. **File input must be a `<label for="fileInput">`, not a div with a
   click() proxy.** `div.onclick = () => input.click()` recurses
   infinitely when the input is a descendant, because `.click()`
   dispatches a bubbling click event straight back into the same
   listener. Silent failure, no console error, dialog never opens.
3. **Drops outside the drop zone get hijacked by the browser** unless
   `dragover`/`drop` are also captured at the `window` level. Browser
   chrome (tabs, title bar) is outside the page's DOM entirely — no
   JS fix is possible for drops landing there specifically.
4. **A 3D render failure must never block G-code export.** They're
   unrelated data paths; `buildMesh()` is wrapped in try/catch inside
   `buildHeightmapFromCache()` so a Three.js problem degrades the
   preview, not the whole app.
5. **Critical wiring (file input, drag/drop) runs first in source
   order**, before anything THREE-related, so a failure elsewhere
   can't take file handling down with it.

## Known limitations (not bugs, just not built yet)

- No preset save/load. Re-tuning happens per session.
- Codec support depends on the browser's native decoder (m4a/mp3/wav/ogg
  all work in Chrome/Edge/Safari; untested elsewhere).
- Not deployed yet — `netlify.toml` is in place and ready, but no live
  URL exists until it's pushed to GitHub and connected to Netlify.

## Version history

See the changelog comment at the top of `index.html` for the full
per-version detail (v0.1 → v1.3). Summary:

- **v1.7** — real multi-level stepdown roughing (new "rough stepdown"
  param) replacing the old single-plunge roughing pass; verified no
  pass ever gouges past a point's own rough target.
- **v1.6** — UI polish pass: real disabled states on nav buttons, Firefox
  slider styling (previously fell back to browser-default blue), smoother
  hover transitions, cleaned up a CSS positioning hack.
- **v1.5** — basic 3D nav tools: Home/Top/Front/Right presets, a
  machine-origin (X0/Y0) marker in the G-code/STL coordinate frame,
  and a section push/pull tool to check carve depth before cutting.
- **v1.4** — STL export (watertight solid, same board mm/depths as the
  G-code, no dependency on the three.js mesh) so the relief can be
  checked in a slicer before cutting.
- **v1.3** — Simple/Advanced tabs, mm/in unit toggle, editable number
  inputs paired with every slider.
- **v1.2** — hover tooltips on every control, body-appended to escape
  the scrollable side panel.
- **v1.1** — fixed the relief colormap fighting the 3D scene lighting.
- **v1.0** — three.js embedded inline; fixed the top-level `THREE`
  crash, the click-proxy recursion, and drag/drop being hijacked by
  the browser; added visible status/error reporting.
- **v0.1** — initial build: STFT → heightmap → raster toolpath, with
  roughing + finishing passes and a live 3D preview.

— Joe.K · axisbim.io
