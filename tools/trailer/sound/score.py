"""AFTERZERO trailer score: one continuous original cue on the AFTERZERO motif (E-B-A, Kai and Mira's shared memory).

Follows the music map in tools/trailer/trailer.json (docs/TRAILER.md "Music map" and "Sound"). Rendered offline at
48 kHz stereo: sampled felt/grand piano (Salamander V3, CC BY 3.0) and string/wind/brass/percussion sections (VSCO-2 CE,
CC0), with modal-synthesis bowed metal, glass, frame drum and breath textures (textures.py), humanised timing and
velocity, per-bus algorithmic-hall convolution reverb and bus compression.

  python3 tools/trailer/sound/score.py            # full trailer cue -> OUT/stems/music*.wav
  python3 tools/trailer/sound/score.py --store    # the 30 s store-cut cue -> OUT/store/music.wav

Cut points come from trailer.json: every section has a tempo map whose anchors are the cut times, so the hits land on the
frame even where the 24 fps edit rounds a bar by a few milliseconds.
"""
import json
import os
import sys
import numpy as np
from dsp import SR, OUT, ROOT, ns, add, reverb, compress, write_wav, lp, hp, shelf, peq, pan, fade
from sampler import Piano, Orchestra
import textures as tx

TRAILER = json.load(open(os.path.join(ROOT, 'tools', 'trailer', 'trailer.json')))
LEN = round(TRAILER['length'] * 24) / 24 if TRAILER.get('fps') == 24 else TRAILER['length']
A_MOTIF = (76, 83, 81)  # E5 B5 A5

PANS = {'violins': -0.45, 'violas': 0.12, 'celli': 0.38, 'basses': 0.5, 'horn': -0.25, 'flute': 0.2, 'harp': -0.3,
        'celliPizz': 0.3, 'violinsPizz': -0.35, 'timpani': 0.0, 'trombone': 0.2, 'bassoon': 0.1, 'clarinet': -0.1}
PRE = {'violins': 0.05, 'violas': 0.05, 'celli': 0.06, 'basses': 0.07, 'horn': 0.05, 'flute': 0.03, 'trombone': 0.05}
SENDS = {'piano': 0.22, 'strings': 0.34, 'winds': 0.5, 'perc': 0.14, 'texture': 0.45, 'glass': 0.55, 'sub': 0.0}
BUS_GAIN = {'glass': 0.2, 'sub': 0.4, 'texture': 0.8}  # bus trims after the per-section balance check
VERB = {'piano': 'hall', 'strings': 'hall', 'winds': 'hall', 'perc': 'hall', 'texture': 'cathedral', 'glass': 'space', 'sub': 'room'}


class Clock:
    """beat -> seconds through anchor points (beat, time); linear between anchors, extrapolated at the ends"""

    def __init__(self, anchors, bpm=None):
        self.b = np.array([a[0] for a in anchors], float)
        self.t = np.array([a[1] for a in anchors], float)
        self.spb = 60 / bpm if bpm else (self.t[-1] - self.t[0]) / (self.b[-1] - self.b[0])

    def __call__(self, beat):
        if beat <= self.b[0]:
            return float(self.t[0] + (beat - self.b[0]) * (self.spb if len(self.b) == 1 else (self.t[1] - self.t[0]) / (self.b[1] - self.b[0])))
        if beat >= self.b[-1]:
            slope = self.spb if len(self.b) == 1 else (self.t[-1] - self.t[-2]) / (self.b[-1] - self.b[-2])
            return float(self.t[-1] + (beat - self.b[-1]) * slope)
        return float(np.interp(beat, self.b, self.t))


