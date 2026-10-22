"""AFTERZERO trailer sound: shared DSP (48 kHz float32 stereo, numpy/scipy only).

Arrays are float32 shaped (n, 2) for stereo or (n,) for mono. Times are seconds on the trailer timeline.
Everything is deterministic: every random source takes an explicit seed.
"""
import os
import subprocess
import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
OUT = os.environ.get('TRAILER_AUDIO', '/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad/trailer/audio')
SAMPLES = os.environ.get('TRAILER_SAMPLES', '/home/user/tools/trailer-samples')
CACHE = os.path.join(SAMPLES, 'cache')


def db(x):
    return 20 * np.log10(np.maximum(np.abs(x), 1e-12))


def undb(d):
    return 10 ** (np.asarray(d) / 20)


def midi_hz(n):
    return 440.0 * 2 ** ((np.asarray(n, dtype=float) - 69) / 12)


def ns(t):
    return int(round(t * SR))


def silence(sec, ch=2):
    return np.zeros((ns(sec), ch) if ch > 1 else ns(sec), np.float32)


def stereo(x):
    return x if x.ndim == 2 else np.stack([x, x], 1)


def mono(x):
    return x if x.ndim == 1 else x.mean(1)


def pan(x, p):
    """equal-power pan of a mono signal, p in -1..1"""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1).astype(np.float32)


def width(x, w):
    """mid/side width of a stereo signal (1 = unchanged)"""
    m, s = (x[:, 0] + x[:, 1]) / 2, (x[:, 0] - x[:, 1]) / 2 * w
    return np.stack([m + s, m - s], 1)


def add(buf, x, t, gain=1.0):
    """mix x into buf at time t (seconds); clips at the buffer ends"""
    i = ns(t)
    x = x if buf.ndim == x.ndim else (stereo(x) if buf.ndim == 2 else mono(x))
    if i < 0:
        x, i = x[-i:], 0
    n = min(len(x), len(buf) - i)
    if n > 0:
        buf[i:i + n] += x[:n] * gain
    return buf


def env_lin(points, n=None):
    """piecewise-linear envelope from [(t, value), ...] sampled at SR; held flat after the last point"""
    pts = sorted(points)
    n = n or ns(pts[-1][0]) + 1
    t = np.arange(n) / SR
    return np.interp(t, [p[0] for p in pts], [p[1] for p in pts]).astype(np.float32)


def fade(x, fin=0.005, fout=0.005):
    x = x.copy()
    a, b = min(len(x), ns(fin)), min(len(x), ns(fout))
    if a:
        r = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
        x[:a] *= r[:, None] if x.ndim == 2 else r
    if b:
        r = np.cos(np.linspace(0, np.pi / 2, b)) ** 2
        x[len(x) - b:] *= r[:, None] if x.ndim == 2 else r
    return x


def adsr(n, a, d, s, r, hold=None):
    """attack/decay/sustain/release envelope of n samples; release starts at hold seconds (default: n - r)"""
    t = np.arange(n) / SR
    hold = (n / SR - r) if hold is None else hold
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel = np.clip(1 - (t - hold) / max(r, 1e-6), 0, 1)
    e = np.where(t > hold, e * rel, e)
    return e.astype(np.float32)


# ----------------------------------------------------------------------------------------------- filters
def _sos(kind, f, order=2, sr=SR):
    f = np.clip(np.asarray(f, dtype=float), 10, sr / 2 * 0.98)
    return signal.butter(order, f / (sr / 2), btype=kind, output='sos')


def filt(x, kind, f, order=2):
    """butterworth lowpass/highpass/bandpass ('lowpass', 'highpass', 'bandpass' with f=(lo, hi)) along time"""
    return signal.sosfilt(_sos(kind, f, order), x, axis=0).astype(np.float32)


def lp(x, f, order=2):
    return filt(x, 'lowpass', f, order)


def hp(x, f, order=2):
    return filt(x, 'highpass', f, order)


def bp(x, lo, hi, order=2):
    return filt(x, 'bandpass', (lo, hi), order)


