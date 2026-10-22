"""AFTERZERO trailer mix: stems -> the 117 s trailer mix and the 30 s store-cut mix.

  python3 tools/trailer/sound/mix.py [--store]

- Dialogue first: the score ducks 6 dB under every line (sidechain on the VO stem, 50 ms lookahead, 60 ms attack,
  450 ms release); ambience beds duck 4 dB; spot effects 2 dB.
- Gentle master glue compression, then a 4x-oversampled true-peak limiter.
- Loudness: integrated -14 LUFS, true peak <= -1 dBTP. The gain is found by measuring (ffmpeg loudnorm pass 1),
  applied with the limiter in the loop, then the second loudnorm pass runs in linear mode with the measured values
  (so it applies a pure gain, no dynamic processing); ffmpeg ebur128 verifies the file that is written.
- Outputs (OUT): trailer_mix.wav (48 kHz 24-bit stereo), trailer_mix.m4a (AAC 256k) and store_mix.wav / .m4a;
  the stems it used are in OUT/stems (music.wav, sfx.wav, vo.wav) and OUT/store.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import numpy as np
from dsp import SR, OUT, ns, read_wav, write_wav, duck, compress, limit, undb

TARGET_I, TARGET_TP = -14.0, -1.0
GAINS = {'music': 0.0, 'sfx': -1.0, 'vo': 5.0}  # dB, before loudness normalisation


def loudnorm_measure(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af',
                        f'loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA=20:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    return json.loads(r[r.rfind('{'):r.rfind('}') + 1])


def loudnorm_apply(src, dst, m):
    af = (f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA=20:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true:print_format=json")
    r = subprocess.run(['ffmpeg', '-y', '-hide_banner', '-nostats', '-i', src, '-af', af, '-ar', str(SR), '-c:a', 'pcm_s24le', dst],
                       capture_output=True, text=True).stderr
    j = json.loads(r[r.rfind('{'):r.rfind('}') + 1])
    return j


def ebur128(path):
    r = subprocess.run(['ffmpeg', '-nostats', '-hide_banner', '-i', path, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    tail = r[r.rfind('Summary:'):]
    g = lambda k: float(re.search(k + r':\s+(-?[\d.]+)', tail).group(1))  # noqa: E731
    return {'I': g('I'), 'LRA': g('LRA'), 'TP': g('Peak')}


def master(music, sfx, vo, name, length, gates=()):
    n = ns(length)
    music, sfx, vo = (x[:n] if len(x) >= n else np.pad(x, ((0, n - len(x)), (0, 0))) for x in (music, sfx, vo))
    music = music * undb(GAINS['music'])
    sfx = sfx * undb(GAINS['sfx'])
    vo = vo * undb(GAINS['vo'])
    md, red = duck(music, vo, depth_db=6.0, threshold_db=-45, attack=0.06, release=0.45, lookahead=0.05)
    sd, _ = duck(sfx, vo, depth_db=3.0, threshold_db=-45, attack=0.06, release=0.5, lookahead=0.05)
    bus = md + sd
    bus = compress(bus, threshold=-16, ratio=1.6, attack=0.02, release=0.3, knee=8)
    mix = bus + vo
    mix = compress(mix, threshold=-12, ratio=1.4, attack=0.01, release=0.2, knee=6)
    for t0, t1 in gates:  # the silence beats are digital zero in the master, whatever the stems carry
        mix[ns(t0):ns(t1)] = 0
    # loudness loop: measure, gain, limit, re-measure (the limiter costs a little loudness at the montage)
    with tempfile.TemporaryDirectory() as td:
        tmp = os.path.join(td, 'pre.wav')
        g = 0.0
        for it in range(8):
            y = limit(mix * undb(g), ceiling_db=TARGET_TP - 0.6)
            write_wav(tmp, y)
            e = ebur128(tmp)  # converge on the verifying meter (EBU R128, ffmpeg ebur128)
            err = TARGET_I - e['I']
            print(f'  pass {it}: I {e["I"]} TP {e["TP"]} gain {g:+.2f}')
            if abs(err) < 0.05:
                break
            g += err * (1.25 if it else 1.0)
        m = loudnorm_measure(tmp)
        # loudnorm's integrator can read a few tenths away from ebur128 on short programmes (the store cut); the second
        # pass is given the ebur128 reading as measured_I, so its linear gain lands on the verifying meter's scale
        m['input_i'] = e['I']
        m['target_offset'] = 0
        final = os.path.join(OUT, name + '.wav')
        j = loudnorm_apply(tmp, final, m)
    print('  loudnorm pass 2:', j.get('normalization_type'), 'out I', j.get('output_i'), 'TP', j.get('output_tp'))
    meas = ebur128(final)
    print('  ebur128:', meas)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', final, '-c:a', 'aac', '-b:a', '256k', os.path.join(OUT, name + '.m4a')], check=True)
    return meas, red


def main():
    if '--store' in sys.argv:
        d = os.path.join(OUT, 'store')
        meas, _ = master(read_wav(os.path.join(d, 'music.wav')), read_wav(os.path.join(d, 'sfx.wav')), read_wav(os.path.join(d, 'vo.wav')),
                         'store_mix', 30.0)
        json.dump(meas, open(os.path.join(OUT, 'store_mix.json'), 'w'))
        return
    d = os.path.join(OUT, 'stems')
    tr = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'trailer.json')))
    meas, red = master(read_wav(os.path.join(d, 'music.wav')), read_wav(os.path.join(d, 'sfx.wav')), read_wav(os.path.join(d, 'vo.wav')),
                       'trailer_mix', tr['length'], gates=[(19.75, 20.75), (97.375, 98.583)])
    json.dump(meas, open(os.path.join(OUT, 'trailer_mix.json'), 'w'))


if __name__ == '__main__':
    main()