class Score:
    def __init__(self, length, seed=7):
        self.L = length
        self.bus = {k: np.zeros((ns(length) + 1, 2), np.float32) for k in SENDS}
        self.P, self.O = Piano(), Orchestra()
        self.rng = np.random.default_rng(seed)
        self.notes = 0

    # --- humanised players ------------------------------------------------------------------------------
    def j(self, sd):
        return float(self.rng.normal(0, sd))

    def piano(self, t, n, vel, lift=None, dur=0.4, felt=0.55, jitter=0.012, bus='piano', gain=1.0):
        """a piano key at t; lift = pedal-up time (absolute) or None (ring until it dies)"""
        t = t + (self.j(jitter) if jitter else 0)
        v = float(np.clip(vel * (1 + self.j(0.05)), 0.02, 1))
        tail = None if lift is None else max(dur, lift - t)
        length = min(12.0, (tail + 1.5) if tail is not None else 10.0, self.L - t + 0.5)
        if length <= 0.05:
            return
        x = self.P.note(n, v, dur, pedal=True, felt=felt, length=length, tail=tail)
        add(self.bus[bus], x * gain, t)
        self.notes += 1

    def muted(self, t, n, vel, jitter=0.006):
        """palm-muted / prepared low piano: short damped key, felt-dark, with a woody knock"""
        t = t + self.j(jitter)
        x = self.P.note(n, float(np.clip(vel * (1 + self.j(0.06)), 0.05, 1)), 0.11, pedal=False, felt=0.75, length=0.9)
        x = peq(x, 180, 3, 1.2)
        add(self.bus['piano'], x, t)
        self.notes += 1

    def strings(self, inst, t, n, dur, vel, vel_end=None, attack=None, release=None, section=2, bus='strings',
                pan_pos=None, gain=1.0, bright=None, jitter=0.008):
        t = t - PRE.get(inst, 0.0) + (self.j(jitter) if jitter else 0)
        x = self.O.note(inst, n, dur, vel, vel_end, attack, release, None, PANS.get(inst, 0) if pan_pos is None else pan_pos,
                        section, bright, seed=int(t * 1000))
        add(self.bus[bus], x * gain, t)
        self.notes += 1

    def chord(self, inst, t, notes, dur, vel, **kw):
        for i, n in enumerate(notes):
            self.strings(inst, t + 0.012 * i, n, dur, vel, **kw)

    def perc(self, t, x, gain=1.0, bus='perc'):
        add(self.bus[bus], x * gain, t)

    def spiccato(self, inst, t, n, vel, length=0.16, bus='strings', gain=1.0):
        """short bowed note from a sustained sample: quick attack, cut with a short release"""
        self.strings(inst, t, n, length, vel, attack=0.004, release=0.07, section=2, bus=bus, gain=gain, jitter=0.004)

    # --- mixdown ----------------------------------------------------------------------------------------
    def render(self, gates=()):
        stems = {}
        for k, x in self.bus.items():
            x = hp(x, 28, 2) * BUS_GAIN.get(k, 1.0)
            wet = reverb(x, VERB[k], SENDS[k]) if SENDS[k] > 0 else 0 * x
            if k in ('piano', 'strings', 'winds'):
                wet = wet + reverb(x, 'hall', 0.06)
            y = x + wet
            if k == 'perc':
                y = compress(y, threshold=-20, ratio=2.5, attack=0.004, release=0.12)
            stems[k] = y
        # program EQ: a little air on strings, tame the piano's low-mid build-up
        stems['strings'] = shelf(stems['strings'], 6000, 1.5, True)
        stems['piano'] = peq(stems['piano'], 260, -2.0, 0.8)
        music = sum(stems.values())
        music = compress(music, threshold=-14, ratio=1.8, attack=0.03, release=0.4, knee=8)
        g = gate_env(len(music), gates)
        for k in stems:
            stems[k] = stems[k] * g[:, None]
        return music * g[:, None], stems


def gate_env(n, gates, ramp=0.004):
    """1 everywhere except [(t0, t1)] spans of digital silence (with a few-ms ramp so the stop does not click)"""
    g = np.ones(n, np.float32)
    for t0, t1 in gates:
        a, b = ns(t0), min(n, ns(t1))
        r = ns(ramp)
        g[a:b] = 0
        g[max(0, a - r):a] *= np.linspace(1, 0, min(r, a))
    return g


def m(name):
    """note name -> midi"""
    from sampler import name_midi
    return name_midi(name)


