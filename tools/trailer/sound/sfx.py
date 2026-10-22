"""AFTERZERO trailer sound design and ambience, following the sound-design cues in tools/trailer/trailer.json.

Everything is synthesised here from physical recipes (no recordings from anywhere): rain is thousands of droplet
impacts and puddle bubbles over a wet hiss; wind is gust-driven noise with whistling resonances; water is bubble
chirps; birds are FM calls; bells, glass and metal are modal; footsteps, doors and impacts are excitation + resonance.
The crowd murmur is a babble of the game's own recorded mission 1 voices, too dense and too distant to understand.

  python3 tools/trailer/sound/sfx.py            # OUT/stems/sfx.wav (+ sfx_amb.wav, sfx_fx.wav)
  python3 tools/trailer/sound/sfx.py --store    # OUT/store/sfx.wav
"""
import json
import os
import sys
import numpy as np
from scipy import signal
from dsp import (SR, OUT, ROOT, ns, add, noise, lp, hp, bp, resonator, pan, smooth_rand, reverb, fade, tvlp, write_wav,
                 load_audio, stereo, width, plus)
import textures as tx

TRAILER = json.load(open(os.path.join(ROOT, 'tools', 'trailer', 'trailer.json')))
LEN = TRAILER['length']


def st(x):
    return stereo(np.asarray(x, np.float32))


def at_rms(x, d):
    """scale to an RMS level (dBFS) measured over the non-silent part"""
    m = np.abs(x).max(1) if x.ndim == 2 else np.abs(x)
    act = x[m > 1e-5]
    r = np.sqrt(np.mean(act ** 2)) if len(act) else 0
    return (x * (10 ** (d / 20) / r)).astype(np.float32) if r > 0 else x


def at_peak(x, d):
    p = np.abs(x).max()
    return (x * (10 ** (d / 20) / p)).astype(np.float32) if p > 0 else x


def env(n, points):
    t = np.arange(n) / SR
    return np.interp(t, [p[0] for p in points], [p[1] for p in points]).astype(np.float32)


# ============================================================================================== elements
def _sparse(n, rate, seed, amp_shape=2.2):
    rng = np.random.default_rng(seed)
    k = rng.poisson(rate * n / SR)
    pos = rng.integers(0, n, k)
    amp = (rng.pareto(amp_shape, k) + 1) ** -1 * rng.choice([-1, 1], k)
    return pos, amp


def drops(dur, rate, seed, kind='hard', lo=1500, hi=6000, level=1.0):
    """droplet events: 'hard' = tiny impacts on stone/metal, 'bubble' = puddle bubbles (rising Minnaert chirps)"""
    n = ns(dur)
    out = np.zeros((n, 2), np.float32)
    rng = np.random.default_rng(seed)
    variants = 12
    for ch in range(2):
        pos, amp = _sparse(n, rate, seed * 7 + ch)
        which = rng.integers(0, variants, len(pos))
        for v in range(variants):
            sel = which == v
            if not np.any(sel):
                continue
            imp = np.zeros(n, np.float32)
            np.add.at(imp, pos[sel], amp[sel])
            f = lo * (hi / lo) ** ((v + rng.random()) / variants)
            if kind == 'bubble':
                L = ns(0.03)
                t = np.arange(L) / SR
                tau = 0.004 + 0.012 * rng.random()
                ph = 2 * np.pi * np.cumsum(f * (1 + 0.9 * t / 0.03)) / SR
                ker = np.sin(ph) * np.exp(-t / tau)
            else:
                L = ns(0.012)
                t = np.arange(L) / SR
                ker = noise(L, seed + v * 13 + ch) * np.exp(-t / (0.0006 + 0.0015 * rng.random()))
                ker = resonator(ker, f, 3.0) * 3
            out[:, ch] += signal.oaconvolve(imp, ker.astype(np.float32))[:n]
    return out * level


def rain(dur, seed=1, level=1.0, heavy=0.6, space='street', gusts=True):
    """city rain: broadband hiss + hard droplet impacts + puddle bubbles + a few heavy gutter drips"""
    n = ns(dur)
    hiss = np.stack([noise(n, seed, 'pink'), noise(n, seed + 1, 'pink')], 1)
    hiss = bp(hiss, 350, 9000, 2) * 0.22
    if gusts:
        g = smooth_rand(n, seed + 2, 0.25, 0.7, 1.0)
        hiss *= g[:, None]
    hard = drops(dur, 1800 * heavy, seed + 3, 'hard', 1800, 7500) * 0.5
    bub = drops(dur, 320 * heavy, seed + 4, 'bubble', 900, 3800) * 0.35
    drip = drops(dur, 2.5, seed + 5, 'bubble', 500, 1400) * 1.4
    x = hiss + hard + bub + lp(drip, 3000)
    x = x + reverb(x, space, 0.18)
    return (x * level).astype(np.float32)


def traffic(dur, seed=1, level=1.0, passes=3):
    """far traffic: a low rumble that swells, and wet tyres hissing past left to right"""
    n = ns(dur)
    rum = lp(noise(n, seed, 'brown'), 160, 2) * smooth_rand(n, seed + 1, 0.15, 0.5, 1.0) * 2.5
    x = st(rum)
    rng = np.random.default_rng(seed)
    for k in range(passes):
        L = rng.uniform(2.5, 4.5)
        m = ns(L)
        tt = np.linspace(-1, 1, m)
        hiss = bp(noise(m, seed + 10 + k, 'pink'), 400, 4500, 2) * np.exp(-(tt * 2.2) ** 2) * 0.5
        hiss += lp(noise(m, seed + 20 + k, 'brown'), 120) * np.exp(-(tt * 2.0) ** 2) * 1.2
        d = rng.choice([-1, 1])
        p = np.clip(tt * 0.8 * d, -1, 1)
        a = (p + 1) * np.pi / 4
        car = np.stack([hiss * np.cos(a), hiss * np.sin(a)], 1)
        add(x, car, rng.uniform(0, max(0.1, dur - L)))
    return (x * level).astype(np.float32)


_BABBLE = {}


