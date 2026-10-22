"""AFTERZERO trailer sound: a small multisample player over openly licensed instrument samples.

- Piano: Salamander Grand Piano V3 (Alexander Holm, CC BY 3.0), five velocity layers (2, 4, 6, 8, 12 of 16), stereo
  48 kHz, minor-third spacing, plus the key-release noises. `felt` darkens and softens it into a felt piano
  (a close, muted, intimate upright-like colour) with the soft mechanism thump of the hammer felt.
- Orchestra: VSCO-2 Community Edition (Versilian Studios, CC0) via tiny-orchestra 0.2.0 (CC0 edits with loop points).
  Sustained instruments loop their marked region; each note can be doubled into a small section (detuned, delayed
  copy from the neighbouring sample) so one sample does not sound like a single static player.
Repitching is 4-point cubic Hermite interpolation (shifts are at most a few semitones).
"""
import json
import os
import numpy as np
from dsp import SR, SAMPLES, load_audio, lp, hp, ns, pan, noise, fade

PIANO_LAYERS = [2, 4, 6, 8, 12]
NOTE_NAMES = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}


def name_midi(nm):
    nm = nm.replace('s', '#')
    p = nm[:-1] if nm[-2] != '-' else nm[:-2]
    return NOTE_NAMES[p] + 12 * (int(nm[len(p):]) + 1)


def hermite(x, pos):
    """sample x (n,) or (n, ch) at fractional positions pos (4-point cubic Hermite)"""
    i = np.floor(pos).astype(np.int64)
    f = (pos - i).astype(np.float32)
    n = len(x)
    xm1, x0, x1, x2 = (x[np.clip(i + k, 0, n - 1)] for k in (-1, 0, 1, 2))
    if x.ndim == 2:
        f = f[:, None]
    c1 = 0.5 * (x1 - xm1)
    c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2
    c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1)
    return ((c3 * f + c2) * f + c1) * f + x0


def repitch(x, ratio, n_out=None):
    n_out = n_out if n_out is not None else int(len(x) / ratio)
    pos = np.arange(n_out) * ratio
    pos = pos[pos < len(x) - 2]
    return hermite(x, pos).astype(np.float32)


class Piano:
    def __init__(self):
        self.base = os.path.join(SAMPLES, 'x')
        self.roots = {}
        for v in PIANO_LAYERS:
            d = os.path.join(self.base, f'audio-samples-piano-velocity{v}-1.0.5', 'package', 'audio')
            self.roots[v] = {name_midi(f[:-len(f'v{v}.ogg')]): os.path.join(d, f) for f in os.listdir(d) if f.endswith('.ogg')}
        self.reldir = os.path.join(self.base, 'audio-samples-piano-release-1.0.5', 'package', 'audio')
        self.cache = {}

    def _raw(self, layer, n):
        roots = self.roots[layer]
        r = min(roots, key=lambda m: (abs(m - n), m < n))
        key = (layer, n)
        if key not in self.cache:
            a = load_audio(roots[r])
            # trim the encoder's leading silence to the attack (first sample above -50 dB of the peak)
            pk = np.abs(a).max()
            s = max(0, int(np.argmax(np.abs(a).max(1) > pk * 0.003)) - 24)
            self.cache[key] = repitch(a[s:], 2 ** ((n - r) / 12))
        return self.cache[key]

    def note(self, n, vel=0.5, dur=1.0, pedal=True, felt=0.0, length=None, tail=None):
        """one key: n midi, vel 0..1, dur key-down seconds, pedal holds the strings (ring until length)."""
        pos = np.interp(vel, [0, 0.18, 0.38, 0.58, 0.78, 1.0], [0, 0, 1, 2, 3, 4])
        lo = int(np.floor(pos))
        hi = min(lo + 1, len(PIANO_LAYERS) - 1)
        w = pos - lo
        length = length or (dur + 2.5 if not pedal else max(dur + 3, 9))
        N = ns(length)
        out = np.zeros((N, 2), np.float32)
        for li, g in ((lo, 1 - w), (hi, w)):
            if g <= 0.001:
                continue
            a = self._raw(PIANO_LAYERS[li], n)[:N]
            out[:len(a)] += a * g
        # the softest layers are quiet in the source; keep a natural velocity curve on top of the layer change
        out *= 0.35 + 0.65 * vel ** 0.8
        t = np.arange(N) / SR
        if not pedal or (tail is not None):
            off = dur if not pedal else tail
            damp = 0.09 + 0.25 * max(0, (n - 60) / 40)  # high strings ring longer under the damper
            if n > 89:
                damp = 2.5  # no dampers above F#6
            e = np.where(t < off, 1.0, np.exp(-(t - off) / damp)).astype(np.float32)
            out *= e[:, None]
            rel = os.path.join(self.reldir, f'rel{int(np.clip(n - 20, 1, 88))}.ogg')
            if os.path.exists(rel) and not pedal:
                r = load_audio(rel) * (0.25 + 0.4 * vel)
                i = ns(off)
                k = min(len(r), N - i)
                if k > 0:
                    out[i:i + k] += r[:k]
        if felt > 0:
            cut = 900 + 3200 * vel * (1 - felt) + 900 * (1 - felt)
            dark = lp(out, cut, 2)
            out = (out * (1 - felt) + dark * felt).astype(np.float32)
            # the felt's soft thump and key mechanism, close-miked
            th = noise(ns(0.05), seed=n * 7 + int(vel * 100), color='pink')
            th = lp(th, 260, 2) * np.exp(-np.arange(len(th)) / (0.012 * SR)) * 0.02 * felt * (0.4 + vel)
            out[:len(th)] += pan(th, 0.0)
        return fade(out, 0.0005, 0.25)


