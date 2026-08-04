# sound / relief — extended docs

Full feature reference for the app. For the short overview see
[README.md](./README.md). The comment block at the top of `index.html`
is the source of truth if this drifts out of date — it has the complete
version-by-version changelog; this file summarizes what matters for
using and maintaining the app today.

**Live:** https://audiospectrogramcnc.netlify.app/
**Version:** v1.30
**Repo:** github.com/JoeK212/audiospectrogram

## Pipeline

```
audio file → STFT spectrogram → heightmap → three.js preview
                                          → G-code (roughing + finishing)
                                          → STL export
```

- STFT analysis runs in a Web Worker, off the main thread, so the UI
  stays responsive during analysis — live progress shows in the status
  readout. Falls back to synchronous analysis if Workers aren't
  available.
- Time maps to X, frequency maps to Y, loudness maps to Z depth.
- The board is always stored internally in mm, and G-code always
  exports in mm (`G21`) — the mm/in display toggle only affects what's
  shown on screen, never what's written to the file.
- Roughing (optional) runs as real multi-level stepdown CAM: bulk
  material clears in flat Z-level slices at a set increment, not one
  deep plunge. Finishing runs a single ball-nose pass at full detail.

## Board & carve (Simple mode)

- **Length / Width** — footprint of the material blank. Length is what
  the track's time axis stretches (or, with a trim active, crops)
  across; Width is the frequency axis.
- **Max depth** — deepest point of the carve (1–20mm / 0.04–0.79in).
  Typed values past either end clamp to the limit and say why in the
  log rather than silently substituting a different number.
- **Max frequency** — audio content above this is ignored entirely.
  Lower it to focus on bass/mid detail; raise it to capture more
  high-frequency texture (at the cost of the low end taking up
  proportionally less of the Width).
- **Invert (quiet = deep)** — off: quiet stays near the surface
  (peaks), loud cuts deep (valleys). On: flips it, so loud becomes the
  shallow/proud part.

## Advanced mode (tooling & motion)

- **Finish bit / Rough bit** — cutter diameters, set toolpath stepover
  spacing.
- **Finish allowance** — material deliberately left by the roughing
  pass for the finish pass to clean up.
- **Rough stepdown** — max Z removed in a single roughing pass.
- **Feed / Plunge** — cutting and plunge feed rates. Plunge is
  typically much slower than the cutting feed and is now (v1.27)
  correctly accounted for once per row in the machining-time estimate.
- **Safe Z** — retract height between cuts.
- **Include roughing pass** — toggle off if hand-finishing with one bit
  only.

## Trim

Selects a window of the track to actually carve — a true crop, not the
whole file stretched to fit.

- Board length scales proportionally: a 2s clip out of a 60s file at a
  250mm baseline becomes ~8mm, sized as if the full 60s always mapped
  across 250mm and you're keeping just that slice.
- Drag the two handles, or type exact start/end seconds. Reset restores
  the full track and original board length.
- Editing the Length field directly recalibrates the scale for
  whatever trim is currently selected.
- Play/Stop/seek preview exactly the trimmed window, not the whole
  file — what you hear matches what gets carved.
- Trim start/end fields go through the same clamp-with-warning
  treatment as Max depth (v1.24/v1.25): type a value out of range and
  it clamps with a visible reason rather than failing silently.

## Playback

- **Play / Stop** — starts at the trim's start, stops at its end.
- **«5 / 5»** — nudge back/forward 5 seconds, clamped within the trim
  window.
- **Seek bar** — drag to jump anywhere within the trim; uses Pointer
  Events, so it already works correctly on touch.
- A synced marker on the 3D relief traces the actual carved profile in
  time with playback — a real readout of the terrain at that instant,
  not decorative.

## Presets

- Four starter presets (Quick Test, Decorative Shallow, Deep Relief,
  Fine Detail) are fixed and not deletable.
- Custom presets: name it, hit Save — captures every board/carve/
  tooling/motion value (not the audio file itself, not camera/viewport
  state). Load reapplies all of it instantly.
- Stored in this browser's local storage only. On `file://` pages
  (a downloaded copy opened directly, not the live site) local storage
  can be unreliable in some browsers; the app disables the whole
  Presets section if it detects storage genuinely isn't working,
  rather than let a save disappear silently. Presets work reliably on
  the deployed site.

## Viewport & navigation

- **Orbit / zoom** — drag to orbit, scroll to zoom on desktop. On
  tablets (v1.29): one-finger drag orbits, two-finger pinch zooms, via
  a Touch-event handler kept fully separate from the mouse handlers so
  desktop behavior is untouched.
