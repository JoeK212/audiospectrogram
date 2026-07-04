# sound / relief

Turns an audio recording's spectrogram into a 3D relief and exports CNC
G-code to carve it. Single-file HTML/JS, runs entirely in the browser —
nothing is uploaded anywhere.

**Live:** https://audiospectrogramcnc.netlify.app/
**Version:** v1.30

Audio → spectrogram → heightmap → three.js preview + G-code/STL export.
Tablet-friendly (drag to orbit, pinch to zoom, panel narrows at iPad
widths); desktop is unchanged. See **[EXTENDED.md](./EXTENDED.md)** for
the full feature walkthrough, viewport controls, presets, and changelog
highlights — or the comment block at the top of `index.html`, which is
the source of truth if these drift out of date.

## Files

- `index.html` — the whole app (three.js embedded inline, no CDN dep).
- `netlify.toml` — static site, no build step.
- `audit_deploy.js` — **local only, not committed.** Run before shipping:
  `node audit_deploy.js index.html`.

## Known limitations

- Codec support depends on the browser's native decoder.
- Touch support targets tablets; phone-width screens aren't a focus.

— Joe.K · axisbim.io