def crowd(dur, seed=1, level=1.0, density=9):
    """distant crowd murmur from the game's own mission 1 voice clips (unintelligible by density, filtering and distance)"""
    man = json.load(open(os.path.join(ROOT, 'assets', 'voice', 'manifest.json')))
    used = {v['key'] for v in TRAILER['vo']}
    keys = sorted(k for k, m in man['tags'].items() if m == 'm1' and k not in used and k in man['lines'])
    rng = np.random.default_rng(seed)
    n = ns(dur)
    x = np.zeros((n, 2), np.float32)
    t = 0.0
    while t < dur:
        for _ in range(2):
            k = keys[rng.integers(0, len(keys))]
            if k not in _BABBLE:
                _BABBLE[k] = load_audio(os.path.join(ROOT, 'assets', 'voice', man['lines'][k]), ch=1)
            v = _BABBLE[k] * rng.uniform(0.3, 1.0)
            add(x, pan(v, float(rng.uniform(-0.9, 0.9))), t + rng.uniform(-0.3, 0.3))
        t += 2.6 / density * 2
    x = bp(x, 180, 2600, 2)
    x = x * 0.25 + reverb(x, 'street', 0.6)
    return (x * level).astype(np.float32)


def wind(dur, seed=1, level=1.0, gust=0.6, whistle=0.4, leaves=0.2, bright=1.0):
    """wind: gusting low roar (cut-off follows the gust), whistling resonances, a little leaf/debris rustle"""
    n = ns(dur)
    g = smooth_rand(n, seed, 0.18 + 0.2 * gust, 0.35, 1.0) ** (1 + gust)
    base = np.stack([noise(n, seed + 1, 'brown'), noise(n, seed + 2, 'brown')], 1) * 3
    base = tvlp(base, (180 + 900 * g * bright).astype(np.float32))
    x = base * g[:, None]
    w = noise(n, seed + 3, 'pink')
    for i, f in enumerate((520, 780, 1150)):
        am = smooth_rand(n, seed + 10 + i, 0.3, 0, 1) ** 3
        x += pan(resonator(w, f * bright * (1 + 0.04 * i), 9) * am * g * whistle * 0.6, (-0.5, 0.2, 0.6)[i])
    if leaves:
        r = hp(noise(n, seed + 20), 2500) * (smooth_rand(n, seed + 21, 6, 0, 1) ** 4) * g * leaves * 0.5
        x += np.stack([r, np.roll(r, ns(0.02))], 1)
    return (x * level).astype(np.float32)


def stream(dur, seed=1, level=1.0):
    """valley water: babbling bubbles over a soft wash"""
    n = ns(dur)
    wash = bp(np.stack([noise(n, seed, 'pink'), noise(n, seed + 1, 'pink')], 1), 200, 2500) * 0.15
    bub = drops(dur, 260, seed + 2, 'bubble', 280, 1800) * 0.5
    x = wash + bub
    x = x + reverb(x, 'room', 0.15)
    return (x * level).astype(np.float32)


def lapping(dur, seed=1, level=1.0):
    """still water against stone and dead trunks: slow low splashes"""
    n = ns(dur)
    x = lp(drops(dur, 1.6, seed, 'bubble', 180, 600), 1500) * 2.5
    x += st(lp(noise(n, seed + 3, 'brown'), 300) * smooth_rand(n, seed + 4, 0.5, 0.2, 1.0) * 1.2)
    return (x * level).astype(np.float32)


def bird(kind, seed=1):
    rng = np.random.default_rng(seed)
    if kind == 'whistle':
        L = 0.28
        f = np.linspace(3300, 2400, ns(L)) * (1 + 0.01 * np.sin(np.arange(ns(L)) / SR * 2 * np.pi * 30))
    elif kind == 'two':
        L = 0.38
        f = np.where(np.arange(ns(L)) < ns(0.16), 2900, 2350).astype(float)
    elif kind == 'trill':
        L = 0.5
        t = np.arange(ns(L)) / SR
        f = 5200 - 1100 * ((t * 22) % 1)
    else:
        L = 0.06
        f = np.linspace(3600, 5600, ns(L))
    f = f * rng.uniform(0.92, 1.08)
    t = np.arange(len(f)) / SR
    a = np.sin(np.pi * t / L) ** 0.7
    if kind == 'two':
        a *= (np.abs(t - 0.16) > 0.035)
    if kind == 'trill':
        a *= (np.sin(2 * np.pi * 22 * t) > -0.2)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(ph) + 0.15 * np.sin(2 * ph)) * a
    return fade(x.astype(np.float32), 0.003, 0.01)


def birds(dur, seed=1, level=1.0, rate=1.5, kinds=('whistle', 'two', 'trill', 'chirp')):
    n = ns(dur)
    x = np.zeros((n, 2), np.float32)
    rng = np.random.default_rng(seed)
    t = rng.uniform(0, 0.8)
    while t < dur - 0.6:
        k = kinds[rng.integers(0, len(kinds))]
        b = bird(k, int(rng.integers(0, 1 << 30)))
        dist = rng.uniform(0.2, 1.0)
        b = lp(b, 9000 - 5000 * dist) * (1 - 0.7 * dist)
        add(x, pan(b, float(rng.uniform(-0.8, 0.8))), t)
        if k == 'chirp' and rng.random() < 0.6:
            add(x, pan(b * 0.8, float(rng.uniform(-0.8, 0.8))), t + 0.12)
        t += rng.exponential(1 / rate)
    x = x + reverb(x, 'street', 0.5)
    return (x * level).astype(np.float32)


def bell(f0=110.0, seed=1, length=7.0):
    """a far bell: modal partials (hum, prime, minor tierce, quint, nominal...) with a metal strike"""
    N = ns(length)
    t = np.arange(N) / SR
    parts = [(0.5, 0.6, 5.0), (1.0, 0.8, 3.5), (1.2, 0.5, 2.5), (1.5, 0.35, 2.0), (2.0, 0.6, 1.8), (2.51, 0.25, 1.2),
             (2.66, 0.2, 1.0), (3.01, 0.15, 0.8), (4.1, 0.1, 0.5)]
    x = np.zeros(N, np.float32)
    rng = np.random.default_rng(seed)
    for r, a, d in parts:
        f = f0 * 2 * r
        x += (a * np.exp(-t / d) * (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * (f + rng.uniform(0.3, 1.2)) * t))).astype(np.float32)
    x[:ns(0.004)] += hp(noise(ns(0.004), seed), 2000) * 0.5
    return x * 0.3