def peq(x, f, gain_db, q=1.0):
    """RBJ peaking EQ"""
    A, w = 10 ** (gain_db / 40), 2 * np.pi * f / SR
    al = np.sin(w) / (2 * q)
    b = [1 + al * A, -2 * np.cos(w), 1 - al * A]
    a = [1 + al / A, -2 * np.cos(w), 1 - al / A]
    return signal.lfilter(np.array(b) / a[0], np.array(a) / a[0], x, axis=0).astype(np.float32)


def shelf(x, f, gain_db, high=True):
    """RBJ shelving EQ (S = 1)"""
    A, w = 10 ** (gain_db / 40), 2 * np.pi * f / SR
    al = np.sin(w) / 2 * np.sqrt(2)
    c, sq = np.cos(w), 2 * np.sqrt(A) * al
    if high:
        b = [A * ((A + 1) + (A - 1) * c + sq), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sq)]
        a = [(A + 1) - (A - 1) * c + sq, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sq]
    else:
        b = [A * ((A + 1) - (A - 1) * c + sq), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - sq)]
        a = [(A + 1) + (A - 1) * c + sq, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - sq]
    return signal.lfilter(np.array(b) / a[0], np.array(a) / a[0], x, axis=0).astype(np.float32)


def resonator(x, f, q):
    """2-pole resonant bandpass (constant 0 dB peak gain) at f Hz"""
    w = 2 * np.pi * f / SR
    al = np.sin(w) / (2 * q)
    b = [al, 0, -al]
    a = [1 + al, -2 * np.cos(w), 1 - al]
    return signal.lfilter(np.array(b) / a[0], np.array(a) / a[0], x, axis=0).astype(np.float32)


def tvlp(x, cutoff):
    """time-varying one-pole lowpass with a per-sample cutoff array (block-wise, 64 samples)"""
    y = np.empty_like(x)
    last = np.zeros((1,) + x.shape[1:])
    B = 64
    for i in range(0, len(x), B):
        c = float(cutoff[min(i, len(cutoff) - 1)])
        a = 1 - np.exp(-2 * np.pi * c / SR)
        out, _ = signal.lfilter([a], [1, a - 1], x[i:i + B], axis=0, zi=last * (1 - a))
        y[i:i + B] = out
        last = out[-1:].astype(float)
    return y


# ----------------------------------------------------------------------------------------------- noise
def noise(n, seed, color='white'):
    rng = np.random.default_rng(seed)
    w = rng.standard_normal(n).astype(np.float32)
    if color == 'pink':
        b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
        w = signal.lfilter(b, a, w).astype(np.float32) * 4
    elif color == 'brown':
        w = signal.lfilter([1], [1, -0.995], w).astype(np.float32) * 0.1
    return w


def smooth_rand(n, seed, rate_hz, lo=0.0, hi=1.0):
    """slowly wandering control signal in [lo, hi] (cubic-ish interpolation of random points)"""
    rng = np.random.default_rng(seed)
    k = max(4, int(n / SR * rate_hz) + 4)
    pts = rng.random(k)
    t = np.linspace(0, k - 3, n)
    v = np.interp(t, np.arange(k), pts)
    v = signal.sosfiltfilt(_sos('lowpass', max(rate_hz, 0.05) * 1.5), v) if n > 100 else v
    v = (v - v.min()) / max(np.ptp(v), 1e-9)
    return (lo + (hi - lo) * v).astype(np.float32)