# =========================================================================================================== cue
def compose(S):
    rng = S.rng

    # ---------------------------------------------------------------- hook 1.5-17.5 (rubato around 78, felt piano)
    S.perc(1.4, tx.breath(16.2, seed=3, level=0.05, center=850, rate=0.19), bus='texture')
    lift = 5.55
    S.piano(2.0, 45, 0.3, lift, felt=0.6)
    S.piano(2.03, 52, 0.24, lift, felt=0.6)
    S.piano(2.15, 76, 0.42, lift, felt=0.55)
    S.piano(3.02, 83, 0.38, lift, felt=0.55)
    S.piano(4.12, 81, 0.33, 7.45, felt=0.55)
    S.piano(4.2, 60, 0.18, lift, felt=0.6)
    lift = 7.45
    S.piano(5.6, 41, 0.28, lift, felt=0.6)
    S.piano(5.64, 48, 0.22, lift, felt=0.6)
    S.piano(5.78, 76, 0.36, lift, felt=0.55)
    S.piano(6.48, 83, 0.36, lift, felt=0.55)
    S.piano(7.22, 84, 0.34, 9.85, felt=0.55)
    # 7.5: the cello pedal on A joins (s02)
    S.strings('celli', 7.5, 45, 10.2, 0.34, 0.5, attack=2.2, release=0.25, section=3)
    S.piano(7.52, 48, 0.24, 9.85, felt=0.6)
    S.piano(7.56, 55, 0.2, 9.85, felt=0.6)
    S.piano(7.9, 83, 0.3, 9.85, felt=0.55)
    S.piano(8.95, 81, 0.32, 12.0, felt=0.55)
    S.piano(9.9, 43, 0.22, 12.0, felt=0.6)
    S.piano(9.94, 50, 0.18, 12.0, felt=0.6)
    S.piano(9.98, 57, 0.15, 12.0, felt=0.6)
    # 10.6 the child's line: the piano rests under it
    # 12.0 (s03): the band flares; motif fragment left hanging on B
    S.piano(12.0, 45, 0.3, 14.45, felt=0.6, jitter=0.004)
    S.piano(12.04, 52, 0.24, 14.45, felt=0.6)
    S.piano(12.28, 76, 0.38, 14.45, felt=0.55)
    S.piano(12.9, 83, 0.36, 14.45, felt=0.55)
    S.strings('basses', 12.0, 33, 5.6, 0.2, 0.42, attack=1.6, section=2)
    # 14.5 (s04, the clock runs backwards): suspended D, B resolves late to A
    S.piano(14.5, 38, 0.26, 16.15, felt=0.6, jitter=0.004)
    S.piano(14.54, 45, 0.22, 16.15, felt=0.6)
    S.piano(14.58, 52, 0.2, 16.15, felt=0.6)
    S.piano(14.62, 64, 0.16, 16.15, felt=0.6)
    S.piano(15.25, 81, 0.3, 16.15, felt=0.55)
    S.piano(16.2, 41, 0.25, 17.5, felt=0.6)
    S.piano(16.24, 48, 0.2, 17.5, felt=0.6)
    S.piano(16.28, 52, 0.18, 17.5, felt=0.6)
    S.piano(16.9, 71, 0.2, 17.5, felt=0.55)

    # ---------------------------------------------------------------- approach 17.5-19.75: the cell drifts off the grid
    cell = [33, 45, 40, 45, 33, 45, 43, 45]
    t, step = 17.5, 60 / 78 / 4
    i = 0
    while t < 19.7:
        drift = (t - 17.5) / 2.25
        S.muted(t, cell[i % 8], 0.24 + 0.28 * drift)
        t += step * (1 - 0.18 * drift) + rng.normal(0, 0.006 + 0.02 * drift)
        i += 1
    S.strings('celli', 17.45, 45, 2.35, 0.45, 0.85, attack=0.3, section=3)
    S.strings('basses', 17.45, 33, 2.35, 0.35, 0.8, attack=0.4, section=2)
    S.strings('violas', 18.3, 51, 1.5, 0.2, 0.62, attack=1.0, section=2)  # D#: the tritone under the horn pair
    S.perc(17.5, tx.bowed_metal(110, 2.3, seed=21, swell=(0.95, 0.01), bright=1.1) * 0.22, bus='texture')

    # 19.75-20.75 digital silence (gate)

    # ---------------------------------------------------------------- the held second 20.75-27.75 (free time)
    S.perc(20.8, tx.sub_drone(41.2, 7.0, level=0.07, fin=1.2, fout=1.6), bus='sub')
    S.perc(21.0, tx.bowed_metal(164.8, 6.6, seed=23, swell=(0.4, 0.4), bright=0.9) * 0.1, bus='texture')
    for tt, n, v in [(21.55, 88, 0.32), (22.85, 95, 0.24), (23.5, 93, 0.22), (26.1, 88, 0.2), (27.0, 83, 0.18)]:
        S.perc(tt, tx.glass(n, v, decay=4.0, seed=int(tt * 10), pan_pos=float(rng.uniform(-0.6, 0.6))), bus='glass')
    S.perc(22.0, tx.glass_sustain(100, 5.0, 0.07, seed=4, pan_pos=-0.4), bus='glass')
    S.perc(23.2, tx.glass_sustain(105, 4.0, 0.05, seed=5, pan_pos=0.5), bus='glass')

    # ---------------------------------------------------------------- Mira 27.75-32.25 (64 BPM, felt piano, close)
    S.piano(27.8, 41, 0.22, 31.3, felt=0.75)
    S.piano(27.84, 48, 0.18, 31.3, felt=0.75)
    S.piano(27.88, 52, 0.16, 31.3, felt=0.75)
    S.piano(28.6, 76, 0.34, 31.3, felt=0.7, jitter=0.004)
    S.piano(29.6, 83, 0.3, 31.3, felt=0.7)
    S.piano(30.55, 81, 0.27, 32.2, felt=0.7)
    S.piano(31.35, 38, 0.18, 32.2, felt=0.75)
    S.piano(31.4, 57, 0.15, 32.2, felt=0.75)
    S.piano(31.45, 71, 0.18, 32.2, felt=0.7)  # B: left unresolved
    S.strings('celli', 28.2, 69, 3.9, 0.12, 0.28, attack=1.4, release=0.4, section=1, bright=2400)  # warm high cello
    # the reversed tail, used once: the A5 and its reverb, backwards into the black
    a5 = S.P.note(81, 0.35, 0.3, pedal=True, felt=0.6, length=3.0)
    a5 = a5 + reverb(a5, 'cathedral', 0.9)
    S.perc(32.25 - 1.6, tx.reversed_swell(a5, 1.6) * 0.55, bus='piano')

    # ---------------------------------------------------------------- the voice 32.25-35.0: sub + one cello note
    S.perc(32.25, tx.sub_drone(55.0, 2.75, level=0.06, fin=0.25, fout=0.15), bus='sub')
    S.strings('celli', 32.3, 40, 2.6, 0.22, 0.3, attack=0.6, release=0.1, section=2, bright=1800)

    # ---------------------------------------------------------------- world A 35.0-45.0 (78; 13 beats, cuts on beats)
    C = Clock([(0, 35.0), (3, 37.292), (7, 40.375), (13, 45.0)], 78)
    S.strings('timpani', C(0), 45, 3.0, 0.5, section=1, bus='perc', jitter=0)
    S.strings('basses', C(0), 33, C(4) - C(0), 0.55, 0.42, attack=0.02, release=0.3, section=2)
    S.strings('celli', C(0), 45, C(4) - C(0), 0.55, 0.42, attack=0.02, release=0.3, section=3)
    S.piano(C(0), 33, 0.45, C(3), felt=0.3, jitter=0.0)
    S.piano(C(0) + 0.01, 45, 0.4, C(3), felt=0.3)
    S.piano(C(0) + 0.02, 76, 0.45, C(3), felt=0.35, jitter=0.003)
    S.piano(C(1.5), 83, 0.42, C(3), felt=0.35)
    S.piano(C(3), 81, 0.4, C(7), felt=0.35, jitter=0.003)
    S.piano(C(3) + 0.01, 41, 0.3, C(7), felt=0.35)
    S.strings('basses', C(4), 29, C(7) - C(4), 0.4, 0.5, attack=0.3, section=2)
    S.strings('celli', C(4), 41, C(7) - C(4), 0.4, 0.5, attack=0.3, section=3)
    S.chord('violas', C(4), [57, 60], C(7) - C(4), 0.25, vel_end=0.4, attack=0.8)
    S.piano(C(5), 72, 0.26, C(7), felt=0.35)
    S.piano(C(6), 69, 0.24, C(7), felt=0.35)
    # 40.375 (s11, the first switch): C, the strings open upward
    S.strings('basses', C(7), 36, C(10) - C(7), 0.45, 0.55, attack=0.1, section=2)
    S.strings('celli', C(7), 48, C(10) - C(7), 0.45, 0.55, attack=0.1, section=3)
    S.chord('violas', C(7), [55, 64], C(10) - C(7), 0.38, vel_end=0.5, attack=0.3)
    S.chord('violins', C(7), [67, 71], C(10) - C(7), 0.3, vel_end=0.5, attack=0.6, section=3)
    S.piano(C(7), 76, 0.36, C(10), felt=0.35, jitter=0.003)
    S.piano(C(8.5), 83, 0.36, C(10), felt=0.35)
    S.piano(C(10), 84, 0.38, C(13), felt=0.35)
    # beats 10-13: G sus, crescendo into the switch
    S.strings('basses', C(10), 31, C(13) - C(10) + 0.05, 0.5, 0.72, attack=0.1, section=2)
    S.strings('celli', C(10), 43, C(13) - C(10) + 0.05, 0.5, 0.75, attack=0.1, section=3)
    S.chord('violas', C(10), [57, 62], C(13) - C(10) + 0.05, 0.45, vel_end=0.68, attack=0.2)
    S.chord('violins', C(10), [69, 74], C(13) - C(10) + 0.05, 0.4, vel_end=0.66, attack=0.3, section=3)
    S.strings('timpaniRoll', C(11), 43, C(13) - C(11), 0.2, 0.5, release=0.2, section=1, bus='perc')

    # ---------------------------------------------------------------- world B 45.0-55.75: the past (frame drum, flute, harp)
    C = Clock([(0, 45.0), (4, 48.083), (8, 51.167), (14, 55.75)], 78)
    S.strings('celliPizz', C(0), 33 + 12, 1.0, 0.75, section=1, bus='perc', jitter=0)
    harp_a = [45, 52, 57, 59, 60, 59, 57, 52]
    harp_g = [43, 50, 55, 57, 59, 57, 55, 50]
    harp_f = [41, 48, 53, 55, 57, 55, 53, 48]
    for bar, pat in enumerate([harp_a, harp_g, harp_a, harp_f]):
        for k, n in enumerate(pat):
            b = bar * 4 + k * 0.5
            dark = bar >= 2
            S.strings('harp', C(b), n - (12 if dark and k % 2 else 0), 2.0, 0.42 + (0.12 if k == 0 else 0) - (0.1 if dark else 0),
                      section=1, bus='winds', jitter=0.01)
        for b in (0, 2):
            S.perc(C(bar * 4 + b), tx.frame_drum(0.75 if b == 0 else 0.55, f0=76, seed=bar * 10 + b, damp=1.0 if bar < 2 else 1.4,
                                                 pan_pos=-0.1), gain=1.0 if bar < 2 else 0.7)
        for b in (1.5, 3.5):
            S.perc(C(bar * 4 + b) + S.j(0.008), tx.frame_drum(0.25, f0=78, seed=bar * 10 + int(b * 2), damp=0.6, slap=0.8, pan_pos=0.15), 0.6)
    # breathy flute counter-line (first two bars only: the valley alive)
    for b, n, d, v in [(0.5, 69, 1.4, 0.32), (2.0, 72, 1.0, 0.3), (3.0, 74, 1.0, 0.3), (4.0, 76, 2.2, 0.34), (6.5, 74, 1.4, 0.28)]:
        S.strings('flute', C(b), n, d * 60 / 78, v, vel_end=v * 0.7, attack=0.12, release=0.4, section=1, bus='winds')
        S.perc(C(b), tx.breath(d * 60 / 78 + 0.3, seed=int(b * 7), level=0.018, center=float(440 * 2 ** ((n - 69) / 12)) * 2, rate=0.6), bus='winds')
    S.strings('celli', C(0), 45, C(4) - C(0), 0.22, 0.3, attack=0.8, section=2)
    S.strings('celli', C(4), 43, C(8) - C(4), 0.22, 0.3, attack=0.4, section=2)
    # 51.167 (s14): one valley, two ages. Low strings sforzando-piano, the flute is gone
    S.strings('timpani', C(8), 45, 3.0, 0.42, section=1, bus='perc', jitter=0)
    S.strings('basses', C(8), 33, C(14) - C(8), 0.55, 0.3, attack=0.02, section=2)
    S.strings('celli', C(8), 45, C(14) - C(8), 0.5, 0.3, attack=0.02, section=3)
    S.chord('violas', C(8) + 0.4, [52, 60], C(14) - C(8) - 0.4, 0.15, vel_end=0.32, attack=1.5)
    for b, n in [(10, 64), (12, 60)]:
        S.piano(C(b), n, 0.2, C(b + 2), felt=0.5)

    # ---------------------------------------------------------------- world C 55.75-61.17: night glass
    C = Clock([(0, 55.75), (4, 58.833), (7, 61.167)], 78)
    S.chord('violas', C(0), [53, 60], C(7) - C(0), 0.2, vel_end=0.34, attack=1.0)
    S.strings('celli', C(0), 41, C(7) - C(0), 0.25, 0.36, attack=0.8, section=3)
    S.chord('violins', C(0) + 0.3, [64, 69], C(7) - C(0) - 0.3, 0.15, vel_end=0.3, attack=1.6, section=3)
    for b, n, v in [(0.0, 88, 0.3), (1.5, 95, 0.24), (3.0, 93, 0.26), (5.0, 88, 0.18), (6.0, 91, 0.16)]:
        S.perc(C(b), tx.glass(n, v, decay=3.6, seed=int(b * 13) + 2, pan_pos=float(rng.uniform(-0.5, 0.5))), bus='glass')
    S.piano(C(4), 72, 0.24, C(7), felt=0.45, jitter=0.003)
    S.piano(C(4) + 0.02, 41, 0.2, C(7), felt=0.5)
    S.piano(C(6), 64, 0.2, C(7), felt=0.45)

    # ---------------------------------------------------------------- world D 61.17-68.83: beautiful catastrophe
    C = Clock([(0, 61.167), (6, 65.75), (10, 68.833)], 78)
    S.strings('basses', C(0), 29, C(6) - C(0), 0.5, 0.45, attack=0.15, section=2)
    S.strings('celli', C(0), 41, C(6) - C(0), 0.5, 0.48, attack=0.15, section=3)
    S.chord('violas', C(0), [57, 60, 64], C(6) - C(0), 0.42, vel_end=0.5, attack=0.3)
    S.chord('violins', C(0), [72, 76], C(3) - C(0), 0.42, vel_end=0.48, attack=0.25, section=3)
    S.chord('violins', C(3), [71, 74], C(6) - C(3), 0.45, vel_end=0.52, attack=0.2, section=3)
    S.strings('horn', C(1), 60, C(3) - C(1), 0.28, 0.4, attack=0.5, release=0.6, section=2, bus='winds', bright=1800)
    S.strings('horn', C(3), 59, C(6) - C(3), 0.3, 0.42, attack=0.3, release=0.6, section=2, bus='winds', bright=1800)
    S.strings('timpani', C(0), 41, 3.0, 0.42, section=1, bus='perc', jitter=0)  # the arrival in 2196
    S.piano(C(0), 29, 0.4, C(6), felt=0.3, jitter=0)
    S.piano(C(0) + 0.008, 41, 0.34, C(6), felt=0.3, jitter=0)
    S.piano(C(0) + 0.3, 93, 0.24, C(6), felt=0.3)
    S.piano(C(2.5), 88, 0.2, C(6), felt=0.3)
    # 65.75 (s18, the statue): B-flat, foreign and cold, held under "For ending it."
    S.strings('basses', C(6), 34, C(10) - C(6) + 0.2, 0.52, 0.25, attack=0.05, section=2)
    S.strings('celli', C(6), 46, C(10) - C(6) + 0.2, 0.5, 0.25, attack=0.05, section=3)
    S.chord('violas', C(6), [53, 62], C(10) - C(6) + 0.2, 0.42, vel_end=0.2, attack=0.1)
    S.chord('violins', C(6), [69, 76], C(10) - C(6) + 0.2, 0.4, vel_end=0.18, attack=0.15, section=3)
    S.strings('horn', C(6), 58, C(10) - C(6), 0.32, 0.18, attack=0.15, release=0.8, section=2, bus='winds', bright=1600)
    S.strings('timpani', C(6), 46, 3.0, 0.38, section=1, bus='perc', jitter=0)

    # ---------------------------------------------------------------- the Witness 68.83-72.71 (54, low and weary)
    S.strings('basses', 68.833, 40, 1.25, 0.6, 0.45, attack=0.08, release=0.2, section=2, bright=2200)
    S.strings('basses', 70.0, 47, 2.6, 0.5, 0.15, attack=0.15, release=0.5, section=2, bright=2000)
    S.strings('celli', 68.833, 52, 1.25, 0.3, 0.2, attack=0.1, section=2, bright=1800)
    S.perc(68.8, tx.bowed_metal(82.4, 4.0, seed=31, swell=(0.25, 0.45), bright=0.95) * 0.15, bus='texture')
    S.perc(68.8, tx.sub_drone(41.2, 4.0, level=0.06, fin=0.1, fout=0.8), bus='sub')
    for tt, v in [(68.833, 0.55), (69.95, 0.35), (70.62, 0.28), (71.8, 0.3)]:  # irregular pulse
        S.perc(tt, tx.tom(v, 58, seed=int(tt * 100)), 0.8)
    # the three glass taps (70.2 / 70.75 / 71.3) are in the sound design; the score leaves their register clear

    # ---------------------------------------------------------------- card breath 72.71-75.0: one reversed glass swell
    g = tx.glass(88, 0.6, decay=4.5, seed=77)
    g = g + reverb(g, 'space', 1.0)
    S.perc(75.0 - 2.1, tx.reversed_swell(g, 2.1) * 0.5, bus='glass')

    # ---------------------------------------------------------------- montage 75.0-97.375 (118, the Nine-Minute War)
    anchors = [(0, 75.0), (8, 79.083), (12, 81.083), (16, 83.125), (20, 85.167), (24, 87.208), (26, 88.208), (28, 89.25),
               (30, 90.25), (32, 91.292), (34, 92.292), (36, 93.292), (38, 94.333), (40, 95.333), (42, 96.375), (44, 97.375)]
    montage(S, Clock(anchors, 118), bars=11, roots=[45, 45, 41, 43, 45, 46, 45, 41, 43, 40, None],
            gaps=[8, 16, 24], rev_hits=[26, 30, 34, 38], slip_from=24, end_beat=44)

    # 97.375-98.583 digital silence (gate)

    # ---------------------------------------------------------------- title reprise 98.58-109.58 (78)
    C = Clock([(0, 98.583), (8, 105.083)], 78)
    title(S, C, end=109.583)

    # ---------------------------------------------------------------- end card: one low A rings out
    S.piano(112.09, 33, 0.42, None, felt=0.35, jitter=0)
    S.piano(112.095, 45, 0.2, None, felt=0.4, jitter=0)


