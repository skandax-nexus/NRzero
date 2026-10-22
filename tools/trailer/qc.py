#!/usr/bin/env python3
"""Final-frame QC for the trailer shots (see docs/TRAILER.md, "Final-frame QC").

For every approved shot with a clip (or the ids given), writes <OUT>/qc/<id>/sheet.jpg (6 frames evenly spread over
the part the edit uses, the 2.39 band marked, plus a strip of per-frame luma and frame-to-frame change) and
<OUT>/qc/<id>/qc.json, and prints one summary line per shot. Checks:
  clip      ffprobe: codec, size, pix_fmt, frame count == spec frames, clip hash == frames hash
  black     ffmpeg blackdetect on the clip (d >= 0.08 s, pixels < 10 %) + frames whose band luma is below 6/255
  freeze    ffmpeg freezedetect on the clip (-70 dB, >= 0.25 s) + runs of >= 4 frames with no measurable change
  flicker   band-luma residual against a 5-frame median (a one-frame brightness jump that comes back)
  pop       a frame-to-frame change much bigger than its neighbours (a jump in staging, a popping object, a cut)
  local pop a 32x64 px block that steps to a new value in one frame and stays there, far beyond its own motion
            around that frame (an object or LOD popping, a lighting swap on one building)
  colour    a one-frame step of the band's mean RGB well above its neighbours (an environment-probe swap, a grade snap)
  grade     band mean RGB at the start / middle / end (drift inside the shot)
Flicker / pop / freeze candidates inside the handles are reported apart (the edit only uses them in a slipped cut).

  /home/user/tools/trailer-venv/bin/python tools/trailer/qc.py [ids...] [--force]
"""
import glob
import json
import os
import re
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.environ.get('TRAILER_OUT', '/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad/trailer')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
QC_VERSION = 2   # bump when the checks change: cached results of an older version are recomputed


def shots():
    out = {}
    for f in sorted(glob.glob(os.path.join(ROOT, 'tools/trailer/shots/*.json'))):
        j = json.load(open(f))
        for s in (j.get('shots', []) if isinstance(j, dict) else j):
            if s.get('approved') is True and s['id'] not in out:
                s['_file'] = os.path.basename(f)
                out[s['id']] = s
    return out


def ffprobe(clip):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries',
                        'stream=codec_name,width,height,pix_fmt,nb_read_frames,r_frame_rate', '-of', 'json', clip],
                       capture_output=True, text=True)
    return json.loads(r.stdout)['streams'][0]


def ffdetect(clip, fps):
    r = subprocess.run(['nice', '-n', '10', 'ffmpeg', '-hide_banner', '-nostats', '-i', clip, '-vf',
                        'blackdetect=d=0.08:pix_th=0.06:pic_th=0.90,freezedetect=n=-70dB:d=0.25', '-an', '-f', 'null', '-'],
                       capture_output=True, text=True)
    black = [(float(a), float(b)) for a, b in re.findall(r'black_start:([\d.]+) black_end:([\d.]+)', r.stderr)]
    fs = [float(x) for x in re.findall(r'freeze_start: ([\d.]+)', r.stderr)]
    fe = [float(x) for x in re.findall(r'freeze_end: ([\d.]+)', r.stderr)]
    freeze = [(a, fe[i] if i < len(fe) else None) for i, a in enumerate(fs)]
    return black, freeze


def load(path, size=(320, 148)):
    im = Image.open(path)
    im.draft('RGB', size)
    return np.asarray(im.convert('RGB').resize(size, Image.BILINEAR), dtype=np.float32)