def heartbeat(level=1.0):
    N = ns(0.9)
    t = np.arange(N) / SR
    def thump(f, a):
        return a * np.exp(-t / 0.07) * np.sin(2 * np.pi * f * t * (1 - 0.25 * t / 0.9)) + a * 0.3 * lp(noise(N, int(f)), 180) * np.exp(-t / 0.03)
    x = thump(52, 1.0)
    x2 = thump(48, 0.7)
    x = x + np.concatenate([np.zeros(ns(0.24)), x2[:N - ns(0.24)]])
    return st(lp(x.astype(np.float32), 400) * level)


def footstep(seed=1, level=1.0, wet=1.0):
    """a wet footstep on stone: heel thud, toe scuff, a small splash"""
    N = ns(0.35)
    t = np.arange(N) / SR
    heel = lp(noise(N, seed), 250) * np.exp(-t / 0.018) * 1.6
    click = bp(noise(N, seed + 1), 1500, 5000) * np.exp(-t / 0.004) * 0.5
    toe = np.roll(bp(noise(N, seed + 2), 800, 4000) * np.exp(-t / 0.02) * 0.25, ns(0.07))
    splash = np.roll(bp(noise(N, seed + 3), 1200, 7000) * np.exp(-t / 0.045) * 0.45 * wet, ns(0.01))
    return (heel + click + toe + splash).astype(np.float32) * level


def metal_resonance(f0=55.0, length=5.0, seed=1, dropout=(0.95, 0.16)):
    """the causal-consequence stinger: a low struck-metal resonance, a brief dropout, then it returns quieter"""
    N = ns(length)
    t = np.arange(N) / SR
    x = np.zeros(N, np.float32)
    rng = np.random.default_rng(seed)
    for r, a, d in [(1.0, 1.0, 3.2), (2.76, 0.55, 2.2), (5.40, 0.3, 1.4), (8.93, 0.18, 0.9), (13.34, 0.1, 0.6), (1.5, 0.3, 2.6)]:
        f = f0 * r * (1 - 0.006 * t / length)
        ph = 2 * np.pi * np.cumsum(f) / SR
        x += (a * np.exp(-t / d) * (np.sin(ph) + 0.4 * np.sin(ph * 1.0021 + rng.uniform(0, 6)))).astype(np.float32)
    x += lp(noise(N, seed + 3), 150) * np.exp(-t / 0.08) * 1.5  # the strike's weight
    x[:ns(0.01)] += hp(noise(ns(0.01), seed + 4), 1500) * 0.4
    if dropout:
        a, d = ns(dropout[0]), ns(dropout[1])
        g = np.ones(N, np.float32)
        g[a:a + d] = 0
        g[a - ns(0.004):a] = np.linspace(1, 0, ns(0.004))
        g[a + d:a + d + ns(0.03)] = np.linspace(0, 0.55, ns(0.03))
        g[a + d + ns(0.03):] = 0.55
        x *= g
    return x * 0.35


def switch(seed=1, pitch=1.0, level=1.0, tail=1.8):
    """the temporal switch (the game's stinger, rebuilt): a band-pass tear sweeping up then down, a stutter of
    time-grains at the peak, a sub drop and two glass partials. The tear's peak is at +0.30 s."""
    N = ns(tail)
    t = np.arange(N) / SR
    w = noise(N, seed, 'pink')
    fc = np.where(t < 0.3, 200 * (5000 / 200) ** (t / 0.3), 5000 * (120 / 5000) ** np.clip((t - 0.3) / 0.6, 0, 1)) * pitch
    # sweep as a bank of overlapping fixed band-passes, blended by the current centre
    centres = np.geomspace(120, 9000, 18)
    y = np.zeros(N, np.float32)
    for c in centres:
        b = resonator(w, c, 4)
        wgt = np.exp(-(np.log(fc / c) / 0.25) ** 2)
        y += b * wgt
    g = np.where(t < 0.3, (t / 0.3) ** 1.5, np.exp(-(t - 0.3) / 0.22))
    y *= g
    # time-grain stutter around the peak
    grain = y[ns(0.27):ns(0.30)].copy()
    for k in range(3):
        i = ns(0.30 + 0.045 * k)
        y[i:i + len(grain)] += grain * (0.6 - 0.15 * k)
    sub = np.sin(2 * np.pi * np.cumsum(np.where(t < 0.3, 70, 70 * (35 / 70) ** np.clip((t - 0.3) / 1.3, 0, 1))) / SR)
    sub *= np.where(t < 0.3, 0, np.exp(-(t - 0.3) / 0.5)) * 0.9
    x = pan(y * 0.8, -0.3) + pan(np.roll(y, ns(0.012)) * 0.8, 0.3) + st(sub.astype(np.float32))
    add(x, tx.glass(81 + 12 * (pitch > 1.2), 0.3, decay=2.0, seed=seed), 0.3)
    add(x, tx.glass(88, 0.22, decay=1.8, seed=seed + 1), 0.34)
    x = x + reverb(x, 'hall', 0.35)
    return (x * level).astype(np.float32)


def whoosh(length=0.8, seed=1, level=1.0, up=True, lo=150, hi=3000):
    N = ns(length)
    t = np.arange(N) / SR
    w = noise(N, seed, 'pink')
    fc = lo * (hi / lo) ** (t / length if up else 1 - t / length)
    y = np.zeros(N, np.float32)
    for c in np.geomspace(lo, hi, 12):
        y += resonator(w, c, 2.5) * np.exp(-(np.log(fc / c) / 0.35) ** 2)
    e = np.sin(np.pi * t / length) ** 2
    y *= e
    p = np.linspace(-0.6, 0.6, N)
    a = (p + 1) * np.pi / 4
    return (np.stack([y * np.cos(a), y * np.sin(a)], 1) * level).astype(np.float32)