def montage(S, C, bars, roots, gaps, rev_hits, slip_from, end_beat, vo_quiet=((0, 6),), intensity=1.0):
    """Nine-Minute War: ticks, 3+3+2 string ostinato, frame drum and toms entering bar by bar, distant horns,
    gaps and reversed impacts before the hits, an eighth-note slip from bar 7, the last bar thinned to ticks"""
    rng = S.rng
    acc = {0: 1.0, 3: 0.75, 6: 0.85}
    cells = {45: (0, 7, 12, 0, 7, 12, 10, 7), 41: (0, 7, 12, 0, 7, 12, 11, 7), 43: (0, 7, 12, 0, 7, 12, 10, 7),
             46: (0, 7, 12, 0, 7, 12, 11, 7), 40: (0, 7, 12, 0, 7, 12, 10, 7)}
    quiet = lambda b: any(a <= b < z for a, z in vo_quiet)  # noqa: E731
    gap_e = {g * 2 - 1 for g in gaps}  # eighth index (from 0) silenced before each gap hit
    for bar in range(bars):
        root = roots[bar]
        b0 = bar * 4
        last = root is None
        # ticks: sixteenths, 3+3+2 accents
        for s in range(16):
            b = b0 + s / 4
            if b >= end_beat:
                break
            e = int(b * 2)
            if e in gap_e and not last:
                continue
            v = (0.5 if s in (0, 6, 12) else 0.22 if s % 2 == 0 else 0.13) * intensity
            if last:
                v *= 1.15
            S.perc(C(b) + S.j(0.002), tx.tick(v, seed=bar * 16 + s, tone=1.0 if s % 4 else 0.82, pan_pos=0.25 if s % 2 else -0.15), 0.7)
        if last:
            continue
        slip = 0.5 if b0 >= slip_from else 0.0
        cell = cells[root]
        lvl = (0.32 if quiet(bar * 4) else 0.44 + 0.035 * bar) * intensity
        for k in range(8):
            b = b0 + k * 0.5 + slip
            if int(b * 2) in gap_e or b >= end_beat - 0.01:
                continue
            n = root + cell[k]
            v = min(0.85, lvl * (1.18 if k in acc else 0.9))
            S.spiccato('celli', C(b), n - 12 if n - 12 >= 36 else n, v)
            if bar >= 2:
                S.spiccato('violas', C(b), n, v * 0.75)
            if b0 >= slip_from:  # the ostinato doubles
                S.spiccato('violins', C(b), n + 12 if n + 12 >= 55 else n + 24, v * 0.7, gain=0.8)
        # low strings: one long note per bar
        if not quiet(bar * 4):
            S.strings('basses', C(b0), root - 12, C(b0 + 4) - C(b0), 0.36 + 0.03 * bar, 0.45 + 0.03 * bar, attack=0.05, section=2)
        else:
            S.strings('basses', C(b0), root - 12, C(b0 + 4) - C(b0), 0.28, 0.3, attack=0.4, section=2)
        # frame drum from bar 3, toms from bar 4 (3+3+2)
        if bar >= 2:
            for k, v in ((0, 0.8), (3, 0.6), (6, 0.7)):
                b = b0 + k * 0.5
                if int(b * 2) in gap_e:
                    continue
                S.perc(C(b) + S.j(0.003), tx.frame_drum(v * intensity, f0=82, seed=bar * 8 + k, damp=0.8, pan_pos=-0.15), 1.4)
            for k in (1, 2, 4, 5, 7):
                b = b0 + k * 0.5
                if int(b * 2) not in gap_e:
                    S.perc(C(b) + S.j(0.004), tx.frame_drum(0.22, f0=86, seed=bar * 8 + k + 50, damp=0.5, slap=0.9, pan_pos=0.2), 0.5)
        if bar >= 3:
            for k, f in ((0, 62), (6, 74)) if bar < 6 else ((0, 62), (3, 70), (6, 78)):
                b = b0 + k * 0.5
                if int(b * 2) not in gap_e:
                    S.perc(C(b) + S.j(0.003), tom(0.75 * intensity, f, seed=bar * 9 + k), 1.3)
        # distant horns from bar 5
        if bar >= 4:
            hn = {45: 64, 46: 65, 41: 65, 43: 62, 40: 64}[root]
            S.strings('horn', C(b0), hn, C(b0 + 4) - C(b0), 0.3 + 0.02 * bar, 0.38 + 0.02 * bar, attack=0.1, release=0.3,
                      section=2, bus='winds', bright=2000)
        # distorted breath texture under the last bars
        if bar >= 6:
            br = tx.breath(C(b0 + 4) - C(b0), seed=bar, level=0.06, center=500, rate=1.2)
            S.perc(C(b0), np.tanh(br * 6) / 6, bus='texture')
    # gaps: a reversed impact fills the silence into the hit
    for g in gaps + rev_hits:
        r = tx.reversed_swell(tx.impact_tail(seed=g, vel=0.8, f0=66), C(g) - C(g - 0.5) if g in gaps else 0.32)
        S.perc(C(g) - len(r) / SR, r * 0.45)


