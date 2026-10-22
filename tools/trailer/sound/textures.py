"""AFTERZERO trailer sound: synthesised textures and drums that no sample set covers.

Physical/modal models rather than oscillators: bowed metal is noise bowing a bank of high-Q inharmonic resonators;
glass is a struck (or rubbed) set of beating inharmonic partials; the frame drum is a membrane-mode bank excited by a
hand slap; breath is formant-filtered noise with a breathing envelope. Every function returns stereo float32 (n, 2).
"""
import numpy as np
from dsp import SR, ns, noise, resonator, lp, hp, bp, pan, smooth_rand, fade, midi_hz, reverb, stereo

METAL_RATIOS = [1.0, 1.498, 2.07, 2.76, 3.42, 4.07, 5.13, 6.31, 7.6]


def bowed_metal(f0, dur, seed=1, swell=(0.35, 0.5), bright=1.0, q=700, spread=0.6):
    """bowed cymbal / bowed plate: pink-noise bowing excites inharmonic modes; slow pressure changes make it sing"""
    n = ns(dur)
    rng = np.random.default_rng(seed)
    pressure = smooth_rand(n, seed + 1, 0.7, 0.55, 1.0)
    exc = noise(n, seed, 'pink') * pressure
    out = np.zeros((n, 2), np.float32)
    for i, r in enumerate(METAL_RATIOS):
        f = f0 * r * (1 + rng.normal(0, 0.002))
        if f > 14000:
            break
        g = (0.8 ** i) * (bright ** i) * rng.uniform(0.6, 1.0)
        m = resonator(exc, f, q * (1 + 0.3 * i)) * g
        # each mode blooms at its own moment, like a bow finding the plate
        bloom = smooth_rand(n, seed + 10 + i, 0.4, 0.3, 1.0)
        out += pan(m * bloom, float(np.clip(rng.uniform(-spread, spread), -1, 1)))
    t = np.arange(n) / SR
    a, r = swell
    e = np.clip(t / max(dur * a, 1e-3), 0, 1) ** 2 * np.clip((dur - t) / max(dur * r, 1e-3), 0, 1) ** 1.5
    out *= e[:, None]
    out /= np.max(np.abs(out)) + 1e-9
    return out.astype(np.float32)


GLASS_RATIOS = [(1.0, 1.0, 1.0), (2.32, 0.32, 0.55), (4.25, 0.12, 0.33), (6.63, 0.05, 0.2)]


def glass(n, vel=0.5, decay=4.5, seed=1, pan_pos=0.0, length=None):
    """struck glass: beating inharmonic partials with a soft mallet tick"""
    f0 = float(midi_hz(n))
    length = length or decay * 1.4
    N = ns(length)
    t = np.arange(N) / SR
    rng = np.random.default_rng(seed)
    x = np.zeros(N, np.float32)
    for r, a, d in GLASS_RATIOS:
        f = f0 * r
        if f > 18000:
            continue
        beat = rng.uniform(0.4, 1.6)
        ph = rng.uniform(0, 2 * np.pi)
        x += (a * np.exp(-t / (decay * d)) * (np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * (f + beat) * t + ph))).astype(np.float32)
    att = np.clip(t / 0.002, 0, 1)
    x *= att
    tick = hp(noise(ns(0.01), seed + 3), 3000) * np.exp(-np.arange(ns(0.01)) / (0.0015 * SR)) * 0.3
    x[:len(tick)] += tick
    x *= vel / 1.6
    return fade(pan(x, pan_pos), 0, 0.2)


def glass_sustain(n, dur, vel=0.4, seed=1, pan_pos=0.0, attack=None):
    """rubbed glass (glass harmonica): a pure, slowly breathing tone with a faint rubbed-noise halo"""
    f0 = float(midi_hz(n))
    N = ns(dur)
    t = np.arange(N) / SR
    trem = 1 + 0.18 * np.sin(2 * np.pi * (0.9 + 0.3 * (seed % 3)) * t + seed)
    x = (np.sin(2 * np.pi * f0 * t) + 0.12 * np.sin(2 * np.pi * f0 * 2.32 * t)) * trem
    halo = resonator(noise(N, seed + 5), f0, 120) * 0.6
    x = (x + halo).astype(np.float32)
    a = attack or min(1.2, dur * 0.3)
    e = np.clip(t / a, 0, 1) ** 2 * np.clip((dur - t) / min(1.5, dur * 0.4), 0, 1)
    return pan(x * e * vel * 0.5, pan_pos)


def sub_drone(f, dur, level=0.5, seed=1, fin=1.5, fout=1.5):
    N = ns(dur)
    t = np.arange(N) / SR
    wob = 1 + 0.08 * np.sin(2 * np.pi * 0.13 * t + seed)
    x = (np.sin(2 * np.pi * f * t) + 0.22 * np.sin(2 * np.pi * 2 * f * t + 0.5) + 0.06 * np.sin(2 * np.pi * 3 * f * t)) * wob
    e = np.clip(t / fin, 0, 1) * np.clip((dur - t) / fout, 0, 1)
    return stereo(lp((x * e * level).astype(np.float32), 240, 2))


