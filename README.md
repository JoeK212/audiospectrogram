# sound / relief

Turns an audio recording's spectrogram into a 3D relief and exports CNC
G-code to carve it. Single-file HTML/JS, runs entirely in the browser —
nothing is uploaded anywhere.

**Live:** https://audiospectrogramcnc.netlify.app/
**Version:** v1.11 — full changelog is a comment block at the top of
`index.html` (source of truth if this file drifts out of date).

## Pipeline

Audio → STFT spectrogram → heightmap → three.js preview + G-code
(multi-level stepdown roughing + finishing pass) + STL export. Time →
X, frequency → Y, loudness → Z depth. Board always stored in mm; G-code
always exports mm (`G21`) regardless of the display unit toggle.

Viewport has a nav toolbar (Home/Top/Front/Right, machine-origin
marker, a section cut you push/pull along X with a red profile trace at
the cut, and an X-ray toggle that ghosts the stock plus a wireframe of
the true board envelope) and playback (Play/Stop) with a synced marker
tracing the relief in time with the sound. Presets (save/load/delete,
named, stored in this browser only) capture every tunable value so you
can snap back to a known-good setup.

## Files

- `index.html` — the whole app (three.js embedded inline, no CDN dep).
- `netlify.toml` — static site, no build step.
- `audit_deploy.js` — **local only, not committed.** Run before shipping:
  `node audit_deploy.js index.html`. Every check exists because of a
  real bug hit during development.

## Known limitations

- Codec support depends on the browser's native decoder.

— Joe.K · axisbim.io