# ----------------------------------------------------------------------------------------------- reverb
def make_ir(rt60=2.6, predelay=0.018, seed=1, er=0.35, hf_ratio=0.45, lf_ratio=1.15, length=None, diffusion_ms=60,
            er_span=0.07, width_amt=1.0):
    """Stereo hall impulse response: early-reflection taps + a decorrelated, band-wise exponentially decaying tail.

    rt60 is the mid-band decay time; highs decay at rt60*hf_ratio, lows at rt60*lf_ratio (air and wall absorption).
    """
    length = length or rt60 * 1.3 + predelay + 0.1
    n = ns(length)
    rng = np.random.default_rng(seed)
    ir = np.zeros((n, 2), np.float32)
    t = np.arange(n) / SR
    bands = [(20, 250, lf_ratio), (250, 1000, 1.0), (1000, 3000, 0.8), (3000, 7000, hf_ratio + 0.15), (7000, 20000, hf_ratio)]
    tail = np.zeros((n, 2), np.float32)
    for ch in range(2):
        w = rng.standard_normal(n).astype(np.float32)
        for lo, hi, ratio in bands:
            sos = _sos('bandpass', (lo, min(hi, SR / 2 * 0.95)), 2)
            b = signal.sosfilt(sos, w)
            tau = rt60 * ratio / 6.91  # e^-6.91 = -60 dB
            tail[:, ch] += (b * np.exp(-np.maximum(t - predelay, 0) / tau)).astype(np.float32)
    build = np.clip((t - predelay) / (diffusion_ms / 1000), 0, 1) ** 1.5
    tail *= build[:, None]
    tail[t < predelay] = 0
    # early reflections: sparse taps, slightly lowpassed, different per side
    for ch in range(2):
        k = 18
        times = predelay * 0.4 + np.sort(rng.random(k)) * er_span
        gains = (rng.random(k) * 0.6 + 0.4) * np.exp(-times / 0.05) * np.where(rng.random(k) > 0.5, 1, -1)
        for tt, g in zip(times, gains):
            ir[ns(tt), ch] += g
    ir[:, :] = lp(ir, 6000, 2) * er
    tail /= np.sqrt(np.sum(tail ** 2) / 2) + 1e-9
    ir += tail
    m, s = (ir[:, 0] + ir[:, 1]) / 2, (ir[:, 0] - ir[:, 1]) / 2 * width_amt
    ir = np.stack([m + s, m - s], 1)
    return (ir / np.sqrt(np.sum(ir ** 2) / 2)).astype(np.float32)


_IRS = {}


def reverb(x, preset='hall', mix=1.0):
    """wet signal only (mono-summed input, stereo out), scaled by mix"""
    presets = {
        'hall': dict(rt60=2.8, predelay=0.024, seed=11, er=0.3),
        'cathedral': dict(rt60=5.5, predelay=0.04, seed=12, er=0.25, hf_ratio=0.35),
        'room': dict(rt60=0.55, predelay=0.006, seed=13, er=0.6, hf_ratio=0.6, diffusion_ms=20, er_span=0.03),
        'plate': dict(rt60=1.8, predelay=0.01, seed=14, er=0.1, hf_ratio=0.7, diffusion_ms=8),
        'street': dict(rt60=1.2, predelay=0.03, seed=15, er=0.7, hf_ratio=0.4, er_span=0.12),
        'space': dict(rt60=8.0, predelay=0.06, seed=16, er=0.15, hf_ratio=0.3, lf_ratio=1.0),
    }
    if preset not in _IRS:
        _IRS[preset] = make_ir(**presets[preset])
    ir = _IRS[preset]
    m = mono(x).astype(np.float32)
    out = np.stack([signal.oaconvolve(m, ir[:, 0])[:len(m)], signal.oaconvolve(m, ir[:, 1])[:len(m)]], 1)
    return (out * mix).astype(np.float32)


# ----------------------------------------------------------------------------------------------- dynamics
BLOCK = 32


def _blocks_level(x, mode='peak'):
    m = np.abs(mono(x)) if mode == 'peak' else mono(x) ** 2
    nb = int(np.ceil(len(m) / BLOCK))
    m = np.pad(m, (0, nb * BLOCK - len(m)))
    m = m.reshape(nb, BLOCK)
    return m.max(1) if mode == 'peak' else np.sqrt(m.mean(1))


def _smooth_ar(g, attack, release):
    """asymmetric one-pole smoothing of a block gain curve (dB, negative = reduction); attack when gain falls"""
    fs = SR / BLOCK
    aa, ar = np.exp(-1 / (attack * fs)), np.exp(-1 / (release * fs))
    out = np.empty_like(g)
    z = 0.0
    for i, v in enumerate(g):
        c = aa if v < z else ar
        z = c * z + (1 - c) * v
        out[i] = z
    return out


