#!/usr/bin/env bash
# Flag straight horizontal lines: rows (below the bar, above the pool) where
# one colour covers >= THRESH of the width. Usage: tools-linecheck.sh <png> [thresh%]
f=$1; t=${2:-70}
h=$(magick identify -format %h "$f")
for ((y=24; y<h-50; y+=1)); do
  top=$(magick "$f" -crop 1600x1+0+$y +repage -format %c histogram:info:- | sort -rn | head -1 | awk '{print $1+0}')
  pct=$((top*100/1600))
  (( pct >= t )) && echo "row $y: ${pct}% one colour"
done
echo "checked rows 24..$((h-50))"