def train_horn(dur=1.3, level=1.0):
    """the game's 311/370 Hz horn pair, played as a real horn: buzzing reeds through bell resonances, distance"""
    N = ns(dur)
    t = np.arange(N) / SR
    x = np.zeros(N, np.float32)
    for f in (311.0, 370.0):
        ff = f * (1 + 0.004 * np.sin(2 * np.pi * 4.5 * t)) * (1 + 0.01 * t / dur)  # slight rise as it approaches
        ph = np.cumsum(ff) / SR
        saw = 2 * (ph - np.floor(ph + 0.5))
        x += np.tanh(saw * 1.6).astype(np.float32)
    y = sum(resonator(x, f, 3) * g for f, g in ((620, 1.0), (1240, 0.7), (2500, 0.35)))
    e = np.clip(t / 0.08, 0, 1) * np.clip((dur - t) / 0.15, 0, 1)
    y = lp(y * e, 4500)
    return (st(y) + reverb(y, 'cathedral', 0.6)) * level


def rail_rise(dur=2.3, level=1.0, seed=1):
    N = ns(dur)
    t = np.arange(N) / SR
    hiss = bp(noise(N, seed, 'pink'), 2500, 9000) * (t / dur) ** 2.2
    rum = lp(noise(N, seed + 1, 'brown'), 140) * (t / dur) ** 1.8 * 3
    clat = np.zeros(N, np.float32)
    for k in np.arange(0.4, dur, 0.21 * 1.0):
        i = ns(k)
        c = lp(noise(ns(0.05), seed + int(k * 100)), 1200) * np.exp(-np.arange(ns(0.05)) / (0.008 * SR))
        clat[i:i + len(c)] += c[:max(0, N - i)] * (k / dur) ** 2
    x = st((hiss * 0.5 + rum + clat * 0.6).astype(np.float32))
    return width(x + reverb(x, 'hall', 0.4), 1.3) * level


def tick_mech(seed=1, level=1.0, big=False):
    x = tx.tick(0.6, seed=seed, tone=0.6 if big else 0.9)
    if big:
        x = x + st(lp(noise(ns(0.06), seed), 600) * np.exp(-np.arange(ns(0.06)) / (0.01 * SR)) * 0.3)
    return x * level


def reversed_tick(seed=1, level=1.0):
    """a street-clock tick preceded by its own reversed echo"""
    tk = tick_mech(seed, 1.0, big=True)
    tail = reverb(np.pad(tk, ((0, ns(0.6)), (0, 0))), 'street', 1.0)
    pre = tail[::-1][-ns(0.45):] * np.linspace(0, 1, ns(0.45))[:, None] ** 2
    return np.concatenate([pre, tk + tail[:len(tk)] * 0.3]) * level, 0.45


def glass_shimmer(dur, seed=1, rate=40, level=1.0, lo=3000, hi=9500):
    """held rain: a constellation of tiny glass pings (the frozen drops)"""
    n = ns(dur)
    x = np.zeros((n, 2), np.float32)
    rng = np.random.default_rng(seed)
    k = rng.poisson(rate * dur)
    L = ns(0.25)
    tt = np.arange(L) / SR
    for i in range(k):
        f = lo * (hi / lo) ** rng.random()
        d = rng.uniform(0.03, 0.18)
        p = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * f * 2.32 * tt)) * np.exp(-tt / d) * rng.uniform(0.2, 1) ** 2
        add(x, pan(p.astype(np.float32), float(rng.uniform(-1, 1))), rng.uniform(0, dur))
    x = x + reverb(x, 'space', 0.4)
    return x * level * 0.08


def shatter(seed=1, level=1.0):
    """glass breaking: a crack, then shards falling (used reversed for the inversion)"""
    N = ns(1.4)
    x = np.zeros((N, 2), np.float32)
    rng = np.random.default_rng(seed)
    crack = hp(noise(ns(0.04), seed), 1200) * np.exp(-np.arange(ns(0.04)) / (0.006 * SR))
    add(x, st(crack), 0)
    L = ns(0.2)
    tt = np.arange(L) / SR
    for i in range(70):
        t0 = rng.exponential(0.18)
        if t0 > 1.1:
            continue
        f = rng.uniform(1800, 9000)
        s = np.sin(2 * np.pi * f * tt) * np.exp(-tt / rng.uniform(0.01, 0.07)) * rng.uniform(0.1, 0.6) * np.exp(-t0 * 2)
        s[:ns(0.002)] += noise(ns(0.002), i) * 0.3
        add(x, pan(s.astype(np.float32), float(rng.uniform(-0.8, 0.8))), t0)
    x = x + reverb(x, 'room', 0.4)
    return x * level


def shell_return(seed=1, level=1.0):
    """'returned shells': an incoming whistle played backwards, rising into a dry crack (never a boom)"""
    L = 1.0
    N = ns(L)
    t = np.arange(N) / SR
    f = 1700 * (650 / 1700) ** (t / L)
    w = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4 + resonator(noise(N, seed), 1200, 3) * 0.3
    w *= np.clip(t / 0.3, 0, 1) * (0.3 + 0.7 * t / L)
    w = w[::-1]  # reversed: rises
    crack = hp(noise(ns(0.05), seed + 2), 700) * np.exp(-np.arange(ns(0.05)) / (0.003 * SR)) * 1.6
    thud = lp(noise(ns(0.08), seed + 3), 180) * np.exp(-np.arange(ns(0.08)) / (0.015 * SR)) * 1.2
    x = np.concatenate([w, crack + np.pad(thud, (0, max(0, len(crack) - len(thud))))[:len(crack)]])
    x = st(x.astype(np.float32))
    return (x + reverb(x, 'street', 0.35)) * level, L


def siren(level=1.0, seed=1):
    """one surge-siren wail, far across water"""
    L = 2.6
    N = ns(L)
    t = np.arange(N) / SR
    f = np.interp(t, [0, 1.1, 2.6], [420, 880, 480])
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.tanh(2.2 * np.sin(ph)) * np.clip(t / 0.3, 0, 1) * np.clip((L - t) / 0.6, 0, 1)
    x = lp(x.astype(np.float32), 2800) * 0.4
    return (st(x) * 0.6 + reverb(x, 'cathedral', 0.8)) * level