def _apply_block_gain(x, gdb):
    g = undb(gdb).astype(np.float32)
    idx = (np.arange(len(x)) + 0.5) / BLOCK - 0.5
    gs = np.interp(idx, np.arange(len(g)), g).astype(np.float32)
    return x * (gs[:, None] if x.ndim == 2 else gs)


def compress(x, threshold=-18, ratio=2.0, attack=0.02, release=0.25, knee=6, makeup=0.0, sidechain=None):
    lvl = db(_blocks_level(sidechain if sidechain is not None else x, 'rms') * np.sqrt(2))
    over = lvl - threshold
    gr = np.where(over <= -knee / 2, 0, np.where(over >= knee / 2, over * (1 / ratio - 1),
                  (1 / ratio - 1) * (over + knee / 2) ** 2 / (2 * knee)))
    return _apply_block_gain(x, _smooth_ar(gr, attack, release) + makeup)


def duck(x, key, depth_db=6.0, threshold_db=-40, attack=0.06, release=0.45, lookahead=0.05):
    """sidechain duck: reduce x by up to depth_db wherever key is above threshold (smooth, with lookahead)"""
    lvl = db(_blocks_level(key, 'rms'))
    amt = np.clip((lvl - threshold_db) / 10, 0, 1) * -depth_db
    la = int(lookahead * SR / BLOCK)
    if la:
        amt = minimum_filter1d(amt, 2 * la + 1, origin=0)
        amt = np.concatenate([amt[la:], np.full(la, amt[-1])])
    return _apply_block_gain(x, _smooth_ar(amt, attack, release)), amt


def true_peak(x, os_factor=4):
    y = signal.resample_poly(x, os_factor, 1, axis=0)
    return float(np.max(np.abs(y)))


def limit(x, ceiling_db=-1.5, lookahead=0.004, release=0.08, os_factor=4):
    """true-peak lookahead limiter: gain from the oversampled peak, held over the lookahead, released smoothly"""
    ceil = undb(ceiling_db)
    y = signal.resample_poly(x, os_factor, 1, axis=0)
    pk = np.abs(y).max(1) if y.ndim == 2 else np.abs(y)
    pk = pk[: len(x) * os_factor].reshape(-1, os_factor).max(1)
    nb = int(np.ceil(len(pk) / BLOCK))
    pk = np.pad(pk, (0, nb * BLOCK - len(pk))).reshape(nb, BLOCK).max(1)
    need = np.minimum(0, ceiling_db - db(pk))
    la = max(1, int(lookahead * SR / BLOCK))
    need = minimum_filter1d(need, 2 * la + 1)
    g = _smooth_ar(need, 1e-4, release)
    g = np.minimum(g, need)  # never above the requirement
    out = _apply_block_gain(x, g)
    return np.clip(out, -ceil * 1.05, ceil * 1.05).astype(np.float32)


# ----------------------------------------------------------------------------------------------- io
def load_audio(path, sr=SR, ch=2):
    """decode any file with ffmpeg to float32 (n, ch) at sr; cached as .npy under CACHE"""
    os.makedirs(CACHE, exist_ok=True)
    key = os.path.join(CACHE, path.replace('/', '_').replace('#', 's') + f'.{sr}.{ch}.npy')
    if os.path.exists(key) and os.path.getmtime(key) >= os.path.getmtime(path):
        return np.load(key)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', str(ch), '-ar', str(sr), '-'],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float32).reshape(-1, ch).copy()
    if ch == 1:
        a = a[:, 0]
    np.save(key, a)
    return a


def write_wav(path, x, sr=SR, bits=24):
    import soundfile as sf
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sf.write(path, np.asarray(x, np.float32), sr, subtype='PCM_24' if bits == 24 else 'FLOAT')


def read_wav(path):
    import soundfile as sf
    a, sr = sf.read(path, dtype='float32', always_2d=True)
    assert sr == SR, (path, sr)
    return a


def plus(*xs):
    """sum signals of different lengths (zero-padded to the longest)"""
    n = max(len(x) for x in xs)
    shp = (n,) + xs[0].shape[1:]
    out = np.zeros(shp, np.float32)
    for x in xs:
        out[:len(x)] += x
    return out