class Orchestra:
    def __init__(self):
        self.dir = os.path.join(SAMPLES, 'x', 'tiny-orchestra-0.2.0', 'package', 'samples')
        self.man = json.load(open(os.path.join(self.dir, 'manifest.json')))['instruments']
        self.cache = {}
        self.tuning = self._measure_tuning()

    def _measure_tuning(self):
        """measured pitch offset (cents) of every pitched sample: the energy-weighted mean frequency around the
        fundamental over the sustained part (a vibrato-robust centre), cached as json next to the decoded samples"""
        from dsp import CACHE
        path = os.path.join(CACHE, 'vsco_tuning.json')
        if os.path.exists(path):
            return json.load(open(path))
        out = {}
        for inst, I in self.man.items():
            if not I['pitched']:
                continue
            for s in I['samples']:
                a = self._sample(s)
                seg = a[ns(0.35):ns(min(2.8, len(a) / SR - 0.05))]
                if len(seg) < ns(0.3):
                    continue
                seg = seg * np.hanning(len(seg))
                sp = np.abs(np.fft.rfft(seg, 1 << 20)) ** 2
                f = np.fft.rfftfreq(1 << 20, 1 / SR)
                f0 = 440 * 2 ** ((s['midi'] - 69) / 12)
                best = None
                for h in (1, 2):  # the fundamental, or the 2nd harmonic for low notes with weak fundamentals
                    m = (f > f0 * h * 2 ** (-0.45 / 12)) & (f < f0 * h * 2 ** (0.45 / 12))
                    e = sp[m].sum()
                    if best is None or e > best[0] * 4:
                        c = (f[m] * sp[m]).sum() / max(e, 1e-20) / h
                        best = (e, c)
                cents = 1200 * np.log2(best[1] / f0)
                out[s['file']] = float(np.clip(cents, -35, 35))
        os.makedirs(CACHE, exist_ok=True)
        json.dump(out, open(path, 'w'), indent=0)
        return out

    def _sample(self, s):
        p = os.path.join(self.dir, s['file'])
        if p not in self.cache:
            a = load_audio(p, ch=1)
            self.cache[p] = a
        return self.cache[p]

    def pick(self, inst, n=None, vel=1.0, variant=None, rank=0):
        I = self.man[inst]
        S = I['samples']
        if not I['pitched']:
            cands = [s for s in S if s.get('variant') == (variant or I.get('defaultVariant'))] or S
            return cands[rank % len(cands)]
        layers = sorted({s.get('vel', 1) for s in S})
        want = layers[0] if (len(layers) > 1 and vel < 0.62) else layers[-1]
        cands = [s for s in S if s.get('vel', 1) == want]
        cands.sort(key=lambda s: (abs(s['midi'] - n), s['midi']))
        return cands[min(rank, len(cands) - 1)]

    def _voice(self, inst, s, n, dur, release, detune_c=0.0):
        I = self.man[inst]
        a = self._sample(s)
        off = ns(s.get('offset', 0))
        ratio = 2 ** (((n - s['midi']) * 100 - self.tuning.get(s['file'], 0) + detune_c) / 1200) if n is not None else 1.0
        need = dur + release + 0.05
        if I.get('sustain') and 'loopStart' in s:
            ls, le = ns(s['loopStart']), ns(s['loopEnd'])
            body, loop = a[off:le], a[ls:le]
            xf = ns(0.06)
            src_needed = int(need * SR * ratio) + 8
            parts = [body]
            total = len(body)
            ramp = np.linspace(0, 1, xf, dtype=np.float32)
            while total < src_needed:
                prev = parts[-1]
                # equal-power crossfade of the previous tail into the loop head
                head = loop.copy()
                head[:xf] = prev[-xf:] * np.sqrt(1 - ramp) + loop[:xf] * np.sqrt(ramp)
                parts[-1] = prev[:-xf]
                parts.append(head)
                total += len(loop) - xf
            src = np.concatenate(parts)
        else:
            src = a[off:]
        v = repitch(src, ratio)
        N = ns(need)
        if len(v) < N:
            v = np.pad(v, (0, N - len(v)))
        return v[:N] * s.get('gain', 1.0)

    def note(self, inst, n=None, dur=1.0, vel=0.7, vel_end=None, attack=None, release=None, variant=None, pan_pos=0.0,
             section=1, bright=None, seed=0):
        """one note as stereo (N, 2). vel 0..1 (quadratic gain), vel_end makes a swell/fade across the note.
        section > 1 adds detuned, delayed doubles from neighbouring samples (a section rather than one player)."""
        I = self.man[inst]
        rel = release if release is not None else I.get('release', 0.3)
        sustain = I.get('sustain', False)
        if not sustain:
            dur = min(dur, 6.0)
        rng = np.random.default_rng(seed + (n or 0) * 31)
        N = ns(dur + rel + 0.05)
        out = np.zeros((N, 2), np.float32)
        players = max(1, int(section))
        for k in range(players):
            s = self.pick(inst, n, vel, variant, rank=k if I['pitched'] else int(rng.integers(0, 8)))
            det = 0.0 if k == 0 else float(rng.uniform(-7, 7))
            v = self._voice(inst, s, n, dur, rel, det)
            d = 0 if k == 0 else ns(float(rng.uniform(0.006, 0.022)))
            v = np.concatenate([np.zeros(d, np.float32), v])[:N]
            p = np.clip(pan_pos + (0 if k == 0 else rng.uniform(-0.25, 0.25)), -1, 1)
            out[:len(v)] += pan(v, p) * (1.0 if k == 0 else 0.6)
        out /= (1 + 0.6 * (players - 1)) ** 0.5
        t = np.arange(N) / SR
        g0 = vel ** 2
        g1 = (vel_end if vel_end is not None else vel) ** 2
        e = np.interp(t, [0, max(dur, 1e-3)], [g0, g1]).astype(np.float32)
        if attack:
            e *= np.clip(t / attack, 0, 1) ** 1.5
        if sustain:
            e *= np.clip(1 - (t - dur) / max(rel, 1e-3), 0, 1)
        out *= e[:, None] * I.get('gain', 1.0)
        b = bright if bright is not None else (1500 + 9000 * max(vel, vel_end or 0) ** 1.5)
        if b < 16000:
            out = lp(out, b, 2)
        return fade(out, 0.0, 0.03)


