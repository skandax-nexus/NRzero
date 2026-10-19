"""Measure the voices of the LibriTTS multi-speaker Piper model: median pitch (F0) and speaking rate per speaker id,
so each character can get a distinct, fitting voice.  Usage: python3 catalog.py PIPER_DIR OUT.json [N]
Resumable: the sample of every speaker is kept in PIPER_DIR/catalog_wavs and only missing ones are synthesized."""
import json, subprocess, sys, wave, os, tempfile
import numpy as np

PIPER, OUT = sys.argv[1], sys.argv[2]
N = int(sys.argv[3]) if len(sys.argv) > 3 else 904
MODEL = os.path.join(PIPER, 'libritts', 'en-us-libritts-high.onnx')
TEXT = 'The city kept moving, but every clock on the street had stopped at the same second. Nobody else seemed to notice.'

def f0(path):
    with wave.open(path) as w:
        sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    hop, win, out = int(sr * 0.01), int(sr * 0.04), []
    for i in range(0, len(x) - win, hop):
        seg = x[i:i + win] - x[i:i + win].mean()
        if np.sqrt((seg ** 2).mean()) < 0.02: continue
        ac = np.correlate(seg, seg, 'full')[win - 1:]
        lo, hi = int(sr / 400), int(sr / 70)
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] > 0.35 * ac[0]: out.append(sr / k)
    return (float(np.median(out)) if out else 0.0), len(x) / sr

def ok(path):
    try:
        with wave.open(path) as w:
            return w.getnframes() > 0
    except Exception:
        return False


WAVS = os.path.join(PIPER, 'catalog_wavs')
os.makedirs(WAVS, exist_ok=True)
todo = [sp for sp in range(N) if not ok(os.path.join(WAVS, f'{sp}.wav'))]
print(len(todo), 'speakers to synthesize', flush=True)
for i in range(0, len(todo), 50):
    # one piper process per batch (model loaded once per batch; progress survives interruptions)
    with tempfile.TemporaryDirectory() as td:
        batch = todo[i:i + 50]
        payload = '\n'.join(json.dumps({'text': TEXT, 'speaker_id': sp, 'output_file': os.path.join(td, f'{sp}.wav')}) for sp in batch)
        subprocess.run([os.path.join(PIPER, 'piper', 'piper'), '-m', MODEL, '--json-input'], input=payload.encode(), capture_output=True, check=True)
        for sp in batch:
            os.replace(os.path.join(td, f'{sp}.wav'), os.path.join(WAVS, f'{sp}.wav'))
    print('synthesized', min(i + 50, len(todo)), '/', len(todo), flush=True)
res = {}
for sp in range(N):
    hz, dur = f0(os.path.join(WAVS, f'{sp}.wav'))
    res[sp] = {'f0': round(hz, 1), 'dur': round(dur, 2)}
json.dump(res, open(OUT, 'w'), indent=0)
print('done', len(res))