def tom(vel, f0, seed):
    """low tom: synthesised membrane layered with a damped VSCO timpani hit"""
    return tx.tom(vel, f0, seed)


def title(S, C, end, short=False):
    """main theme reprise: piano motif alone, then cello; strings bloom; the hopeful suspended chord, top note unresolved"""
    if not short:
        S.piano(C(0) + 0.004, 76, 0.4, C(3), felt=0.4, jitter=0.0)
        S.piano(C(0) + 0.014, 45, 0.26, C(3), felt=0.45, jitter=0.0)
        S.piano(C(1.5), 83, 0.38, C(3), felt=0.4)
        S.piano(C(3), 81, 0.36, C(5), felt=0.4)
        S.piano(C(3) + 0.02, 41, 0.25, C(5), felt=0.45)
        # the cello sings the motif an octave and a half lower
        S.strings('celli', C(3.5), 52, C(5) - C(3.5), 0.4, 0.5, attack=0.35, release=0.2, section=1, bright=3000)
        S.strings('celli', C(5), 59, C(6.5) - C(5), 0.48, 0.55, attack=0.12, release=0.2, section=1, bright=3200)
        S.strings('celli', C(6.5), 57, C(8) - C(6.5) + 0.05, 0.5, 0.6, attack=0.1, release=0.3, section=1, bright=3200)
        # the strings bloom under the tagline (102.58)
        S.strings('basses', C(5), 31, C(8) - C(5) + 0.03, 0.3, 0.55, attack=0.6, section=2)
        S.chord('violas', C(5), [55, 62], C(8) - C(5) + 0.03, 0.22, vel_end=0.5, attack=0.7)
        S.chord('violins', C(5.5), [67, 71], C(8) - C(5.5) + 0.03, 0.18, vel_end=0.5, attack=0.9, section=3)
        S.piano(C(5), 67, 0.24, C(8), felt=0.4)
        S.piano(C(6.5), 74, 0.26, C(8), felt=0.4)
    # the title chord at beat 8: F lydian (F C G A E) with B on top, left hanging
    t0 = C(8)
    hold = end - t0 - 0.35
    S.strings('basses', t0, 29, hold, 0.55, 0.3, attack=0.03, release=0.5, section=2)
    S.strings('celli', t0, 41, hold, 0.55, 0.32, attack=0.03, release=0.5, section=3)
    S.strings('celli', t0, 48, hold, 0.45, 0.3, attack=0.05, release=0.5, section=2)
    S.chord('violas', t0, [55, 57, 64], hold, 0.5, vel_end=0.3, attack=0.05, release=0.5)
    S.chord('violins', t0, [69, 76], hold, 0.5, vel_end=0.3, attack=0.06, release=0.5, section=3)
    S.strings('violins', t0, 83, hold, 0.42, 0.34, attack=0.08, release=0.6, section=3)  # B5 on top, never resolved
    S.strings('horn', t0, 57, hold, 0.42, 0.25, attack=0.08, release=0.6, section=2, bus='winds', bright=2200)
    S.strings('horn', t0, 64, hold, 0.38, 0.22, attack=0.08, release=0.6, section=2, bus='winds', bright=2200)
    S.strings('timpani', t0, 41, 3.5, 0.45, section=1, bus='perc', jitter=0)
    S.piano(t0, 29, 0.4, end, felt=0.3, jitter=0)
    S.piano(t0 + 0.01, 41, 0.35, end, felt=0.3)
    S.piano(t0 + 0.03, 67, 0.3, end, felt=0.3)
    S.piano(t0 + 0.05, 72, 0.3, end, felt=0.3)
    S.piano(t0 + 0.07, 83, 0.4, end, felt=0.3)
    S.perc(t0, tx.glass(95, 0.22, decay=5.0, seed=95), bus='glass')