- **Home / Top / Front / Right** — camera presets.
- **0,0** — toggles the machine-origin marker, showing exactly where
  G-code X0/Y0 sits. Colored to the ISO 841/DIN CNC axis convention
  (X=red, Y=green, Z=blue) rather than the app's own accent palette,
  since mixing up axis colors is exactly the kind of mistake worth
  avoiding.
- **Section** — cuts the board along X at a position you drag or type,
  with a red profile trace showing the actual depth at that line.
- **X-Ray** — ghosts the stock material to see through to the carved
  surface, plus a wireframe of the true board envelope (L×W×depth, real
  mm).
- **Reach** (v1.28) — highlights areas the finish bit can't physically
  reach. A round-nosed bit of radius r can't get into a valley narrower
  than its own diameter — the tool body hits a neighboring peak before
  the cutting edge reaches the bottom. Off, the preview shows the
  idealized target surface; on, flagged areas will actually come out
  shallower/wider than shown, no matter how many passes you run.
  Visualize-only by design — it's not applied to the exported G-code or
  STL, since correcting it would mean making an artistic call (flatten?
  round over? leave proud?) the tool shouldn't make silently. The
  readout under the toolbar reports what percent of the surface is
  affected and the worst-case shallow amount for the current finish
  bit. Implementation is a grayscale dilation of the target surface by
  a ball structuring element (standard ball-end-tool CAM theory),
  verified against hand-derived analytical cases (a 1mm slot vs a 6mm
  bit correctly flagged ~98% unreachable; a 30mm valley under the same
  bit correctly fully reachable at center) before shipping.

## Export

- **Download G-code** — the primary CNC output. Multi-level stepdown
  roughing (if enabled) + finishing pass. Always mm (`G21`) regardless
  of the display unit toggle.
- **Download STL** — for sanity-checking the shape in a slicer or CAM
  tool before committing to a carve.

## Tablet support (v1.29)

- The 3D viewport's orbit/zoom originally only listened for mouse
  events (`mousedown`/`mousemove`/`wheel`), so touch devices couldn't
  interact with it. A parallel Touch-event handler was added —
  one-finger drag orbits, two-finger pinch zooms — kept fully separate
  from the mouse handlers so desktop is byte-for-byte unchanged.
  `touch-action: none` on the viewport stops the page from scrolling
  under a drag.
- A `max-width: 1024px` media query (the only `@media` rule in the
  file) narrows the fixed 340px left panel to 280px at tablet widths so
  the viewport keeps usable room. Desktop layout above 1024px is
  unaffected.
- Phones are intentionally not a target.

## Architecture & conventions

- Single-file HTML/JS/CSS, no build step, three.js r128 embedded inline
  (no CDN dependency).
- Seeded, deterministic behavior where relevant; `APP_VERSION` constant
  plus a changelog comment block at the top of `index.html`.
- `audit_deploy.js` is a local-only QA script — run before and after
  every change (`node audit_deploy.js index.html`); every check exists
  because of a real bug hit during development. Not committed to the
  repo.
- Versioned `HANDOFF_vX.X.X.md` files are produced per session and kept
  local-only for continuing work across sessions.

## Recent changelog highlights

- **v1.31** — phone gate: a full-screen message below 767px explaining
  the app needs a tablet or desktop display, with the real app hidden
  underneath (pure CSS, no JS). Tablet/desktop unaffected.
- **v1.30** — in-app Help walkthrough updated to document Reach (it had
  shipped in v1.28 without the help modal being updated).
- **v1.29** — tablet support: touch orbit/pinch-zoom, responsive panel
  width at tablet breakpoints.
- **v1.28** — Reach toggle: visualize-only tool-reachability check
  against the finish bit.
- **v1.27** — machining time estimate corrected to account for per-row
  plunge time (previously undercounted actual G-code runtime by ~14%
  against an independent toolpath simulation; now within ~2.6%).
- **v1.26** — in-app Help documentation (the accordion modal this file
  and the help button both describe).
- **v1.24/v1.25** — typed numeric fields that hit a clamp (Max depth,
  then swept to Trim start/end) now show a visible warning naming what
  got clamped and why, instead of silently substituting a different
  value.

Full detail for every version lives in the changelog comment block at
the top of `index.html`.

## Known limitations

- Codec support depends on the browser's native decoder.
- Touch support targets tablets; phone-width screens show a "please use a tablet or desktop" message instead of the app.
- Reach is a visualization aid only — it doesn't alter exported
  G-code/STL.
- Presets rely on `localStorage`, which can be unreliable on `file://`
  pages opened directly rather than served from the live site.

— Joe.K · axisbim.io