def groan(dur=2.4, f_lo=28, f_hi=60, seed=1, level=1.0):
    """steel under load: stick-slip pulses at a wandering rate through metal-panel resonances"""
    N = ns(dur)
    t = np.arange(N) / SR
    rate = f_lo + (f_hi - f_lo) * smooth_rand(N, seed, 1.2, 0, 1)
    ph = np.cumsum(rate) / SR
    pulses = (np.diff(np.floor(ph), prepend=0) > 0).astype(np.float32) * (0.5 + np.random.default_rng(seed).random(N))
    y = sum(resonator(pulses, f, 18) * g for f, g in ((170, 1.0), (390, 0.8), (730, 0.5), (1240, 0.3), (2100, 0.15)))
    y = y * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.8
    y = y + lp(noise(N, seed + 1, 'brown'), 90) * np.sin(np.pi * t / dur) * 2
    y = y.astype(np.float32) * 0.4
    return (st(y) + reverb(y, 'cathedral', 0.5)) * level


def hum(dur, f0=55.0, level=1.0, seed=1, harmonics=((1, 1.0), (2, 0.5), (3, 0.25), (4, 0.1)), air=0.3, buzz=0.0):
    """machine / mains hum with slow beating partials and an air-handling wash"""
    N = ns(dur)
    t = np.arange(N) / SR
    x = np.zeros(N, np.float32)
    rng = np.random.default_rng(seed)
    for h, a in harmonics:
        x += (a * np.sin(2 * np.pi * f0 * h * t + rng.uniform(0, 6)) * (1 + 0.15 * np.sin(2 * np.pi * rng.uniform(0.05, 0.3) * t))).astype(np.float32)
    if buzz:
        ph = f0 * 2 * t
        x += buzz * bp(np.tanh(6 * np.sin(2 * np.pi * ph)).astype(np.float32), 300, 3000) * 0.3
    x = lp(x, 900) * 0.2
    a = lp(noise(N, seed + 5, 'pink'), 1800) * air * 0.12
    return (st(x) + np.stack([a, np.roll(a, ns(0.01))], 1)) * level


def chronolith_hum(dur, level=1.0, seed=1):
    """the ring: a deep, slowly beating hum, a high singing partial and the rotating air of the chamber"""
    N = ns(dur)
    t = np.arange(N) / SR
    x = hum(dur, 55.0, 1.0, seed, ((1, 1.0), (2.007, 0.5), (3.01, 0.22), (5.03, 0.06)), air=0.0)
    sing = np.sin(2 * np.pi * 1760.0 * t) * 0.006 * (1 + np.sin(2 * np.pi * 0.21 * t))
    rot = bp(noise(N, seed + 3, 'pink'), 300, 2200) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.33 * t)) * 0.05
    a = (np.sin(2 * np.pi * 0.33 * t) + 1) * np.pi / 4
    x = x + st(sing.astype(np.float32)) + np.stack([rot * np.cos(a), rot * np.sin(a)], 1)
    return (x * level).astype(np.float32)


def door_rain(level=1.0, seed=1):
    """the clockmaker's door: latch, a dry wooden creak, a small shop bell"""
    N = ns(1.6)
    x = np.zeros((N, 2), np.float32)
    latch = sum(resonator(np.pad(noise(ns(0.004), seed), (0, ns(0.06))), f, 30) for f in (2800, 4100)) * 1.5
    add(x, st(latch), 0.0)
    add(x, st(latch * 0.6), 0.09)
    cl = 0.8
    m = ns(cl)
    t = np.arange(m) / SR
    rate = 35 + 60 * np.sin(np.pi * t / cl) ** 2
    ph = np.cumsum(rate) / SR
    pul = (np.diff(np.floor(ph), prepend=0) > 0).astype(np.float32)
    creak = sum(resonator(pul, f, 12) * g for f, g in ((420, 1.0), (880, 0.6), (1650, 0.35), (2900, 0.15))) * np.sin(np.pi * t / cl)
    add(x, st(creak.astype(np.float32) * 0.5), 0.15)
    for k, tt in enumerate((0.3, 0.42)):
        b = sum(np.sin(2 * np.pi * 1650 * r * np.arange(ns(1.0)) / SR) * a * np.exp(-np.arange(ns(1.0)) / SR / d)
                for r, a, d in ((1, 1, 0.5), (2.41, 0.4, 0.25), (4.1, 0.2, 0.12)))
        add(x, pan(b.astype(np.float32) * 0.12 * (1 - 0.3 * k), 0.3), tt)
    return (x + reverb(x, 'room', 0.35)) * level


def impact(seed=1, level=1.0, f0=70, crack=0.5):
    """a restrained physical impact on a montage cut: a low tom-like body hit and a dry crack, short room"""
    x = tx.tom(0.8, f0, seed)
    c = hp(noise(ns(0.03), seed + 7), 1200) * np.exp(-np.arange(ns(0.03)) / (0.003 * SR)) * crack
    x[:len(c)] += pan(c, 0.0)
    return (x + reverb(x, 'room', 0.3)) * level


def rewind_ripple(src, length=1.8):
    """a reversed snatch of the scene, accelerating like a tape rewinding, with a rippling band-pass"""
    y = src[::-1]
    N = ns(length)
    rates = np.linspace(1.0, 4.5, N)
    pos = np.cumsum(rates)
    pos = pos[pos < len(y) - 2]
    from sampler import hermite
    z = hermite(y, pos)
    t = np.arange(len(z)) / SR
    rip = (1 + 0.6 * np.sin(2 * np.pi * (3 + 9 * t / length) * t))[:, None]
    z = z * rip * np.clip(t / 0.2, 0, 1)[:, None] * np.clip((length - t) / 0.3, 0, 1)[:, None]
    return z.astype(np.float32)


