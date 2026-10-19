"""Measure the voices of the LibriTTS multi-speaker Piper model: median pitch (F0) and speaking rate per speaker id,
so each character can get a distinct, fitting voice.  Usage: python3 catalog.py PIPER_DIR OUT.json [N]"""
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

res = {}
with tempfile.TemporaryDirectory() as td:
    # one piper process for every speaker (model loaded once)
    payload = '\n'.join(json.dumps({'text': TEXT, 'speaker_id': sp, 'output_file': os.path.join(td, f'{sp}.wav')}) for sp in range(N))
    subprocess.run([os.path.join(PIPER, 'piper', 'piper'), '-m', MODEL, '--json-input'], input=payload.encode(), capture_output=True, check=True)
    for sp in range(N):
        hz, dur = f0(os.path.join(td, f'{sp}.wav'))
        res[sp] = {'f0': round(hz, 1), 'dur': round(dur, 2)}
json.dump(res, open(OUT, 'w'), indent=0)
print('done', len(res))
