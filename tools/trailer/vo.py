"""AFTERZERO trailer voice-over: the storyboard's lines (trailer.json "vo"), placed on the beat map.

  python3 tools/trailer/vo.py [--store] [--resynth KEY,KEY] [--check-synth]

- Every line reuses the game's recorded clip (assets/voice/<key>.m4a, the same performance the player hears).
- A line with no recorded clip (or one named with --resynth) is synthesised with the SAME Piper LibriTTS speaker,
  pace and ffmpeg treatment as tools/voice/build_voices.py: that module is imported read-only (its CHARACTERS,
  FILTERS, cast_voices, clean_for_tts and fnv36), so the trailer can never drift from the game's casting.
- Each line: trimmed to its words (clip_in/clip_out snapped to the pauses), de-clicked (onset ramp, tail fade, DC/rumble
  high-pass), evened to one speech loudness (BS.1770 K-weighted, gated), given a light presence lift and a touch of
  room, and placed so its first word starts exactly at the beat-map time. Lines that end on a cut are cut with it.
- Output: OUT/stems/vo.wav (stereo, 48 kHz) and OUT/stems/vo.json (actual onset, offset and loudness per line);
  --store: OUT/store/vo.wav ("You have nine minutes." only, per the store-cut rules).
"""
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sound'))
from dsp import SR, OUT, ROOT, ns, load_audio, hp, peq, shelf, reverb, write_wav, db, fade  # noqa: E402

PIPER = os.environ.get('PIPER_DIR', '/home/user/tools/piper')
CATALOG = os.path.join(PIPER, 'voices.json')
TRAILER = json.load(open(os.path.join(ROOT, 'tools', 'trailer', 'trailer.json')))
MANIFEST = json.load(open(os.path.join(ROOT, 'assets', 'voice', 'manifest.json')))
TARGET_LUFS = -23.0  # per line, before the mix; the mix sets the final level
ROOM = {'voice': 0.0, 'recording': 0.05, 'mirarec': 0.05}  # treated voices already carry their space
STORE_VO = [{'t': 1.0, 'key': 'f16rch', 'speaker': 'voice', 'text': 'You have nine minutes.'}]


def build_voices():
    """import tools/voice/build_voices.py without running it (it reads PIPER and CATALOG from argv at import)"""
    path = os.path.join(ROOT, 'tools', 'voice', 'build_voices.py')
    argv = sys.argv
    sys.argv = [path, PIPER, CATALOG]
    try:
        spec = importlib.util.spec_from_file_location('build_voices', path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
    finally:
        sys.argv = argv
    return mod


def synthesise(who, text, out_wav):
    """perform one line exactly as the game's voice build would: same speaker, pace and treatment (uncompressed)"""
    bv = build_voices()
    catalog = json.load(open(CATALOG))
    sp = MANIFEST.get('speakers', {}).get(who)
    if sp is None:
        sp = bv.cast_voices(catalog, {who}, bv.cast_sexes())[who]
    pace = bv.CHARACTERS.get(who, ('m', (0, 0), 1.0, None, None))[2]
    fx = bv.FILTERS[bv.CHARACTERS.get(who, (0, 0, 0, None, None))[3]]
    with tempfile.TemporaryDirectory() as td:
        raw = os.path.join(td, 'raw.wav')
        payload = json.dumps({'text': bv.clean_for_tts(text), 'speaker_id': sp, 'output_file': raw})
        subprocess.run([os.path.join(PIPER, 'piper', 'piper'), '-m', bv.MODEL, '--json-input', '--length_scale', str(pace),
                        '--sentence_silence', '0.18'], input=payload.encode(), capture_output=True, check=True)
        af = fx + 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-17:TP=-2:LRA=9'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', af, '-ac', '1', '-ar', str(SR), out_wav], check=True)
    return sp


# --------------------------------------------------------------------------------------------- loudness
def kweight(x):
    from scipy import signal
    # BS.1770 pre-filter (high shelf +4 dB at ~1.7 kHz) and RLB high-pass (~38 Hz), 48 kHz coefficients
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x))


def lufs(x):
    y = kweight(x)
    blk, hop = ns(0.4), ns(0.1)
    ms = np.array([np.mean(y[i:i + blk] ** 2) for i in range(0, max(1, len(y) - blk), hop)]) + 1e-12
    L = -0.691 + 10 * np.log10(ms)
    g = ms[L > -70]
    if not len(g):
        return -70.0
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    g = ms[(L > -70) & (L > rel)]
    return float(-0.691 + 10 * np.log10(g.mean()))


