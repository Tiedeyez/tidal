#!/usr/bin/env bash
# Rebuild the two shaders (needs qt6-shadertools). The build is reproducible:
# see shaders/PROVENANCE.md.
set -euo pipefail
cd "$(dirname "$0")"
QSB=/usr/lib/qt6/bin/qsb
for f in tidal bar; do
  "$QSB" --glsl "100es,300es,120,150" --hlsl 50 --msl 12 -o "shaders/$f.frag.qsb" "shaders/$f.frag"
  echo "built shaders/$f.frag.qsb"
done