def breath(dur, seed=1, level=0.3, center=900, rate=0.22):
    """breath-like texture: formant-filtered noise rising and falling like slow breathing"""
    N = ns(dur)
    t = np.arange(N) / SR
    w = noise(N, seed, 'pink')
    x = bp(w, center * 0.6, center * 1.5) + 0.35 * bp(w, center * 2.6, center * 3.6) + 0.15 * hp(w, 6000)
    cyc = 0.5 - 0.5 * np.cos(2 * np.pi * rate * t + seed)
    cyc = cyc ** 1.6 * smooth_rand(N, seed + 2, 0.3, 0.6, 1.0)
    e = np.clip(t / 1.5, 0, 1) * np.clip((dur - t) / 1.5, 0, 1)
    L = x * cyc * e * level
    R = np.roll(L, ns(0.013)) * 0.9 + bp(noise(N, seed + 9, 'pink'), center * 0.7, center * 1.4) * cyc * e * level * 0.3
    return np.stack([L, R], 1).astype(np.float32)


MEMBRANE = [(1.0, 1.0, 0.42), (1.594, 0.62, 0.3), (2.136, 0.48, 0.24), (2.296, 0.36, 0.2), (2.653, 0.3, 0.16),
            (2.918, 0.24, 0.13), (3.156, 0.2, 0.11), (3.5, 0.14, 0.09)]


def frame_drum(vel=0.7, f0=78, seed=1, damp=1.0, slap=0.5, pan_pos=0.0, length=1.4):
    """hand-played frame drum: membrane modes with a pitch settle, a skin-noise wash and the hand slap"""
    N = ns(length)
    t = np.arange(N) / SR
    rng = np.random.default_rng(seed)
    x = np.zeros(N, np.float32)
    settle = 1 + 0.035 * vel * np.exp(-t / 0.03)
    for r, a, d in MEMBRANE:
        f = f0 * r * (1 + rng.normal(0, 0.004))
        ph = np.cumsum(2 * np.pi * f * settle / SR)
        x += (a * rng.uniform(0.7, 1.1) * np.exp(-t / (d * damp)) * np.sin(ph)).astype(np.float32)
    skin = bp(noise(N, seed + 1), 180, 2400) * np.exp(-t / 0.07) * 0.35
    sl = lp(noise(ns(0.012), seed + 2), 3500) * np.exp(-np.arange(ns(0.012)) / (0.002 * SR)) * slap
    x += skin
    x[:len(sl)] += sl
    x *= np.clip(t / 0.0015, 0, 1)
    x = lp(x, 1800 + 5000 * vel, 2) * vel ** 1.4
    return fade(pan(x * 0.55, pan_pos), 0, 0.1)


def tom(vel=0.7, f0=95, seed=1, pan_pos=0.0):
    """low tom: a deeper, longer membrane with a stick attack"""
    N = ns(1.6)
    t = np.arange(N) / SR
    rng = np.random.default_rng(seed)
    x = np.zeros(N, np.float32)
    settle = 1 + 0.06 * vel * np.exp(-t / 0.05)
    for r, a, d in MEMBRANE[:6]:
        ph = np.cumsum(2 * np.pi * f0 * r * (1 + rng.normal(0, 0.003)) * settle / SR)
        x += (a * np.exp(-t / (d * 1.5)) * np.sin(ph)).astype(np.float32)
    stick = hp(noise(ns(0.008), seed + 4), 1200) * np.exp(-np.arange(ns(0.008)) / (0.0012 * SR)) * 0.6
    x[:len(stick)] += stick
    x += bp(noise(N, seed + 5), 100, 900) * np.exp(-t / 0.09) * 0.3
    x = lp(x, 2500 + 4000 * vel, 2) * vel ** 1.3
    return fade(pan(x * 0.6, pan_pos), 0, 0.1)


def tick(vel=0.3, seed=1, tone=1.0, pan_pos=0.0):
    """precise mechanical tick (a clock escapement): resonant metal click"""
    N = ns(0.06)
    exc = noise(N, seed) * np.exp(-np.arange(N) / (0.0008 * SR))
    x = sum(resonator(exc, f * tone, 25) * g for f, g in ((2900, 1.0), (4700, 0.7), (7300, 0.45), (10100, 0.25)))
    x = x * np.exp(-np.arange(N) / (0.012 * SR))
    return pan((x * vel * 2.2).astype(np.float32), pan_pos)


def reversed_swell(x, length):
    """reverse a sound (with its reverb) and fit it to length seconds, ending at full level"""
    y = x[::-1]
    n = ns(length)
    y = y[-n:] if len(y) >= n else np.concatenate([np.zeros((n - len(y), y.shape[1]), np.float32), y])
    t = np.linspace(0, 1, len(y))
    return (y * (t ** 1.5)[:, None]).astype(np.float32)


def impact_tail(seed=1, vel=0.8, f0=70):
    """a dry physical impact (tom + wood crack + short room), the material a reversed impact is made from"""
    x = tom(vel, f0, seed)
    crack = hp(noise(ns(0.03), seed + 7), 900) * np.exp(-np.arange(ns(0.03)) / (0.004 * SR)) * 0.5 * vel
    x[:len(crack)] += pan(crack, 0.0)
    return x + reverb(x, 'room', 0.5)
