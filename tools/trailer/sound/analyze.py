"""AFTERZERO trailer sound: listening proxies.

  python3 tools/trailer/sound/analyze.py FILE.wav [--from S --to S] [--out PNG] [--marks]   spectrogram + envelope picture
  python3 tools/trailer/sound/analyze.py --report                                             full verification report

The report checks the final mixes and stems: EBU R128 integrated loudness and true peak (ffmpeg ebur128), the
digital-silence beats, every VO onset against the beat map, clipping, and clicks (sample-to-sample jumps that stand far
above the local signal), and writes pictures of the whole trailer and its sections next to the mixes.
"""
import json
import os
import re
import subprocess
import sys
import numpy as np
from scipy import signal
from dsp import SR, OUT, ROOT, read_wav, ns, db

TRAILER = json.load(open(os.path.join(ROOT, 'tools', 'trailer', 'trailer.json')))


def movavg(x, n):
    """centred moving average (cumulative-sum, O(len))"""
    c = np.cumsum(np.concatenate([[0.0], x.astype(np.float64)]))
    h = n // 2
    i = np.arange(len(x))
    a, b = np.clip(i - h, 0, len(x)), np.clip(i - h + n, 0, len(x))
    return (c[b] - c[a]) / n


def picture(path, out, t0=None, t1=None, marks=True, title=None, vo=None):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    x = read_wav(path)
    t0 = t0 or 0.0
    t1 = t1 or len(x) / SR
    seg = x[ns(t0):ns(t1)]
    m = seg.mean(1)
    rows = 3 if vo is not None else 2
    fig, ax = plt.subplots(rows, 1, figsize=(18, 4.2 * rows), sharex=True)
    nper = 4096 if t1 - t0 > 30 else 2048
    f, tt, S = signal.spectrogram(m, SR, nperseg=nper, noverlap=nper * 3 // 4)
    ax[0].pcolormesh(tt + t0, f, 10 * np.log10(S + 1e-15), vmin=-130, vmax=-40, shading='auto', cmap='magma')
    ax[0].set_yscale('symlog', linthresh=200)
    ax[0].set_ylim(25, 22000)
    ax[0].set_ylabel('Hz')
    ax[0].set_title(title or os.path.basename(path))
    # short-term loudness proxy (400 ms RMS, dBFS) and sample peaks
    hop = ns(0.05)
    k = len(m) // hop
    rms = np.sqrt(movavg(m[:k * hop] ** 2, ns(0.4))[::hop])
    pk = np.abs(seg[:k * hop]).max(1).reshape(k, hop).max(1)
    tk = t0 + np.arange(k) * 0.05
    ax[1].plot(tk, db(pk), lw=0.5, color='#999', label='peak dBFS')
    ax[1].plot(tk, db(rms), lw=1.0, color='#c33', label='400 ms RMS dBFS')
    ax[1].set_ylim(-70, 0)
    ax[1].legend(loc='lower left')
    if vo is not None:
        v = read_wav(vo)[ns(t0):ns(t1)].mean(1)
        rv = np.sqrt(movavg(v[:k * hop] ** 2, ns(0.1))[::hop])
        ax[2].plot(tk, db(rv), lw=0.8, color='#36c', label='VO 100 ms RMS')
        ax[2].plot(tk, db(rms), lw=0.8, color='#c33', alpha=0.5, label='mix')
        ax[2].set_ylim(-70, 0)
        ax[2].legend(loc='lower left')
    if marks:
        for e in TRAILER['timeline']:
            if t0 <= e['t'] <= t1:
                for a in ax:
                    a.axvline(e['t'], color='#0c0', lw=0.6, alpha=0.6)
                ax[0].text(e['t'] + 0.05, 16000, e.get('shot') or e.get('card'), color='w', fontsize=7)
        for h in TRAILER['hits']:
            if t0 <= h <= t1:
                ax[1].axvline(h, color='#fa0', lw=0.8, ls='--')
        for v in TRAILER['vo']:
            if t0 <= v['t'] <= t1:
                ax[-1].axvline(v['t'], color='#36c', lw=0.8, ls=':')
    ax[-1].set_xlabel('s')
    fig.tight_layout()
    fig.savefig(out, dpi=60)
    plt.close(fig)


def ebur128(path):
    r = subprocess.run(['ffmpeg', '-nostats', '-hide_banner', '-i', path, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    tail = r[r.rfind('Summary:'):]
    g = lambda k: float(re.search(k + r':\s+(-?[\d.]+|-inf)', tail).group(1).replace('-inf', '-200'))  # noqa: E731
    return {'I': g('I'), 'LRA': g('LRA'), 'TP': g('Peak')}


def clicks(x, thresh=12.0):
    """sample jumps far above the local high-frequency level: |d| / (local RMS of d) over 5 ms"""
    d = np.diff(x.mean(1))
    env = np.sqrt(movavg(d ** 2, 240)) + 1e-5
    lvl = np.sqrt(movavg(x.mean(1)[1:] ** 2, 240))
    r = np.abs(d) / env
    idx = np.where((r > thresh) & (np.abs(d) > 0.02) & (np.abs(d) > lvl * 0.5))[0]
    out, last = [], -SR
    for i in idx:
        if i - last > SR * 0.05:
            out.append(round(i / SR, 3))
        last = i
    return out


def onset(v, t_expect, rel_db=-26):
    """first time near t_expect where the VO stem's 10 ms RMS comes within rel_db of that line's loudest 10 ms"""
    a = ns(max(0, t_expect - 0.15))
    b = ns(t_expect + 0.6)
    m = v[a:b].mean(1)
    rms = np.sqrt(movavg(m ** 2, 480))
    if rms.max() <= 1e-6:
        return None
    i = np.argmax(db(rms / rms.max()) > rel_db)
    return a / SR + i / SR


def hit_alignment(music):
    """for every hit in the beat map: the strongest music onset (spectral-flux peak) within 80 ms, and its offset.
    Hits that open a silence (19.75, 97.375) are checked as cut-offs: the level must fall by 40 dB within 10 ms."""
    m = music.mean(1)
    f, t, S = signal.stft(m, SR, nperseg=1024, noverlap=1024 - 240)
    mag = np.log1p(np.abs(S) * 50)
    flux = np.maximum(0, np.diff(mag, axis=1)).sum(0)
    tt = t[1:]
    out = []
    for h in TRAILER['hits']:
        seg = m[ns(h):ns(h + 0.01)]
        pre = m[ns(h - 0.05):ns(h - 0.005)]
        if np.abs(m[ns(h) + ns(0.01):ns(h) + ns(0.3)]).max() < 1e-6:
            out.append({'hit': h, 'kind': 'cut-off', 'drop_db': round(float(db(np.abs(pre).max() + 1e-9) - db(np.abs(seg[-48:]).max() + 1e-12)), 1)})
            continue
        w = (tt > h - 0.08) & (tt < h + 0.08)
        loc = (tt > h - 1.0) & (tt < h + 1.0)
        i = np.argmax(np.where(w, flux, -1))
        out.append({'hit': h, 'kind': 'onset', 'offset_ms': round((tt[i] - h) * 1000), 'strength': round(float(flux[i] / (np.median(flux[loc]) + 1e-9)), 1)})
    return out


def report():
    res = {}
    mix = os.path.join(OUT, 'trailer_mix.wav')
    vo = os.path.join(OUT, 'stems', 'vo.wav')
    x = read_wav(mix)
    res['length_s'] = round(len(x) / SR, 3)
    res['ebur128'] = ebur128(mix)
    res['sample_peak_dbfs'] = round(float(db(np.abs(x).max())), 2)
    res['clipped_samples'] = int((np.abs(x) >= 0.9999).sum())
    res['clicks'] = clicks(x)
    sil = {}
    for t0, t1 in ((19.75, 20.75), (97.375, 98.583)):
        seg = x[ns(t0) + ns(0.01):ns(t1) - ns(0.005)]
        sil[f'{t0}-{t1}'] = round(float(db(np.abs(seg).max() + 1e-12)), 1)
    res['silence_peak_dbfs'] = sil
    v = read_wav(vo)
    ons = []
    for line in TRAILER['vo']:
        o = onset(v, line['t'])
        ons.append({'t': line['t'], 'speaker': line['speaker'], 'onset': None if o is None else round(o, 3),
                    'error_ms': None if o is None else round((o - line['t']) * 1000)})
    res['vo_onsets'] = ons
    res['hits'] = hit_alignment(read_wav(os.path.join(OUT, 'stems', 'music.wav')))
    st = os.path.join(OUT, 'store_mix.wav')
    if os.path.exists(st):
        y = read_wav(st)
        res['store'] = {'length_s': round(len(y) / SR, 3), 'ebur128': ebur128(st), 'clicks': clicks(y)}
    for name in ('music', 'sfx', 'vo'):
        p = os.path.join(OUT, 'stems', name + '.wav')
        if os.path.exists(p):
            res.setdefault('stems', {})[name] = ebur128(p)
    json.dump(res, open(os.path.join(OUT, 'report.json'), 'w'), indent=1)
    print(json.dumps(res, indent=1))
    pics = os.path.join(OUT, 'pictures')
    os.makedirs(pics, exist_ok=True)
    picture(mix, os.path.join(pics, 'mix_full.png'), vo=vo, title='trailer mix: spectrogram, levels, VO against mix')
    for a, b, name in ((0, 35, 'mix_a_hook'), (34, 75.5, 'mix_b_world'), (74, 117.1, 'mix_c_montage_title')):
        picture(mix, os.path.join(pics, name + '.png'), a, b, vo=vo)
    if os.path.exists(st):
        picture(st, os.path.join(pics, 'store_mix.png'), marks=False, title='store cut mix (30 s)')
    return res


if __name__ == '__main__':
    a = sys.argv[1:]
    if '--report' in a:
        report()
    else:
        f = a[0]
        t0 = float(a[a.index('--from') + 1]) if '--from' in a else None
        t1 = float(a[a.index('--to') + 1]) if '--to' in a else None
        out = a[a.index('--out') + 1] if '--out' in a else os.path.splitext(f)[0] + '.png'
        picture(f, out, t0, t1, marks='--nomarks' not in a)
        print(out)