def field_whine(dur, level=1.0, f=3100.0):
    N = ns(dur)
    t = np.arange(N) / SR
    x = np.sin(2 * np.pi * f * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t)) * 0.05
    x += resonator(noise(N, 3), f / 2, 40) * 0.05
    return st((x * np.clip(t / 0.05, 0, 1) * np.clip((dur - t) / 0.1, 0, 1)).astype(np.float32)) * level


def anchor_fail(dur=1.1, level=1.0, seed=1):
    """the storm anchor's hum failing: pitch sagging, stuttering"""
    N = ns(dur)
    t = np.arange(N) / SR
    f = 73 * (52 / 73) ** (t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.3 * np.tanh(4 * np.sin(3 * ph))) * 0.25
    gate = (smooth_rand(N, seed, 14, 0, 1) > 0.35).astype(np.float32)
    gate = lp(gate, 60)
    return st((x * gate).astype(np.float32)) * level


# ============================================================================================== the trailer
def build(length=LEN):
    """the trailer's sound design. Levels are absolute: beds are set by RMS (dBFS), spot effects by peak (dBFS)."""
    amb = np.zeros((ns(length) + 1, 2), np.float32)
    fx = np.zeros_like(amb)

    def A(x, t, rms_db):
        add(amb, at_rms(x, rms_db), t)

    def F(x, t, peak_db):
        add(fx, at_peak(x, peak_db), t)

    def bed(x, t0, t1, rms_db, fin=0.4, fout=0.4):
        x = at_rms(x[:ns(t1 - t0)], rms_db)
        add(amb, fade(x, fin, fout), t0)

    # ----- 0-19.75 Rain City (s01-s05): rain, far traffic, the crowd
    r = rain(20.5, seed=1, level=1.0, heavy=0.7)
    r *= env(len(r), [(0, 0), (1.5, 1), (17.5, 1), (17.6, 0.75), (20.5, 0.75)])[:, None]
    bed(r, 0.0, 19.75, -36, fin=0.02, fout=0.004)
    bed(traffic(19.0, seed=2, passes=4), 0.4, 17.5, -45, fin=1.2, fout=0.3)
    bed(crowd(13.5, seed=3), 1.5, 14.6, -43, fin=2.5, fout=0.6)
    # s05 station: platform crowd under the canopy, the train
    bed(crowd(2.4, seed=4, density=12), 17.5, 19.75, -38, fin=0.1, fout=0.004)
    F(train_horn(1.35), 17.6, -15)
    F(rail_rise(2.2, seed=5), 17.55, -12)
    # spot effects: the toy un-falls; the band flares; the clock runs backwards
    g = tx.glass(93, 0.2, seed=6)
    F(plus(whoosh(0.85, seed=6, up=False, lo=300, hi=4000), tx.reversed_swell(g + reverb(g, 'hall', 0.5), 0.85) * 0.6), 9.9, -24)
    ch = plus(tx.glass(88, 0.6, decay=3.0, seed=13), tx.glass(95, 0.35, decay=2.5, seed=14))
    F(ch + reverb(ch, 'space', 0.5), 13.2, -17)
    A(chronolith_hum(1.8, seed=2) * np.linspace(0, 1, ns(1.8))[:, None], 11.4, -42)
    for k, tt in enumerate((14.5, 15.5, 16.5)):
        x, pre = reversed_tick(seed=40 + k)
        F(x, tt - pre + 0.25, -19)

    # ----- 19.75-20.75: the Zero Second (nothing; gated)
    # ----- 20.75-32.25 the held second: resonance, held-rain shimmer, Kai's footsteps, Mira comes apart
    F(metal_resonance(55.0, 5.5, seed=7, dropout=(1.05, 0.16)), 20.75, -13)
    A(glass_shimmer(11.3, seed=8, rate=26, level=1.0), 20.9, -42)
    A(fade(hum(11.4, 46.0, seed=9, harmonics=((1, 0.3), (2, 0.2)), air=0.25), 1.0, 1.0), 20.8, -48)
    for k, tt in enumerate(np.arange(23.95, 27.6, 0.56)):
        fs = footstep(seed=60 + k, level=1.0, wet=0.8)
        F(pan(fs, -0.15 + 0.3 * (k % 2)) + reverb(fs, 'hall', 0.35), tt + np.random.default_rng(k).normal(0, 0.012), -22)
    A(glass_shimmer(1.7, seed=10, rate=110, lo=2500, hi=11000) * np.linspace(0, 1, ns(1.7))[:, None] ** 2, 30.6, -38)

    # ----- 32.25-35.0 black: only the voice (the score holds a sub and a cello)

    # ----- 35.0-45.0 Helix (2049): lockdown hum, muffled alarm; the Chronolith chamber; the first switch
    bed(hum(5.6, 50.0, seed=11, air=0.8, buzz=0.3), 35.0, 40.375, -40, fin=0.02, fout=0.3)
    for k in range(2):
        al = np.zeros(ns(0.8), np.float32)
        tt = np.arange(ns(0.36)) / SR
        al[:len(tt)] = np.sign(np.sin(2 * np.pi * 880 * tt)) * 0.5
        al[ns(0.36):ns(0.72)] = np.sign(np.sin(2 * np.pi * 660 * tt[:ns(0.36)])) * 0.5
        al = lp(al, 1100, 4)
        F(st(al) + reverb(al, 'hall', 0.6), 35.02 + k * 0.82, -22)
    bed(chronolith_hum(8.0, seed=12), 37.29, 45.0, -38, fin=0.05, fout=0.1)
    flashes = [hum(0.8, 60.0, seed=30, air=0.6, buzz=0.6), wind(0.8, seed=31, gust=0.9), rain(0.8, seed=32, heavy=1.0),
               chronolith_hum(0.8, seed=33)]
    for k, tt in enumerate((41.4, 42.2, 43.0, 43.8)):
        F(switch(seed=20 + k, pitch=1.0 + 0.06 * k), tt - 0.3, -13 + k)
        A(fade(flashes[k], 0.02, 0.15), tt, -36)
    F(switch(seed=24, pitch=0.9), 45.0 - 0.3, -10)

    # ----- 45.0-51.17 the ancient valley; 51.17 the flood (switch + causal resonance); the drowned reservoir
    bed(stream(6.4, seed=40), 45.0, 51.167, -37, fin=0.25, fout=0.05)
    bed(birds(6.4, seed=41, rate=1.6), 45.0, 51.167, -41, fin=0.1, fout=0.05)
    bed(wind(6.4, seed=42, gust=0.3, whistle=0.1, leaves=0.4), 45.0, 51.167, -42, fin=0.25, fout=0.05)
    F(switch(seed=43, pitch=0.85), 51.167 - 0.3, -11)
    F(metal_resonance(49.0, 4.0, seed=44, dropout=(0.75, 0.14)), 51.167, -13)
    bed(lapping(4.8, seed=45), 51.167, 55.75, -38, fin=0.05, fout=0.6)
    bed(hum(4.8, 50.0, seed=46, harmonics=((1, 1.0), (2, 0.4), (3, 0.15)), air=0.1), 51.167, 55.75, -40, fin=0.3, fout=0.6)
    bed(wind(4.8, seed=47, gust=0.4, whistle=0.3, leaves=0.05), 51.167, 55.75, -42, fin=0.3, fout=0.6)

    # ----- 55.75 the Sky House at dawn, dissolving to Helix's floodlit night
    bed(wind(3.2, seed=50, gust=0.2, whistle=0.2, leaves=0.1), 55.6, 58.833, -42, fin=0.5, fout=0.8)
    bed(birds(3.2, seed=51, rate=0.8, kinds=('whistle', 'two')), 55.75, 58.833, -44, fin=0.3, fout=0.9)
    bed(traffic(2.0, seed=52, passes=1), 57.2, 58.85, -44, fin=0.8, fout=0.05)
    # ----- 58.83 the clockmaker's door in the rain; clocks inside
    bed(rain(2.6, seed=53, heavy=0.8), 58.833, 61.167, -33, fin=0.05, fout=0.05)
    F(door_rain(seed=54), 58.833, -16)
    for k in range(6):
        F(tick_mech(seed=70 + k), 59.0 + k * 0.38, -32)

    # ----- 61.17 2196: wind, birds, a far bell; the memorial square
    F(switch(seed=55, pitch=0.8), 61.167 - 0.3, -10)
    bed(wind(7.8, seed=56, gust=0.6, whistle=0.45, leaves=0.3), 61.167, 68.833, -36, fin=0.05, fout=0.4)
    bed(birds(7.6, seed=57, rate=0.9, kinds=('whistle', 'chirp', 'trill')), 61.3, 68.833, -44, fin=0.3, fout=0.5)
    b = lp(bell(110.0, seed=58, length=6.5), 3500)
    F(st(b) * 0.4 + reverb(b, 'space', 0.9), 61.6, -21)
    F(groan(2.6, seed=59), 63.0, -20)
    F(groan(2.0, 22, 45, seed=60), 66.0, -22)

    # ----- 68.83 the man behind the glass: gallery air, three notes tapped on the glass
    F(whoosh(0.7, seed=61, up=False, lo=200, hi=1500), 68.833 - 0.45, -26)
    bed(hum(3.9, 60.0, seed=62, harmonics=((1, 0.2), (2, 0.3)), air=0.6), 68.833, 72.708, -44, fin=0.1, fout=0.3)
    for n, tt in zip((76, 83, 81), (70.2, 70.75, 71.3)):
        g = tx.glass(n, 0.55, decay=2.2, seed=n)
        knock = lp(noise(ns(0.03), n), 350) * np.exp(-np.arange(ns(0.03)) / (0.005 * SR)) * 0.6
        g[:len(knock)] += pan(knock, 0.0)
        F(g + reverb(g, 'room', 0.4), tt, -15)

    # ----- 75.0-97.375 montage
    F(heartbeat(), 75.0, -7)
    meridian = crowd(3.0, seed=63, density=14) + traffic(3.0, seed=64, passes=2)
    F(rewind_ripple(meridian, 1.9), 77.05, -16)
    cuts = [79.083, 81.083, 83.125, 85.167, 87.208, 88.208, 89.25, 90.25, 91.292, 92.292, 93.292, 94.333, 95.333, 96.375]
    for k, c in enumerate(cuts):
        if c in (93.292, 96.375):
            continue  # switch transitions instead
        F(impact(seed=80 + k, f0=64 + 6 * (k % 3), crack=0.35 + 0.1 * (k % 2)), c, -13 + 0.3 * min(k, 8))
    # 79.08 Echo Step: afterimage swish and a doubled transient; the shutter
    F(whoosh(0.3, seed=90, up=True, lo=600, hi=6000), 79.083 + 0.15, -17)
    fs = footstep(seed=91, level=1.0, wet=0.2)
    F(st(fs), 79.45, -15)
    F(st(lp(fs, 2500)) + reverb(fs, 'hall', 0.6), 79.51, -21)
    F(hp(groan(0.6, 60, 120, seed=92), 400), 80.2, -24)
    # 81.08 inversion: rain backwards, glass flying back together
    A(rain(2.1, seed=93, heavy=1.0)[::-1] * np.linspace(0.2, 1, ns(2.1))[:, None], 81.083, -32)
    shx = shatter(seed=94)[::-1]
    F(shx, 82.75 - len(shx) / SR, -17)
    # 83.13 returned shells
    for k, tt in enumerate((83.55, 84.4)):
        x, lead = shell_return(seed=95 + k)
        F(x, tt - lead, -13)
    A(wind(2.1, seed=96, gust=0.7), 83.125, -38)
    # 85.17 Sera at the veil
    A(glass_shimmer(2.0, seed=97, rate=60, lo=4000, hi=11000), 85.2, -40)
    A(wind(2.0, seed=98, gust=0.3), 85.167, -42)
    # half-bar cuts: a breath of each world
    A(fade(wind(1.0, seed=100, gust=0.8), 0.01, 0.1), 87.208, -34)
    A(fade(hum(1.0, 100.0, seed=101, buzz=0.8, air=0.0), 0.01, 0.1), 87.208, -40)
    A(fade(chronolith_hum(1.0, seed=102), 0.01, 0.1), 88.208, -36)
    A(fade(wind(1.0, seed=103, gust=0.5), 0.01, 0.1), 88.208, -40)
    A(field_whine(1.0), 89.25, -40)
    F(siren(seed=104), 90.25, -16)
    A(fade(plus(lp(rain(1.0, seed=105, heavy=1.2), 2500), st(lp(noise(ns(1.0), 106, 'brown'), 500))), 0.02, 0.1), 90.25, -32)
    A(fade(wind(1.0, seed=107, gust=0.5) + chronolith_hum(1.0, seed=108) * 0.5, 0.01, 0.1), 91.292, -36)
    F(groan(1.4, 18, 40, seed=109), 92.292, -12)
    F(switch(seed=110, pitch=0.9), 93.292 - 0.3, -11)
    A(fade(lapping(1.0, seed=111), 0.01, 0.1), 93.292, -36)
    A(fade(wind(1.0, seed=112, gust=1.0, whistle=0.8), 0.01, 0.08), 94.333, -27)
    F(anchor_fail(1.0, seed=113), 94.333, -15)
    A(fade(plus(chronolith_hum(1.0, seed=114), glass_shimmer(1.0, seed=115, rate=60)), 0.01, 0.1), 95.333, -36)
    F(switch(seed=116, pitch=1.15), 96.375 - 0.3, -11)
    A(glass_shimmer(1.0, seed=117, rate=90), 96.375, -38)

    # ----- 97.375-98.583 silence; the final image: the Chronolith hum, under the cards; the button
    bed(chronolith_hum(11.0, seed=120), 98.583, 109.583, -40, fin=0.6, fout=1.5)
    bed(chronolith_hum(2.6, seed=121) * env(ns(2.6), [(0, 0.6), (2.3, 1.2)])[:, None], 109.583, 112.083, -35, fin=0.3, fout=0.004)
    A(fade(hum(2.5, 50.0, seed=122, harmonics=((1, 0.1),), air=0.5), 0.3, 0.004), 109.583, -46)
    sw = at_peak(switch(seed=123, pitch=1.0), -9)
    add(fx, sw[:ns(112.083 - 111.9)], 111.9)  # the cut to black lands on the rising tear
    # ----- 112.08 end card: a light rain tail
    bed(rain(5.0, seed=124, heavy=0.35), 112.083, length, -41, fin=0.4, fout=1.0)

    return amb, fx


