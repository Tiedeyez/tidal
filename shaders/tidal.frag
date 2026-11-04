#version 440
// Tidal: a 16-bit waterfall filling the desktop, in the style of the classic
// tile-animation waterfall (one-pixel columns of light-to-dark bands with
// ragged leading edges, falling; white droplet sparkles; a churning foam
// pool). The top bar is the brink of the fall (shaders/bar.frag); this sheet
// starts directly under it. The Omarchy wordmark slowly emerges out of the
// water, holds, and is washed away again.
//
// Physics: water leaves the brink at v0 and accelerates under gravity, so a
// parcel at height y below the brink has been falling for
//   tau(y) = (sqrt(v0^2 + 2 g y) - v0) / g
// Bands are spaced equally in time, so they stretch as they fall. Droplets
// are labelled by tau - t, so they are carried exactly with the water.
// Every motion is a whole number of cycles per LOOP seconds.

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float time;   // seconds in [0, LOOP)
    vec2 res;     // canvas size in art pixels
};
layout(binding = 1) uniform sampler2D logo;   // 81 x 19 Omarchy wordmark, alpha = ink

const float LOOP = 960.0;
const float TAU = 6.2831853;

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

// ---- helpers ---------------------------------------------------------------
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

// cycles per loop -> phase in [0, 1)
float cyc(float n) { return fract(time * n / LOOP); }

// Wrap x into [0, m).
float wrapx(float x, float m) { return x - m * floor(x / m); }

bool logoInk(vec2 lp) {
    // lp in logo pixels; outside = no ink
    if (lp.x < 0.0 || lp.y < 0.0 || lp.x >= 81.0 || lp.y >= 19.0) return false;
    return texture(logo, (floor(lp) + 0.5) / vec2(81.0, 19.0)).a > 0.5;
}


const float V0 = 25.0;      // art px / s leaving the brink
const float G = 12.0;       // art px / s^2
const float BANDS = 1.0;    // bands per second of fall

float fallTime(float y) { return (sqrt(V0 * V0 + 2.0 * G * max(y, 0.0)) - V0) / G; }

// The emergence cycle: 12 per loop (80 s). 0..0.3 rising out of the water,
// hold, 0.85..1 washed away.
float emergence() {
    float c = cyc(12.0);
    return smoothstep(0.0, 0.30, c) * (1.0 - smoothstep(0.85, 1.0, c));
}

// Order in which a logo pixel surfaces: bottom rows first, with grain.
float revealAt(vec2 lc) {
    return 0.55 * hash2(floor(lc) + 17.0) + 0.45 * (1.0 - floor(lc.y) / 18.0);
}
bool shown(vec2 lp, float e) { return logoInk(lp) && e > revealAt(lp); }


// ---- wind --------------------------------------------------------------------
// Gusts: two slow periods (160 s and ~56 s). wind() is the speed (-1..1),
// windDrift() its integral in art px, so whatever the wind carries (mist)
// moves by exactly the area under the gust curve and the loop stays seamless.
const float WIND_PX = 1.6;   // art px / s at full gust
float wind() { return 0.65 * sin(TAU * cyc(6.0)) + 0.35 * sin(TAU * cyc(17.0) + 1.3); }
float windDrift() {
    return WIND_PX * (-0.65 * cos(TAU * cyc(6.0)) * LOOP / (6.0 * TAU)
                      - 0.35 * cos(TAU * cyc(17.0) + 1.3) * LOOP / (17.0 * TAU));
}