def local_pops(Yb, N):
    """Yb: per-frame band luma (N, h, w) at 320 wide. Blocks of 8x16 px here = 32x64 px at 1280."""
    hb, wb = Yb.shape[1] // 8, Yb.shape[2] // 16
    B = Yb[:, :hb * 8, :wb * 16].reshape(N, hb, 8, wb, 16).mean((2, 4))
    d = np.abs(np.diff(B, axis=0))
    out = []
    for i in range(2, N - 2):
        win = np.concatenate([d[max(0, i - 6):i - 1], d[i:min(N - 1, i + 5)]], axis=0)
        base = np.median(win, axis=0) + 1.0
        step = np.abs(B[i] - B[i - 1])
        keep = np.abs(B[i + 2] - B[i])                  # small: the new value stays (a step, not a flash)
        m = (step > 18) & (step > 5 * base) & (keep < 0.5 * step)
        if m.any():
            out.append((i, int(m.sum()), round(float(step[m].max()), 1)))
    return out


def colour_steps(rgb, N):
    dr = np.abs(np.diff(rgb, axis=0)).max(axis=1)
    out = []
    for i in range(2, N - 1):
        nb = np.concatenate([dr[max(0, i - 6):i - 1], dr[i:min(N - 1, i + 5)]])
        if dr[i - 1] > 0.8 and dr[i - 1] > 4 * (np.median(nb) + 0.05):
            out.append((i, [round(float(x), 1) for x in rgb[i] - rgb[i - 1]]))
    return out


def med(a, k):
    p = k // 2
    ap = np.pad(a, p, mode='edge')
    return np.array([np.median(ap[i:i + k]) for i in range(len(a))])