def build_store(length=30.0):
    """store cut: ambience of each shot, switch on era changes, impacts on the cuts, the hum under s35"""
    amb = np.zeros((ns(length) + 1, 2), np.float32)
    fx = np.zeros_like(amb)
    rows = TRAILER['store_cut']
    t = 0.0
    starts = []
    for r in rows:
        starts.append(round(t, 3))
        t += r['dur']
    era = {'s01': 'rain', 's07': 'held', 's11': 'chamber', 's14': 'valley', 's17': 'wind', 's21': 'rain', 's22': 'rain',
           's23': 'wind', 's28': 'water', 's30': 'wind', 's35': 'hum'}
    prev = None
    for r, s0 in zip(rows, starts):
        e = era[r['shot']]
        d = r['dur']
        bedx = {'rain': lambda: at_rms(rain(d, seed=int(s0 * 10) + 1, heavy=0.7), -36),
                'held': lambda: at_rms(glass_shimmer(d, seed=3, rate=30), -42),
                'chamber': lambda: at_rms(chronolith_hum(d, seed=4), -38),
                'valley': lambda: at_rms(stream(d, seed=5), -37) + at_rms(birds(d, seed=6, rate=1.4), -41),
                'wind': lambda: at_rms(wind(d, seed=int(s0 * 10) + 7, gust=0.6), -37),
                'water': lambda: at_rms(lapping(d, seed=8), -38),
                'hum': lambda: at_rms(chronolith_hum(d, seed=9), -40)}[e]()
        add(amb, fade(bedx, 0.02, 0.05), s0)
        if prev is not None:
            if (prev in ('rain', 'held', 'chamber')) != (e in ('rain', 'held', 'chamber')) or e == 'chamber':
                add(fx, at_peak(switch(seed=int(s0 * 10)), -11), s0 - 0.3)
            elif s0 < 25.6:
                add(fx, at_peak(impact(seed=int(s0 * 10), f0=66), -13), s0)
        prev = e
    add(fx, at_peak(heartbeat(), -9), 0.0)
    return amb, fx


