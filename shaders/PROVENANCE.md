# Shader build provenance

Tidal loads two compiled shaders, each built from the `.frag` of the same name in this folder by `build.sh`. The build is reproducible: building the same source with the same qsb gives a byte-identical file.

| | |
|---|---|
| Source | `shaders/tidal.frag` (the falls, pool, mist and wordmark), SHA-256 `eff878580b252f4276f84ad66fce26f064a7555e7cd358dcf57b905e1373df1a` |
| Output | `shaders/tidal.frag.qsb`, SHA-256 `6dfdc66ec7ee8ff1416812d5f7cf2f8a7db4ef411992fa6917d2ade45dd8f780` |
| Second source | `shaders/bar.frag` (the brink behind the bar), SHA-256 `41028d0422b50822238e72e6376b0249630579c70261ce257029e5588130bdf4` |
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