if __name__ == '__main__':
    # quick check: tuning of a few orchestra samples and the piano roots
    from numpy.fft import rfft, rfftfreq
    o = Orchestra()
    for inst, n in [('celli', 57), ('basses', 45), ('violins', 69), ('flute', 69), ('horn', 57)]:
        x = mono = o.note(inst, n, 2.0, 0.8, section=1)[:, 0]
        seg = x[ns(0.5):ns(1.8)] * np.hanning(ns(1.3))
        spec = np.abs(rfft(seg, 1 << 20))
        f = rfftfreq(1 << 20, 1 / SR)
        lo, hi = 440 * 2 ** ((n - 69 - 0.6) / 12), 440 * 2 ** ((n - 69 + 0.6) / 12)
        m = (f > lo) & (f < hi)
        fp = f[m][np.argmax(spec[m])]
        print(inst, n, 'expected %.2f measured %.2f cents %+.1f' % (440 * 2 ** ((n - 69) / 12), fp, 1200 * np.log2(fp / (440 * 2 ** ((n - 69) / 12)))))
    p = Piano()
    x = p.note(69, 0.5, 1.0)[:, 0]
    seg = x[ns(0.3):ns(1.6)] * np.hanning(ns(1.3))
    spec = np.abs(rfft(seg, 1 << 20))
    f = rfftfreq(1 << 20, 1 / SR)
    m = (f > 420) & (f < 460)
    print('piano A4 measured %.2f' % f[m][np.argmax(spec[m])])
    x = p.note(70, 0.5, 1.0)[:, 0]
    seg = x[ns(0.3):ns(1.6)] * np.hanning(ns(1.3))
    spec = np.abs(rfft(seg, 1 << 20))
    m = (f > 445) & (f < 485)
    print('piano A#4 measured %.2f (466.16)' % f[m][np.argmax(spec[m])])