def main():
    if '--store' in sys.argv:
        amb, fx = build_store()
        n = ns(30.0)
        x = (amb + fx)[:n]
        t = np.arange(n) / SR
        x *= np.clip((30.0 - t) / 1.2, 0, 1)[:, None]
        write_wav(os.path.join(OUT, 'store', 'sfx.wav'), x)
        print('store sfx done')
        return
    amb, fx = build()
    n = ns(LEN)
    amb, fx = amb[:n], fx[:n]
    t = np.arange(n) / SR
    g = np.ones(n, np.float32)
    for t0, t1 in ((19.75, 20.75), (97.375, 98.583)):
        g[ns(t0):ns(t1)] = 0
        g[ns(t0) - ns(0.004):ns(t0)] = np.linspace(1, 0, ns(0.004))
    g *= np.clip((LEN - t) / 1.0, 0, 1)
    g[ns(112.083) - ns(0.004):ns(112.083)] *= np.linspace(1, 0, ns(0.004))  # the cut to black lands on the switch
    g[ns(112.083):ns(112.083) + ns(0.4)] *= 0  # then a breath of nothing before the rain tail
    amb = hp(amb, 30, 2) * g[:, None]  # filter first, gate last: nothing may ring into the silences
    fx = hp(fx, 25, 2) * g[:, None]
    write_wav(os.path.join(OUT, 'stems', 'sfx_amb.wav'), amb)
    write_wav(os.path.join(OUT, 'stems', 'sfx_fx.wav'), fx)
    write_wav(os.path.join(OUT, 'stems', 'sfx.wav'), amb + fx)
    print('sfx', round(n / SR, 3), 's; peak amb', float(np.abs(amb).max()), 'fx', float(np.abs(fx).max()))


if __name__ == '__main__':
    main()