def analyse(sid, s, force=False):
    fdir = os.path.join(OUT, 'frames', sid)
    clip = os.path.join(OUT, 'clips', sid + '.mp4')
    qdir = os.path.join(OUT, 'qc', sid)
    os.makedirs(qdir, exist_ok=True)
    N, h = int(s['frames']), int(s.get('handles', 12))
    meta = json.load(open(os.path.join(fdir, 'meta.json')))
    cj = json.load(open(os.path.join(OUT, 'clips', sid + '.json'))) if os.path.exists(os.path.join(OUT, 'clips', sid + '.json')) else {}
    stamp = os.path.join(qdir, 'qc.json')
    if not force and os.path.exists(stamp):
        old = json.load(open(stamp))
        if old.get('qc_version') == QC_VERSION and old.get('hash') == meta.get('hash') and old.get('clip_encoded') == cj.get('encoded'):
            return old
    files = [os.path.join(fdir, '%05d.jpg' % i) for i in range(N)]
    missing = [i for i, f in enumerate(files) if not os.path.exists(f)]
    if missing:
        return {'id': sid, 'error': 'missing frames %s' % missing[:10]}
    imgs = [load(f) for f in files]
    H = imgs[0].shape[0]
    b0, b1 = round(H * 27 / 590), round(H * 563 / 590)        # the 2.39 band of the 2.167 frame
    band = [im[b0:b1] for im in imgs]
    Y = [0.2126 * b[..., 0] + 0.7152 * b[..., 1] + 0.0722 * b[..., 2] for b in band]
    L = np.array([y.mean() for y in Y])
    rgb = np.array([b.reshape(-1, 3).mean(0) for b in band])
    mad = np.array([0.0] + [np.abs(Y[i] - Y[i - 1]).mean() for i in range(1, N)])
    # flicker: one-frame luma excursions against a 5-frame median
    resid = L - med(L, 5)
    flick = [(i, round(float(resid[i]), 2)) for i in range(N) if abs(resid[i]) > max(2.0, 0.06 * med(L, 5)[i])]
    # pop: frame-to-frame change much bigger than the local norm
    m9 = med(mad, 9)
    pops = [(i, round(float(mad[i]), 2), round(float(m9[i]), 2)) for i in range(1, N) if mad[i] > 3.0 and mad[i] > 3.0 * max(m9[i], 0.5)]
    # freeze: runs of frames with no measurable change
    still = mad < 0.08
    runs, i = [], 1
    while i < N:
        if still[i]:
            j = i
            while j + 1 < N and still[j + 1]:
                j += 1
            if j - i + 1 >= 4:
                runs.append((i - 1, j))
            i = j + 1
        else:
            i += 1
    dark = [i for i in range(N) if L[i] < 6]
    inside = lambda i: h <= i <= N - 1 - h
    lp = local_pops(np.stack(Y), N)
    cs = colour_steps(rgb, N)
    probe = ffprobe(clip)
    black, freeze = ffdetect(clip, 24)
    res = {
        'id': sid, 'qc_version': QC_VERSION, 'hash': meta.get('hash'), 'clip_hash': cj.get('hash'), 'clip_encoded': cj.get('encoded'), 'frames': N, 'handles': h,
        'grade': s.get('grade'), 'mission': s.get('mission'),
        'clip': {k: probe.get(k) for k in ('codec_name', 'width', 'height', 'pix_fmt', 'nb_read_frames', 'r_frame_rate')},
        'luma': {'min': round(float(L.min()), 1), 'mean': round(float(L.mean()), 1), 'max': round(float(L.max()), 1)},
        'rgb': {'start': [round(float(x), 1) for x in rgb[h]], 'mid': [round(float(x), 1) for x in rgb[N // 2]], 'end': [round(float(x), 1) for x in rgb[N - 1 - h]]},
        'mad': {'median': round(float(np.median(mad[1:])), 2), 'max': round(float(mad[1:].max()), 2), 'argmax': int(mad[1:].argmax()) + 1},
        'flicker': [f for f in flick if inside(f[0])], 'flicker_handles': [f for f in flick if not inside(f[0])],
        'pops': [p for p in pops if inside(p[0])], 'pops_handles': [p for p in pops if not inside(p[0])],
        'local_pops': [x for x in lp if inside(x[0])], 'local_pops_handles': [x for x in lp if not inside(x[0])],
        'colour_steps': [x for x in cs if inside(x[0])], 'colour_steps_handles': [x for x in cs if not inside(x[0])],
        'still_runs': runs, 'dark_frames': dark, 'blackdetect': black, 'freezedetect': freeze,
    }
    problems = []
    c = res['clip']
    if c['codec_name'] != 'h264' or c['pix_fmt'] != 'yuv420p' or int(c['nb_read_frames']) != N or c['width'] != meta.get('width'):
        problems.append('clip format')
    if cj.get('hash') != meta.get('hash'):
        problems.append('clip stale')
    if black or [d for d in dark if inside(d)]:
        problems.append('black')
    if freeze or [r for r in runs if inside(r[0]) or inside(r[1])]:
        problems.append('freeze')
    if res['flicker']:
        problems.append('flicker')
    if res['pops']:
        problems.append('pop')
    if [x for x in res['local_pops'] if x[1] >= 3 or x[2] >= 40]:
        problems.append('local pop')
    if res['colour_steps']:
        problems.append('colour step')
    res['problems'] = problems
    sheet(sid, s, files, L, mad, h, qdir, res)
    json.dump(res, open(stamp, 'w'), indent=1)
    return res


def sheet(sid, s, files, L, mad, h, qdir, res):
    N = len(files)
    picks = [round(h + k * (N - 1 - 2 * h) / 5) for k in range(6)]
    tw, th = 640, 295
    W, Hs = tw * 3, th * 2 + 170
    out = Image.new('RGB', (W, Hs), (16, 16, 18))
    d = ImageDraw.Draw(out)
    try:
        font, small = ImageFont.truetype(FONT, 18), ImageFont.truetype(FONT, 14)
    except OSError:
        font = small = ImageFont.load_default()
    for k, i in enumerate(picks):
        im = Image.open(files[i]).convert('RGB').resize((tw, th), Image.LANCZOS)
        x, y = (k % 3) * tw, (k // 3) * th
        out.paste(im, (x, y))
        yb0, yb1 = y + round(th * 27 / 590), y + round(th * 563 / 590)
        d.line([(x, yb0), (x + tw, yb0)], fill=(255, 210, 0), width=1)
        d.line([(x, yb1), (x + tw, yb1)], fill=(255, 210, 0), width=1)
        d.rectangle([x, y + th - 22, x + 170, y + th], fill=(0, 0, 0))
        d.text((x + 4, y + th - 21), 'f%03d  %.2fs' % (i, (i - h) / 24), font=small, fill=(255, 255, 255))
    # strip: luma (white) and frame change (orange), handles shaded
    gy0, gh = th * 2 + 10, 120
    d.rectangle([0, gy0, W, gy0 + gh], fill=(28, 28, 32))
    sx = lambda i: 10 + (W - 20) * i / max(1, N - 1)
    d.rectangle([sx(0), gy0, sx(h), gy0 + gh], fill=(50, 30, 30))
    d.rectangle([sx(N - 1 - h), gy0, sx(N - 1), gy0 + gh], fill=(50, 30, 30))
    lmax = max(1.0, float(L.max()) * 1.1)
    mmax = max(4.0, float(mad.max()) * 1.1)
    d.line([(sx(i), gy0 + gh - gh * L[i] / lmax) for i in range(N)], fill=(235, 235, 235), width=2)
    d.line([(sx(i), gy0 + gh - gh * mad[i] / mmax) for i in range(N)], fill=(255, 140, 40), width=2)
    for f in res['flicker'] + res['flicker_handles']:
        d.line([(sx(f[0]), gy0), (sx(f[0]), gy0 + gh)], fill=(80, 160, 255), width=1)
    for p in res['pops'] + res['pops_handles']:
        d.line([(sx(p[0]), gy0), (sx(p[0]), gy0 + gh)], fill=(255, 60, 60), width=1)
    for p in res['local_pops'] + res['local_pops_handles'] + res['colour_steps'] + res['colour_steps_handles']:
        d.line([(sx(p[0]), gy0 + gh - 18), (sx(p[0]), gy0 + gh)], fill=(200, 80, 255), width=2)
    txt = '%s  m%s  %s  %d f  luma %.0f-%.0f (max %.0f)  change med %.2f max %.2f @f%d   problems: %s' % (
        sid, s.get('mission'), s.get('grade'), N, res['luma']['min'], res['luma']['mean'], res['luma']['max'],
        res['mad']['median'], res['mad']['max'], res['mad']['argmax'], ', '.join(res['problems']) or 'none')
    d.text((10, gy0 + gh + 12), txt, font=font, fill=(255, 255, 255))
    d.text((10, gy0 + 4), 'luma (white) / frame change (orange) / flicker (blue) / pop (red) / local pop, colour step (violet ticks); handles shaded', font=small, fill=(150, 150, 150))
    out.save(os.path.join(qdir, 'sheet.jpg'), quality=90)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    force = '--force' in sys.argv
    all_s = shots()
    ids = args or sorted(all_s)
    summary = {}
    for sid in ids:
        s = all_s.get(sid)
        if not s:
            print(sid, 'not an approved shot')
            continue
        if not os.path.exists(os.path.join(OUT, 'clips', sid + '.mp4')):
            print(sid, 'no clip yet')
            continue
        r = analyse(sid, s, force)
        summary[sid] = r
        if 'error' in r:
            print(sid, 'ERROR', r['error'])
            continue
        print('%s %-9s %3d f luma %5.1f-%5.1f chg med %.2f max %.2f@%d  flick %s pops %s local %s colour %s still %s black %s freeze %s  -> %s' % (
            sid, r['grade'], r['frames'], r['luma']['min'], r['luma']['max'], r['mad']['median'], r['mad']['max'], r['mad']['argmax'],
            r['flicker'] or '-', r['pops'] or '-', [x for x in r['local_pops'] if x[1] >= 3 or x[2] >= 40] or '-', r['colour_steps'] or '-',
            r['still_runs'] or '-', r['blackdetect'] or '-', r['freezedetect'] or '-', ', '.join(r['problems']) or 'ok'), flush=True)
    if not args:
        json.dump(summary, open(os.path.join(OUT, 'qc', 'summary.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
