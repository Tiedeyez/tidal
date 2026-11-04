#version 440
// Tidal bar: the brink of the waterfall. The bar is transparent; behind it a
// dark river runs toward the edge (flow streaks moving down toward you), and
// along the bar's bottom edge the water bends over the lip, bright, into the
// falling sheet the wallpaper draws below. Art pixels are 2x2 screen px.

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float time;   // seconds in [0, LOOP)
    vec2 res;     // strip size in art pixels
};

const float LOOP = 960.0;

vec3 pal(int i) {
    // sampled from classic 16-bit waterfall tiles: saturated royal blues, no grey,
    // darkest #0f2d64 (the earlier near-black navies read as mud)
    if (i <= 0) return vec3(0.039, 0.129, 0.314);  // #0a2150 letter shadow only
    if (i == 1) return vec3(0.059, 0.176, 0.392);  // #0f2d64 darkest
    if (i == 2) return vec3(0.090, 0.247, 0.525);  // #173f86
    if (i == 3) return vec3(0.118, 0.314, 0.627);  // #1e50a0
    if (i == 4) return vec3(0.137, 0.357, 0.671);  // #235bab
    if (i == 5) return vec3(0.161, 0.400, 0.714);  // #2966b6
    if (i == 6) return vec3(0.184, 0.451, 0.765);  // #2f73c3
    if (i == 7) return vec3(0.196, 0.471, 0.784);  // #3278c8
    if (i == 8) return vec3(0.290, 0.565, 0.847);  // #4a90d8
    if (i == 9) return vec3(0.416, 0.682, 0.910);  // #6aaee8
    if (i == 10) return vec3(0.549, 0.776, 0.957); // #8cc6f4
    if (i == 11) return vec3(0.706, 0.863, 1.000); // #b4dcff
    if (i == 12) return vec3(0.784, 0.902, 1.000); // #c8e6ff
    if (i == 13) return vec3(0.863, 0.941, 1.000); // #dcf0ff
    if (i == 14) return vec3(1.000, 1.000, 1.000); // foam
    return vec3(1.000, 0.914, 0.690);              // #ffe9b0 (unused here)
}

float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float bayer(vec2 p) {
    // 4x4 ordered dither threshold in (0, 1)
    int x = int(mod(p.x, 4.0));
    int y = int(mod(p.y, 4.0));
    int i = x + y * 4;
    float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0,
                            3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
    return (m[i] + 0.5) / 16.0;
}

// A banded gradient: f is a fractional palette index. Whole bands are flat;
// only the last `edge` of each band is dithered into the next, 16-bit style.
int band(float f, vec2 p, float edge) {
    float b = floor(f);
    float d = (fract(f) - (1.0 - edge)) / edge;
    return int(b) + (d > bayer(p) ? 1 : 0);
}

float cyc(float n) { return fract(time * n / LOOP); }


// ---- flow surges -------------------------------------------------------------
// The river's flow rate rises and falls (12 surges per loop, 80 s apart; mostly
// calm, a short swell). A surge is carried by the water: the falls see it one
// fall time after the brink, the mist one fall plus its rise later.
float surgeAt(float delay) {
    float c = fract((time - delay) * 12.0 / LOOP);
    float q = 0.5 + 0.5 * sin(6.2831853 * c - 1.2);
    return q * q * q;
}

void main() {
    vec2 p = floor(qt_TexCoord0 * res);
    float H = res.y;
    float fromLip = H - 1.0 - p.y;           // 0 on the lip row

    // the river, darkest far back, speeding up toward the lip
    int idx = int(floor(1.5 + (p.y / H) * 1.8));   // clean steps, no dither
    float flow = p.y * p.y * 0.08;           // perspective + acceleration toward the edge
    float fl = (flow - cyc(240.0) * 120.0) / 3.0;    // wraps by exactly 40 labels
    float lab = mod(floor(fl), 40.0);
    float sx = floor(p.x / (5.0 + 9.0 * hash1(lab)));
    if (fract(fl) < 0.4 && hash2(vec2(sx, lab)) > 0.8) idx = 3 + int(p.y / H * 3.0);   // thin flow lines

    // the lip: water bulging over the edge. Its height varies along the
    // brink (slowly shifting bulges, whole cycles per loop), shaded from the
    // crest down, with sparse glints instead of a solid white line.
    float TAU = 6.2831853;
    float lh = 1.7 + 0.9 * sin(p.x * 0.051 + TAU * cyc(30.0))
                   + 0.6 * sin(p.x * 0.137 - TAU * cyc(48.0) + 1.0)
                   + 0.5 * hash1(floor(p.x / 2.0));
    lh = max(lh * (0.85 + 0.7 * surgeAt(0.0)), 0.6);         // the lip swells with each surge
    if (fromLip < lh) {
        float t = fromLip / lh;                      // 0 at the bar's edge, 1 at the crest
        idx = t > 0.75 ? 12 : (t > 0.4 ? 10 : 9);
        float g = fract(hash2(vec2(p.x, floor(fromLip))) + cyc(480.0));
        if (g < 0.07) idx = 14;                      // glints sliding over the curve
        else if (g < 0.16) idx = 13;
    } else if (fromLip < lh + 1.0) {
        idx = 6;                                     // the glassy shoulder before the drop
    }
    fragColor = vec4(pal(idx), 1.0) * qt_Opacity;
}