def compose_store(S):
    """30 s store cut: montage material re-laid to the store-cut picture, ending on the title chord"""
    rows = TRAILER['store_cut']
    cuts, t = [], 0.0
    for r in rows:
        cuts.append(round(t, 3))
        t += r['dur']
    # beats between cuts at ~118: 7, 6, 7, 7, 6, 4, 4, 4, 3, 3 -> the montage up to s35 (25.6 s)
    beats = [7, 6, 7, 7, 6, 4, 4, 4, 3, 3]
    anchors, b = [], 0
    for c, nb in zip(cuts, beats):
        anchors.append((b, c))
        b += nb
    anchors.append((b, cuts[len(beats)]))
    C = Clock(anchors, 118)
    total_beats = b
    nbars = int(np.ceil(total_beats / 4))
    roots = [45, 45, 41, 43, 45, 46, 45, 41, 43, 40, 45, 43, 41, 40][:nbars - 1] + [None]
    rev = [a[0] for a in anchors[5:-1]]
    S.perc(0.0, tx.breath(4.0, seed=2, level=0.04), bus='texture')
    montage(S, C, bars=nbars, roots=roots, gaps=[anchors[2][0], anchors[4][0]], rev_hits=rev, slip_from=anchors[5][0] - anchors[5][0] % 4,
            end_beat=total_beats, vo_quiet=((0, 4),), intensity=0.95)
    end_t = cuts[len(beats)]
    # a breath of silence, then the title chord over the final image (s35)
    Ct = Clock([(8, end_t + 0.25)], 78)
    title(S, Ct, end=30.0 + 0.4, short=True)
    S.piano(end_t + 1.6, 76, 0.32, None, felt=0.4)
    S.piano(end_t + 2.3, 83, 0.3, None, felt=0.4)
    return cuts