# --------------------------------------------------------------------------------------------- per line
def speech_bounds(x, thr=-42.0):
    """first and last sample where the 10 ms RMS is within thr dB of the line's loud parts"""
    r = np.sqrt(np.convolve(x ** 2, np.ones(480) / 480, 'same'))
    ref = np.percentile(r[r > 0], 95) if np.any(r > 0) else 1.0
    on = np.where(db(r / ref) > thr)[0]
    if not len(on):
        return 0, len(x)
    return int(on[0]), int(on[-1])


def snap(x, t, direction):
    """move a trim point to the quietest 20 ms within 120 ms (a pause between words)"""
    i = ns(t)
    a, b = max(0, i - ns(0.12)), min(len(x), i + ns(0.12))
    r = np.sqrt(np.convolve(x[a:b] ** 2, np.ones(960) / 960, 'same'))
    return a + int(np.argmin(r)) if len(r) else i


def prepare(line, synth=False):
    key = line.get('key')
    who = line['speaker']
    path = os.path.join(ROOT, 'assets', 'voice', MANIFEST['lines'].get(key, '___')) if key else None
    source = 'recorded'
    if synth or not path or not os.path.exists(path):
        d = os.path.join(OUT, 'vo_synth')
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, f'{key or who}.wav')
        if not os.path.exists(path):
            synthesise(who, line['text'], path)
        source = 'synthesised'
    x = load_audio(path, ch=1).astype(np.float64)
    if line.get('clip_in') is not None:
        a = snap(x, line['clip_in'], 1)
        b = snap(x, line['clip_out'], -1) if line.get('clip_out') else len(x)
        x = x[a:b]
    s, e = speech_bounds(x)
    s = max(0, s - ns(0.012))  # keep the consonant's lead-in
    e = min(len(x), e + ns(0.12))  # and the breath/decay after the last word
    x = x[s:e]
    x = hp(x, 75, 2)
    x = peq(x, 3200, 1.5, 0.9)  # presence for intelligibility under the score
    x = shelf(x, 9000, -1.0, True)
    x = fade(x, 0.004, 0.03)
    L = lufs(x)
    x = x * 10 ** ((TARGET_LUFS - L) / 20)
    return x.astype(np.float32), {'source': source, 'file': os.path.relpath(path, ROOT) if path.startswith(ROOT) else path,
                                  'measured_lufs': round(L, 1)}


def build(lines, length, cuts=()):
    out = np.zeros((ns(length) + 1, 2), np.float32)
    info = []
    for line in lines:
        x, meta = prepare(line)
        room = ROOM.get(line['speaker'], 0.09)
        st = np.stack([x, x], 1)
        if room:
            st = st + reverb(x, 'room', room)
        t = line['t']
        end = t + len(x) / SR
        cut = next((c for c in sorted(cuts) if t < c < end), None)
        if cut is not None:  # the line ends on a cut: cut it with the picture (5 ms ramp)
            k = ns(cut - t)
            st = st[:k]
            st[-ns(0.005):] *= np.linspace(1, 0, ns(0.005))[:, None]
            end = cut
        i = ns(t)
        n = min(len(st), len(out) - i)
        out[i:i + n] += st[:n]
        info.append({'t': t, 'speaker': line['speaker'], 'text': line['text'], 'key': line.get('key'), 'onset': t,
                     'end': round(end, 3), 'dur': round(end - t, 3), **meta})
    return out, info


def main():
    if '--check-synth' in sys.argv:
        # proves the fallback: re-perform one recorded line with the game's casting and compare duration
        line = next(v for v in TRAILER['vo'] if v['key'] == 'tic1bp')
        x, meta = prepare(line, synth=True)
        y, _ = prepare(line)
        print('synth', meta, round(len(x) / SR, 2), 's; recorded', round(len(y) / SR, 2), 's')
        return
    if '--store' in sys.argv:
        out, info = build(STORE_VO, 30.0)
        write_wav(os.path.join(OUT, 'store', 'vo.wav'), out[:ns(30.0)])
        json.dump(info, open(os.path.join(OUT, 'store', 'vo.json'), 'w'), indent=1)
        print('store vo', info)
        return
    length = TRAILER['length']
    out, info = build(TRAILER['vo'], length, cuts=[112.083])
    write_wav(os.path.join(OUT, 'stems', 'vo.wav'), out[:ns(length)])
    json.dump(info, open(os.path.join(OUT, 'stems', 'vo.json'), 'w'), indent=1)
    for i in info:
        print(f"{i['t']:7.2f}-{i['end']:7.2f} {i['speaker']:9s} {i['source']:11s} {i['measured_lufs']:6.1f} LUFS  {i['text'][:60]}")


if __name__ == '__main__':
    main()