// ---- mist density: periodic value noise ------------------------------------------
float vnoise(vec2 x, float py) {
    vec2 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float iy0 = mod(i.y, py), iy1 = mod(i.y + 1.0, py);
    float a = hash2(vec2(i.x, iy0)), b = hash2(vec2(i.x + 1.0, iy0));
    float c = hash2(vec2(i.x, iy1)), d = hash2(vec2(i.x + 1.0, iy1));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
// three octaves, each periodic in y so the rising mist wraps cleanly
float mistFbm(vec2 q, float py) {
    return (vnoise(q, py) + 0.5 * vnoise(q * 2.0 + 7.1, py * 2.0)
            + 0.25 * vnoise(q * 4.0 + 3.3, py * 4.0)) / 1.75;
}


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
    vec2 p = floor(qt_TexCoord0 * res);         // art pixel, y down from the brink
    float W = res.x;
    float H = res.y;
    float s = H / 180.0;
    int idx;

    float drift = windDrift();
    float wnd = wind();
    float tauMax = fallTime(H);

    // ---- the falling sheet ------------------------------------------------
    // Glassy at the brink, turbulent as it accelerates: the ragged edges and
    // streak columns grow in over the first rows (the classic tile look
    // below that). Wind drag bends the sheet more the longer it has fallen.
    float tau0 = fallTime(p.y);
    float xb = p.x - floor(wnd * 3.0 * s * (tau0 / tauMax) * (tau0 / tauMax) + 0.5);
    float rough = max(0.35, smoothstep(0.0, 18.0 * s, p.y));   // never perfectly flat
    float jit = floor((hash1(xb * 1.37) * 3.0 + hash1(floor(xb / 3.0) + 50.0) * 3.0) * rough);
    float tau = fallTime(p.y + jit);
    float bandPh = fract(tau * BANDS - cyc(LOOP * BANDS));   // 0 = band's lit head, 1 = its dark tail
    float shade = 11.8 - bandPh * 10.6;                      // near-white head down to #0f2d64
    // each column steps through the gradient at its own height (a shared
    // threshold drew a straight row across the screen at every colour step)
    shade += (hash1(xb * 5.1 + 2.0) - 0.5) * 1.8 * max(rough, 0.8);
    float qd = surgeAt(tau0);                                  // the surge, as it reaches this height
    shade += 0.9 * qd;                                         // more water: brighter, whiter
    // darker streak columns, each switching on at its own point in the band
    // (a shared onset lined their dashes up into one horizontal row)
    shade -= step(0.72, hash1(xb + 9.0)) * step(0.15 + 0.6 * hash1(xb * 3.7 + 31.0), bandPh) * 1.2 * rough;
    shade += step(0.93, hash1(xb + 21.0)) * 0.8;             // a few brighter threads
    idx = int(clamp(floor(shade + 0.5), 1.0, 13.0));   // clean steps, no dither (as in classic tiles)

    // the tongue: just past the brink the water is still the bright curve of
    // the pour, ragged per column, fading over the first few rows
    if (p.y < 5.0 * s)
        idx = max(idx, 11 - int(p.y / s) - int(hash1(xb * 2.3) * 3.0) - int(hash1(floor(xb / 4.0) + 3.0) * 2.0));

    // continuity: the sheet thins as it speeds up (thickness ~ v0 / v), so
    // lower down it tears into gaps (the dark rock behind shows) and droplets.
    float thin = 1.0 - V0 / sqrt(V0 * V0 + 2.0 * G * p.y);    // 0 at the brink, ~0.65 at the pool
    // (short tears, only in the lower half where the sheet is thinnest)
    float lab3 = mod(floor((tau - time) * 12.0 + hash1(xb) * 5.0), LOOP * 12.0);
    float tear = smoothstep(0.42, 0.62, thin);
    if (hash2(vec2(xb, lab3)) < tear * 0.04) idx = hash1(xb + lab3) > 0.5 ? 2 : 3;

    // droplets carried with the water (labelled by tau - t), more as it breaks up
    // (each label spans 1/7 s of fall; only its first ~2 px is drawn, or the
    // fast water at the bottom stretched droplets into long white streaks)
    float labf = (tau - time) * 7.0;
    float lab = mod(floor(labf), LOOP * 7.0);
    float vel = sqrt(V0 * V0 + 2.0 * G * p.y);               // art px / s here
    if (fract(labf) < 14.0 / vel && hash2(vec2(xb, lab)) > 0.962 - 0.05 * thin - 0.03 * qd)
        idx = hash1(xb + lab) > 0.5 ? 14 : 12;

    // ---- OMARCHY emerging out of the water ------------------------------------
    float e = emergence();
    if (e > 0.0) {
        float L = 2.0 * s;                                     // art px per logo px
        vec2 lo = vec2(floor(W * 0.5 - 40.5 * L), floor(H * 0.38));
        vec2 lp = (p - lo) / L;
        float u = 1.0 / L;
        bool ink = logoInk(lp);
        if (ink && e > revealAt(lp)) {
            // wet stone-white letters, the falling bands still sheening over them
            idx = bandPh < 0.25 ? 14 : (lp.y < 3.0 ? 13 : 12);
            if (fract(lp.y * 0.5 + bandPh) < 0.12) idx = 11;
        } else if (ink && e > revealAt(lp) - 0.08) {
            idx = 11;                                          // fizzing edge about to surface
        } else if (shown(lp - vec2(u, u), e)) {
            idx = 1;                                           // shadow
        } else if (shown(lp + vec2(u, 0.0), e) || shown(lp - vec2(u, 0.0), e) ||
                   shown(lp + vec2(0.0, u), e) || shown(lp - vec2(0.0, u), e)) {
            idx = 2;                                           // outline
        } else if (lp.x >= -1.0 && lp.x < 82.0 && lp.y > -3.0 && lp.y < 19.0 + 32.0 * u) {
            // water striking a letter's top edge splashes up and out
            for (int k = 1; k <= 3; k++) {
                if (shown(lp + vec2(0.0, float(k) * u), e)) {
                    float f = fract(hash2(p + 3.0) + cyc(480.0 + float(k) * 96.0));
                    if (f < 0.45 / float(k)) idx = f < 0.2 ? 14 : 12;
                    break;
                }
            }
            // below a letter: a thin dark gap before the sheet rejoins, and drops
            // that gather on the underside, swell, let go and fall (y = g t^2 / 2)
            for (int k = 1; k <= 32; k++) {
                if (shown(lp - vec2(0.0, float(k) * u), e)) {
                    float fk = float(k);
                    if (k <= 4) idx = min(idx, 3 + k / 2);
                    float cxl = floor(lp.x);
                    if (e > 0.97 && hash1(cxl * 3.1 + 7.0) > 0.45) {
                        float ph = fract(cyc(400.0) + hash1(cxl * 1.7));     // 2.4 s per drop
                        if (ph < 0.5) {
                            if (k == 1 && ph > 0.15) idx = 13;                 // swelling bead
                        } else {
                            float tf = (ph - 0.5) * 2.4;
                            float dy = 1.0 + 0.5 * 40.0 * s * tf * tf;
                            if (abs(fk - dy) < 0.5) idx = 14;
                            else if (dy > 8.0 && fk < dy && fk > dy - 2.0) idx = 12;   // speed streak
                        }
                    }
                    break;
                }
            }
        }
    }

    // ---- the plunge pool -----------------------------------------------------
    float pool0 = H - floor(9.0 * s);
    // a heaving surface: travelling ripples on whole cycles per loop
    float pool = pool0 + floor(1.2 * s * sin(p.x * 0.17 - TAU * cyc(600.0))
                              + 0.8 * s * sin(p.x * 0.41 + TAU * cyc(840.0)) + 0.5);
    if (p.y >= pool) {
        float d = (p.y - pool0) / (H - pool0);
        float f = fract(hash2(floor(p / vec2(2.0, 1.0))) + cyc(480.0 + floor(d * 3.0) * 96.0));
        float qp = surgeAt(tauMax);
        idx = f < 0.35 - 0.2 * d + 0.15 * qp ? 14 : (f < 0.6 ? 12 : (f < 0.8 ? 10 : 8 - int(d * 3.0)));
        if (p.y < pool + 1.0) idx = 14;                          // foam line
    } else if (p.y >= pool0 - 60.0 * s) {
        float hgt = pool0 - p.y;                                 // height above the pool

        // the mist cloud: density falls off exponentially with height, its
        // texture rises through turbulence and drifts with the wind's integral
        float rise = cyc(36.0) * 16.0 * 6.0;                     // whole noise periods per loop
        vec2 q = vec2((p.x - drift) / (20.0 * s), (p.y + rise) / 6.0);
        float n = mistFbm(q, 16.0);
        n = smoothstep(0.30, 0.80, n);                           // billows, not a flat haze
        float qm = surgeAt(tauMax + hgt / 4.8);                 // mist from that surge, risen this far
        float rho = n * exp(-hgt / ((22.0 + 10.0 * qm) * s)) * (1.35 + 0.35 * abs(wnd) + 0.5 * qm);
        if (rho > bayer(p) * 0.9 + 0.06) idx = max(idx, min(13, 9 + int(rho * 4.0)));

        // splash: droplets thrown up from the impact on ballistic arcs
        if (hgt < 26.0 * s) {
            for (int j = 0; j < 20; j++) {
                float fj = float(j);
                float ph = fract(cyc(600.0) + hash1(fj * 1.3));        // 1.6 s per throw
                float gen = mod(floor(time * 600.0 / LOOP + hash1(fj * 1.3)), 600.0);
                float t = ph * 1.6;
                float x0 = hash2(vec2(fj, gen)) * W;
                float vy = (14.0 + 16.0 * hash2(vec2(gen, fj + 3.0))) * s;
                float vx = (hash2(vec2(fj + 5.0, gen)) - 0.5) * 16.0 * s + wnd * 6.0 * s;
                vec2 sp = vec2(x0 + vx * t, pool0 - vy * t + 0.5 * 36.0 * s * t * t);
                if (sp.y <= pool0 && floor(sp) == p) idx = t < 0.9 ? 14 : 12;
            }
        }

        // mist droplets: lifted by the updraft, slowed by drag
        // (rise = v/k (1 - e^-kt)), swaying with the gusts, fading as they evaporate
        for (int j = 0; j < 18; j++) {
            float fj = float(j);
            float ph = fract(cyc(192.0) + hash1(fj * 2.9 + 1.0));      // 5 s lives
            float gen = mod(floor(time * 192.0 / LOOP + hash1(fj * 2.9 + 1.0)), 192.0);
            float a = ph * 5.0;
            float vr = (14.0 + 10.0 * hash2(vec2(fj, gen + 9.0))) * s;
            vec2 mp = vec2(hash2(vec2(gen, fj)) * W + drift * 0.6 + 2.0 * s * sin(a * 1.7 + fj),
                           pool0 - (vr / 0.6) * (1.0 - exp(-0.6 * a)));
            mp.x = wrapx(mp.x, W);
            if (floor(mp) == p) idx = a < 2.0 ? 13 : (a < 3.5 ? 12 : 10);
        }
    }

    fragColor = vec4(pal(idx), 1.0) * qt_Opacity;
}
