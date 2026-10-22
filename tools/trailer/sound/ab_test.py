"""A/B listening proxy: the game's procedural instruments (a numpy port of src/core/audio.js piano/cello/reverb)
against the sampled instruments (Salamander piano, VSCO-2 CE celli) on the same 12-second motif phrase.
Writes ab/procedural.wav, ab/sampled.wav and ab/ab.png (spectrograms, waveforms and per-note spectra) under OUT.

  python3 tools/trailer/sound/ab_test.py
"""
import os
import numpy as np
from scipy import signal
from dsp import SR, OUT, ns, lp, add, reverb, write_wav, midi_hz, pan
from sampler import Piano, Orchestra

PHRASE = [(0.4, 76, 0.42), (1.2, 83, 0.40), (2.3, 81, 0.38), (4.4, 76, 0.36), (5.1, 83, 0.4), (6.0, 84, 0.35), (7.4, 81, 0.3)]
LEFT = [(0.4, 45, 0.3), (0.4, 52, 0.25), (4.4, 41, 0.3), (4.4, 48, 0.25), (7.4, 45, 0.28)]
CELLO = [(1.0, 45, 10.0)]
LEN = 12.0


def game_piano(n, vel, dur=4.0):
    t = np.arange(ns(dur)) / SR
    f = midi_hz(n)
    g = np.where(t < 0.006, t / 0.006 * vel * 0.22, vel * 0.22 * np.exp(np.log(0.0001 / (vel * 0.22)) * (t - 0.006) / (dur - 0.006)))
    x = sum(a * np.sin(2 * np.pi * f * m * t) for m, a in [(1, 1), (2, 0.42), (3, 0.18), (4.01, 0.08), (5.02, 0.04)])
    b, a = signal.butter(2, (1400 + vel * 2000) / (SR / 2))
    return signal.lfilter(b, a, x * g).astype(np.float32)


def game_cello(n, dur, vol=0.07):
    t = np.arange(ns(dur)) / SR
    f = midi_hz(n) * (1 + 0.006 * np.sin(2 * np.pi * 5.2 * t))
    ph = np.cumsum(f) / SR
    x = 2 * (ph - np.floor(ph + 0.5))
    b, a = signal.butter(2, 650 / (SR / 2))
    x = signal.lfilter(b, a, x)
    e = np.interp(t, [0, 0.5, dur - 0.6, dur], [0, vol, vol, 0])
    return (x * e).astype(np.float32)


def game_ir():
    rng = np.random.default_rng(3)
    n = ns(3.6)
    return np.stack([rng.uniform(-1, 1, n) * (1 - np.arange(n) / n) ** 2.4 for _ in range(2)], 1).astype(np.float32)


def procedural():
    dry = np.zeros((ns(LEN), 2), np.float32)
    send = np.zeros(ns(LEN), np.float32)
    for t, n, v in PHRASE + LEFT:
        p = game_piano(n, v)
        add(dry, np.stack([p, p], 1), t)
        add(send, p * 0.55, t)
    for t, n, d in CELLO:
        c = game_cello(n, d)
        add(dry, np.stack([c, c], 1), t)
        add(send, c, t)
    ir = game_ir()
    wet = np.stack([signal.oaconvolve(send, ir[:, 0])[:len(send)], signal.oaconvolve(send, ir[:, 1])[:len(send)]], 1) * 0.7 * 0.05
    return dry + wet


def sampled():
    P, O = Piano(), Orchestra()
    dry = np.zeros((ns(LEN), 2), np.float32)
    rng = np.random.default_rng(5)
    for t, n, v in PHRASE + LEFT:
        add(dry, P.note(n, v * 1.1, 1.2, pedal=True, felt=0.55, length=LEN - t + 0.1), t + rng.normal(0, 0.012))
    for t, n, d in CELLO:
        add(dry, O.note('celli', n, d, 0.5, 0.42, attack=1.2, release=1.5, section=2, pan_pos=0.25) * 0.8, t)
    return dry + reverb(dry, 'hall', 0.28)


def norm(x, target=-20.0):
    r = np.sqrt(np.mean(x ** 2))
    return x * 10 ** (target / 20) / max(r, 1e-9)


def main():
    d = os.path.join(OUT, 'ab')
    os.makedirs(d, exist_ok=True)
    a, b = norm(procedural()), norm(sampled())
    write_wav(os.path.join(d, 'procedural.wav'), a)
    write_wav(os.path.join(d, 'sampled.wav'), b)
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(3, 2, figsize=(16, 11))
    for col, (name, x) in enumerate((('procedural (game audio.js port)', a), ('sampled (Salamander + VSCO-2 CE)', b))):
        m = x.mean(1)
        f, t, S = signal.spectrogram(m, SR, nperseg=4096, noverlap=3072)
        ax[0, col].pcolormesh(t, f, 10 * np.log10(S + 1e-14), vmin=-150, vmax=-50, shading='auto', cmap='magma')
        ax[0, col].set_yscale('symlog', linthresh=200)
        ax[0, col].set_ylim(30, 20000)
        ax[0, col].set_title(name)
        ax[1, col].plot(np.arange(len(m)) / SR, m, lw=0.3)
        ax[1, col].set_ylim(-0.6, 0.6)
        seg = m[ns(1.2):ns(2.2)] * np.hanning(ns(1.0))
        sp = 20 * np.log10(np.abs(np.fft.rfft(seg)) + 1e-9)
        ax[2, col].semilogx(np.fft.rfftfreq(len(seg), 1 / SR), sp, lw=0.5)
        ax[2, col].set_xlim(40, 20000)
        ax[2, col].set_ylim(-60, 60)
        ax[2, col].set_title('spectrum of the B5 note (1.2-2.2 s)')
    fig.tight_layout()
    fig.savefig(os.path.join(d, 'ab.png'), dpi=70)
    for name, x in (('procedural', a), ('sampled', b)):
        m = x.mean(1)
        f, t, S = signal.spectrogram(m, SR, nperseg=4096)
        sf = np.exp(np.mean(np.log(S + 1e-20), 0)) / (np.mean(S, 0) + 1e-20)
        cen = (f[:, None] * S).sum(0) / (S.sum(0) + 1e-20)
        band = S[(f > 2000) & (f < 12000)].sum() / S.sum()
        hop = ns(0.02)
        e = np.array([np.sqrt(np.mean(m[i:i + hop] ** 2)) for i in range(0, len(m) - hop, hop)])
        ed = 20 * np.log10(e[e > e.max() * 1e-3] + 1e-12)
        attack = np.diff(ed).max()
        print(f'{name:11s} envelope range {np.ptp(ed):5.1f} dB, sharpest 20 ms rise {attack:5.1f} dB, '
              f'centroid {np.median(cen):6.0f} Hz, flatness {np.median(sf):.4f}, energy 2-12 kHz {band * 100:5.2f}%')


if __name__ == '__main__':
    main()