def main():
    store = '--store' in sys.argv
    if store:
        S = Score(30.0, seed=11)
        cuts = compose_store(S)
        music, stems = S.render(gates=())
        n = ns(30.0)
        music = music[:n]
        t = np.arange(n) / SR
        music *= np.clip((30.0 - t) / 1.2, 0, 1)[:, None]
        d = os.path.join(OUT, 'store')
        write_wav(os.path.join(d, 'music.wav'), music)
        print('store music', len(music) / SR, 's, cuts', cuts, 'notes', S.notes)
        return
    S = Score(LEN)
    compose(S)
    gates = [(19.75, 20.75), (97.375, 98.583), (109.583 + 0.25, 112.083)]
    music, stems = S.render(gates=gates)
    n = ns(LEN)
    music = music[:n]
    t = np.arange(n) / SR
    fo = np.clip((LEN - t) / 1.0, 0, 1)  # the end card fades over the last second
    fo = fo * np.interp(t, [74.9, 79.0, 87.2, 97.4, 97.5], [1.0, 1.12, 1.26, 1.3, 1.0])  # the montage grows (+2 dB)
    music *= fo[:, None]
    # the title chord gives way to the diegetic button: a 0.25 s fade out of the score at 109.583
    music *= (np.clip(1 - (t - 109.583) / 0.25, 0, 1) * (t < 112.0) + (t >= 112.0))[:, None]
    tail = np.clip(1 - (t - 109.583) / 0.25, 0, 1) * (t < 112.0) + (t >= 112.0)
    for k in stems:
        stems[k] = stems[k][:n] * (fo * tail)[:, None]
        write_wav(os.path.join(OUT, 'stems', f'music_{k}.wav'), stems[k])
    write_wav(os.path.join(OUT, 'stems', 'music.wav'), music)
    print('music', round(len(music) / SR, 3), 's,', S.notes, 'notes; peak', float(np.abs(music).max()))


if __name__ == '__main__':
    main()
