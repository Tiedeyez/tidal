# Changelog

## 1.1.0

- **Fixed: a blank desktop on NVIDIA.** NVIDIA's driver refused the falls shader (a constant table and whole-number `min`/`max`, neither of which is in the oldest GLSL the shader is also built for), so the desktop stayed plain dark blue. The dither is now worked out with arithmetic and the whole-number helpers are written out. Checked on an RTX 4070 SUPER; on Intel the picture is identical to 1.0.0, pixel for pixel.
- **A koi in the pool.** Every 40 seconds a small gold koi leaps from the pool and drops back. `"koi": false` turns it off.
- **Pause and resume.** `omarchy-shell tiedeyez.tidal pause | resume | toggle` holds the water still, for a clean screenshot or to save power.

## 1.0.0

- The first release: the falls, the brink behind the bar, the pool and mist, and the Omarchy wordmark rising out of the water.
