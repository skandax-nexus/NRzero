"""Contact sheets and clips for the walking-style / physics audit (docs/MOTION.md).
  python3 tools/feel/sheet.py <audit dir> <scenario> <view> [--cols=6] [--every=1] [--max=24] [--from=0] [--to=1e9] [--out=file.jpg]
  python3 tools/feel/sheet.py <audit dir> <scenario> <view> --mp4 [--fps=30]      (an H.264 clip of every frame)
Frames come from tools/feel/audit.mjs (<audit dir>/<scenario>/<view>_<frame>.jpg); each tile is labelled with its frame
number, time, Kai's ground speed, clip and grounded flag from <audit dir>/<scenario>.json.
"""
import json, os, subprocess, sys, glob
from PIL import Image, ImageDraw

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = {a[2:].split('=')[0]: (a.split('=', 1)[1] if '=' in a else True) for a in sys.argv[1:] if a.startswith('--')}
d, sc, view = args[0], args[1], args[2]
files = sorted(glob.glob(os.path.join(d, sc, view + '_*.jpg')))
fr = lambda f: int(os.path.basename(f).split('_')[-1].split('.')[0])
files = [f for f in files if float(opt.get('from', 0)) <= fr(f) <= float(opt.get('to', 1e9))]
data = json.load(open(os.path.join(d, sc + '.json')))
S = {s['f']: s for s in data['samples']}
if opt.get('mp4'):
    out = opt.get('out', os.path.join(d, f'{sc}_{view}.mp4'))
    lst = os.path.join(d, sc, f'_{view}.txt')
    with open(lst, 'w') as fh:
        for f in files: fh.write(f"file '{os.path.abspath(f)}'\nduration {1 / float(opt.get('fps', 30)):.5f}\n")
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-vf', 'fps=%s,format=yuv420p' % opt.get('fps', 30), '-c:v', 'libx264', '-crf', '20', '-movflags', '+faststart', out], check=True)
    print(out); sys.exit(0)
every = int(opt.get('every', 1)); files = files[::every][:int(opt.get('max', 24))]
cols = int(opt.get('cols', 6)); im0 = Image.open(files[0]); w, h = im0.size
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * h + 22), (16, 18, 22))
dr = ImageDraw.Draw(sheet)
dr.text((6, 5), f'{sc} / {view}  (dt {data["dt"]:.4f} s)', fill=(230, 230, 230))
for i, f in enumerate(files):
    im = Image.open(f); x, y = (i % cols) * w, (i // cols) * h + 22
    sheet.paste(im, (x, y))
    s = S.get(fr(f))
    if s:
        sp = (s['v'][0] ** 2 + s['v'][2] ** 2) ** 0.5
        lab = f"f{s['f']} t{s['t']:.2f} {sp:.2f}m/s {s['k']['clip'] if s.get('k') else ''}{'' if s['gr'] else ' AIR'}"
        dr.rectangle([x, y, x + w, y + 14], fill=(0, 0, 0))
        dr.text((x + 4, y + 2), lab, fill=(255, 230, 120))
out = opt.get('out', os.path.join(d, f'{sc}_{view}_sheet.jpg'))
sheet.save(out, quality=85)
print(out)
