"""Contact sheets of face_studio.mjs portraits (docs/CHARACTER_LOOK.md, "Faces"). System python3 with Pillow.

    python3 face_sheet.py rows SHOTDIR id1,id2,...          -> SHOTDIR/sheet_<id>.png (studio front, three, profile,
                                                              game three) and SHOTDIR/overview.png (studio fronts)
    python3 face_sheet.py grid OUT.png SHOTDIR id1,id2 [view_light] [cols] [title]
    python3 face_sheet.py cluster OUT.png SHOTDIR id1,id2 [title]  -> one column per id: studio front, three, profile
    python3 face_sheet.py pairs OUT.png SHOTDIR "a,b,label" "c,d,label" ...   -> one row per pair: a front, a three,
                                                              b front, b three (studio), the label above the row
Several SHOTDIRs can be given joined with ':' (the first one holding <id>_<view>_<light>.png wins).
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

T = 256      # tile size


def font(s=15):
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/freefont/FreeSans.ttf"):
        if os.path.exists(f):
            return ImageFont.truetype(f, s)
    return ImageFont.load_default()


def tile(dirs, name, label=None):
    for d in dirs.split(":"):
        p = os.path.join(d, name)
        if os.path.exists(p):
            im = Image.open(p).convert("RGB").resize((T, T), Image.LANCZOS)
            break
    else:
        im = Image.new("RGB", (T, T), (60, 20, 20))
    if label:
        dr = ImageDraw.Draw(im)
        dr.rectangle((0, T - 20, T, T), fill=(0, 0, 0))
        dr.text((5, T - 19), label, fill=(235, 235, 235), font=font(14))
    return im


def sheet(tiles, cols, title=None):
    rows = (len(tiles) + cols - 1) // cols
    top = 26 if title else 0
    s = Image.new("RGB", (T * cols, T * rows + top), (20, 20, 22))
    if title:
        ImageDraw.Draw(s).text((6, 4), title, fill=(240, 240, 240), font=font(16))
    for i, t in enumerate(tiles):
        s.paste(t, (T * (i % cols), top + T * (i // cols)))
    return s


def main(a):
    mode = a[0]
    if mode == "rows":
        d, ids = a[1], a[2].split(",")
        for i in ids:
            tl = [tile(d, f"{i}_{v}_studio.png", f"{i} {v}") for v in ("front", "three", "profile")] + [tile(d, f"{i}_three_game.png", f"{i} night")]
            sheet(tl, 4).save(os.path.join(d.split(":")[0], f"sheet_{i}.png"))
        sheet([tile(d, f"{i}_front_studio.png", i) for i in ids], min(8, len(ids))).save(os.path.join(d.split(":")[0], "overview.png"))
    elif mode == "grid":
        out, d, ids = a[1], a[2], a[3].split(",")
        vl = a[4] if len(a) > 4 else "front_studio"
        cols = int(a[5]) if len(a) > 5 else 8
        sheet([tile(d, f"{i}_{vl}.png", i) for i in ids], min(cols, len(ids)), a[6] if len(a) > 6 else None).save(out)
    elif mode == "cluster":
        out, d, ids = a[1], a[2], a[3].split(",")
        tl = [tile(d, f"{i}_{v}_studio.png", i if v == "front" else None) for v in ("front", "three", "profile") for i in ids]
        sheet(tl, len(ids), a[4] if len(a) > 4 else None).save(out)
    elif mode == "pairs":
        out, d = a[1], a[2]
        rows = []
        for spec in a[3:]:
            x, y, lab = (spec.split(",", 2) + [""])[:3]
            tl = [tile(d, f"{x}_front_studio.png", x), tile(d, f"{x}_three_studio.png"), tile(d, f"{y}_front_studio.png", y), tile(d, f"{y}_three_studio.png")]
            rows.append(sheet(tl, 4, lab))
        W = max(r.width for r in rows)
        s = Image.new("RGB", (W, sum(r.height for r in rows)), (20, 20, 22))
        yy = 0
        for r in rows:
            s.paste(r, (0, yy))
            yy += r.height
        s.save(out)
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:]) if len(sys.argv) > 1 else print(__doc__)
