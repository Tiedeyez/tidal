# Shader build provenance

Tidal loads two compiled shaders, each built from the `.frag` of the same name in this folder by `build.sh`. The build is reproducible: building the same source with the same qsb gives a byte-identical file.

| | |
|---|---|
| Source | `shaders/tidal.frag` (the falls, pool, mist and wordmark), SHA-256 `d9cfe42d9cdc272d108a02f027a57fed17fb99a3917df55a4553f824d07c1699` |
| Output | `shaders/tidal.frag.qsb`, SHA-256 `d4f640888189604af4875ea14161863add1c9ea61d4caa00d32c15e963e61d1e` |
| Second source | `shaders/bar.frag` (the brink behind the bar), SHA-256 `7c7a32f4ca4a8cd5d80875732a0e935fb9f663f5f65fa72faa170c26c1fa032e` |
| Second output | `shaders/bar.frag.qsb`, SHA-256 `698117ce12830f7bbc453f3d6f33843e758d4a7b17c0ce87c5094f9e060f90aa` |
| Tool | `/usr/lib/qt6/bin/qsb` 6.12.0, from Arch `qt6-shadertools 6.12.0-1` |
| Command | `qsb --glsl "100es,300es,120,150" --hlsl 50 --msl 12 -o shaders/<name>.frag.qsb shaders/<name>.frag` |

## Check it yourself

```bash
cp shaders/tidal.frag.qsb /tmp/tidal-before.qsb
./build.sh
sha256sum shaders/tidal.frag.qsb /tmp/tidal-before.qsb   # the two hashes match
/usr/lib/qt6/bin/qsb --dump shaders/tidal.frag.qsb       # every variant's translated source
```

A different qsb version may translate the variants differently and give another hash. If you change a `.frag`, run `./build.sh` and update this file.
