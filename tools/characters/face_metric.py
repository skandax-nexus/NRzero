"""Face distinctness from the meshes themselves (docs/CHARACTER_LOOK.md, "Faces").

Every MakeHuman build shares one topology, so two faces compare vertex for vertex:
  geo   aligned face-vertex distance: the face region (brow to chin, cheek to cheek, ears excluded) of each sculpt is
        centred and scaled to the neutral face's size, then the RMS vertex distance in mm (also per region: eyes,
        brows, forehead, nose, mouth, cheeks, jaw, chin);
  lm    landmark proportions: 22 ratios between anthropometric landmarks (nasion, nose tip, subnasale, lips, stomion,
        chin, menton, eye corners, alae, mouth corners, cheekbones, jaw angles, brows, head top), each in units of the
        standard deviation of a reference population, distance = RMS of the differences;
  app   appearance: skin, hair colour and style, eye colour, facial hair and brows (0 = nothing shared, 1 = identical).
The reference population is MakeHuman's own space sampled broadly with a fixed seed (sex, age, build, ancestry mix and
every face detail modifier at random), so a pair's percentile reads "as alike as the closest N % of random strangers of
the same sex and age group". geo and lm percentiles are averaged into one score `sim` (0 = alike as the population's
closest pair, 100 = typical strangers) and a pair "reads as the same face" when both are low (see THRESH).

    MH_DATA=... FACES_DIR=... /home/user/tools/venv/bin/python face_metric.py OUTDIR [--pop=400] [--ids=a,b]
    ... face_metric.py OUTDIR --landmarks          # landmark check plot of the neutral head (OUTDIR/landmarks.png)

Writes OUTDIR/faces.json (everything), OUTDIR/report.md (flagged pairs, Kai resemblance, clusters, per-character
diagnostics), OUTDIR/matrix_sim.csv, OUTDIR/heatmap.png (needs Pillow; skipped without it).
"""
import itertools
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("CAST", "nrzero")
import mh  # noqa: E402

# thresholds the face steps must meet (percentiles of the reference population's same-group pairs; see report.md)
THRESH = dict(
    same=10,         # sim below this (and both geo and lm below 2 x this): two characters read as the same face
    alike=20,        # sim below this: a strong look-alike (allowed only for the same person at two ages)
    min_pair=25,     # target: every pair of different named characters / extras of the same group >= this
    min_crowd=15,    # target: crowd templates among themselves >= this (crowds are seen far and briefly)
    min_vs_kai=40,   # target: anyone but the Witness and young Kai, against Kai, >= this
    witness_max=12,  # target: the Witness against Kai aged to 58 (same details on the Witness's body) <= this
    mira_band=(15, 45),   # target: Mira against Kai: a family likeness (brow line, eyes), clearly her own face
    app_max=0.6,     # target: two different people of one group never share skin + hair colour + style (app below this)
)
# proportions of an attractive adult face, measured with this file's landmarks (FaceSpace.canon). Ranges come from
# adult anthropometric norms translated to these landmarks (nasion, not glabella, so the midface reads short:
# n-sn / sn-me is about 0.76 in men and 0.80 in women, not 1.0; en-en / eye width about 1.07, about 1.3 for East Asian
# eyes; sn-sto / sto-me about 0.46) and from the classic attractiveness cues (a lower lip at least as full as the
# upper, a slight upward canthal tilt, a chin that comes close to the lower-lip line in profile, a jaw a little
# narrower than the cheeks), widened for heritage. (lo, hi) for men / women, overridden for East Asian (asian > 0.6)
# or African (african > 0.5) ancestry where the norms differ; children are not checked.
CANON = dict(
    eye_spacing=dict(m=(0.95, 1.2), f=(0.95, 1.18), asian=(1.05, 1.35)),
    mid_lower_thirds=dict(m=(0.72, 0.88), f=(0.75, 0.9)),
    lip_chin=dict(m=(0.42, 0.53), f=(0.42, 0.55)),
    lower_upper_lip=dict(m=(0.95, 1.5), f=(1.05, 1.6)),
    canthal_tilt_deg=dict(m=(1.5, 7.0), f=(3.0, 9.0), asian=(4.0, 12.5)),
    mouth_vs_nose=dict(m=(1.38, 1.75), f=(1.4, 1.8), african=(1.25, 1.6)),
    nose_vs_eyes=dict(m=(0.8, 1.06), f=(0.76, 1.0), african=(0.9, 1.25)),
    jaw_vs_cheeks=dict(m=(0.84, 0.95), f=(0.76, 0.87)),
    chin_profile_mm=dict(m=(-5.0, 0.5), f=(-6.5, -1.0), african=(-9.5, -2.0)),
)


def canon_check(c, group, mac):
    """[(key, value, lo, hi)] for each canon proportion outside its range (adults only)."""
    if group == "kid":
        return []
    out = []
    for k, r in CANON.items():
        lo, hi = r[group]
        if mac.get("asian", 0) > 0.6 and "asian" in r:
            lo, hi = r["asian"]
        if mac.get("african", 0) > 0.5 and "african" in r:
            lo, hi = r["african"]
        if not lo <= c[k] <= hi:
            out.append((k, round(float(c[k]), 2), lo, hi))
    return out


SAME_PERSON = {("kai", "witness"), ("kai", "kid_kai"), ("witness", "kid_kai"), ("mira", "kid_mira"), ("oskar", "oskar26")}
PRINCIPALS = ("kai", "mira", "witness", "sera", "rook", "niko", "tala", "iven", "jun", "hale", "brandt", "child", "anja", "mara", "orren")
CROWD_PREFIX = ("c49_", "c26_", "surv_", "continuum_", "anc_", "helix_", "transit_worker", "technician")


# ---------------------------------------------------------------------------------------------------------------
# geometry: face region, landmarks, regions (from the neutral MakeHuman head; indices are valid for every build)
# ---------------------------------------------------------------------------------------------------------------
class FaceSpace:
    def __init__(self):
        P = mh.sculpt(dict(gender=0.5))
        self.P0 = P
        body = np.array(mh.group_vertices("body"))
        tab = mh.modifier_table()
        def tset(k):
            return set(mh.target(tab[k][1])[0].tolist())
        ears = tset("ears/l-ear-scale-decr|incr") | tset("ears/r-ear-scale-decr|incr")
        neck = mh.joint(P, "neck")
        head = body[(P[body, 1] > neck[1] + 0.01) & ~np.isin(body, list(ears))]
        self.head = head
        def mirror(i):
            return int(head[np.argmin(np.linalg.norm(P[head] - P[i] * np.array([-1, 1, 1]), axis=1))])
        L = dict(N=132, Prn=297, Sn=343, Ls=455, Sto=474, Li=495, Pg=733, Me=747, En_L=6856, Ex_L=6809, Al_R=337, Go_R=740)
        L["En_R"], L["Ex_R"], L["Al_L"], L["Go_L"] = mirror(L["En_L"]), mirror(L["Ex_L"]), mirror(L["Al_R"]), mirror(L["Go_R"])
        lips = np.array(sorted(tset("mouth/mouth-upperlip-volume-decr|incr") | tset("mouth/mouth-lowerlip-volume-decr|incr")))
        L["Ch_L"] = int(lips[np.argmax(P[lips, 0])])
        L["Ch_R"] = mirror(L["Ch_L"])
        ey = (P[L["En_L"], 1] + P[L["Ex_L"], 1]) / 2
        band = head[(P[head, 1] > ey - 0.032) & (P[head, 1] < ey - 0.008) & (P[head, 2] > 0.06)]
        L["Zy_L"] = int(band[np.argmax(P[band, 0])])
        L["Zy_R"] = mirror(L["Zy_L"])
        ex = (P[L["En_L"], 0] + P[L["Ex_L"], 0]) / 2
        bw = head[(np.abs(P[head, 0] - ex) < 0.006) & (P[head, 1] > ey + 0.008) & (P[head, 1] < ey + 0.03)]
        L["Br_L"] = int(bw[np.argmax(P[bw, 2])])
        L["Br_R"] = mirror(L["Br_L"])
        L["Vx"] = int(head[np.argmax(P[head, 1])])
        mid = head[np.abs(P[head, 0]) < 0.002]
        fh = mid[np.abs(P[mid, 1] - (P[L["N"], 1] + 0.045)) < 0.006]
        L["Ft"] = int(fh[np.argmax(P[fh, 2])])
        self.L = L
        Me, N = P[L["Me"]], P[L["N"]]
        face = head[(P[head, 1] > Me[1] - 0.004) & (P[head, 1] < N[1] + 0.055) & (P[head, 2] > P[L["Go_R"], 2] - 0.004)
                    & (np.abs(P[head, 0]) <= P[L["Zy_L"], 0] + 0.004)]
        self.face = face
        X = P[face]
        # vertex areas (a third of each adjacent body quad / triangle on the neutral head): distances are area-weighted,
        # so the dense eyelid and lip rings do not outvote the cheeks, jaw and forehead
        _, _, F = mh.base()
        area = np.zeros(len(P))
        for vs, _, g in F:
            if g != "body":
                continue
            q = P[list(vs)]
            a = 0.5 * np.linalg.norm(np.cross(q[1] - q[0], q[2] - q[0]))
            if len(vs) == 4:
                a += 0.5 * np.linalg.norm(np.cross(q[2] - q[0], q[3] - q[0]))
            area[list(vs)] += a / len(vs)
        w = area[face]
        self.w = w / w.sum()
        Xc = X - (X * self.w[:, None]).sum(0)
        self.s0 = float(np.sqrt(((Xc ** 2).sum(1) * self.w).sum()))
        # regions: nearest seed
        def c(*ks):
            return np.mean([P[L[k]] for k in ks], axis=0)
        seeds = [("eyes", c("En_L", "Ex_L")), ("eyes", c("En_R", "Ex_R")), ("brows", P[L["Br_L"]]), ("brows", P[L["Br_R"]]),
                 ("forehead", P[L["Ft"]]), ("forehead", (P[L["Ft"]] + N) / 2 + np.array([0, 0.01, 0])), ("nose", P[L["Prn"]]), ("nose", (P[L["Prn"]] + N) / 2),
                 ("mouth", c("Sto")), ("mouth", c("Ch_L")), ("mouth", c("Ch_R")), ("chin", P[L["Pg"]]), ("chin", P[L["Me"]]),
                 ("cheeks", (P[L["Zy_L"]] + P[L["Ch_L"]]) / 2), ("cheeks", (P[L["Zy_R"]] + P[L["Ch_R"]]) / 2), ("cheeks", P[L["Zy_L"]]), ("cheeks", P[L["Zy_R"]]),
                 ("jaw", P[L["Go_L"]]), ("jaw", P[L["Go_R"]]), ("jaw", (P[L["Go_L"]] + P[L["Pg"]]) / 2), ("jaw", (P[L["Go_R"]] + P[L["Pg"]]) / 2)]
        S = np.array([s[1] for s in seeds])
        lab = [s[0] for s in seeds]
        near = np.argmin(((X[:, None, :] - S[None]) ** 2).sum(2), axis=1)
        self.region = np.array([lab[k] for k in near])
        self.regions = sorted(set(lab))

    def rms(self, D, mask=None):
        """Area-weighted RMS length (mm) of per-vertex differences D (n, 3), optionally over a region mask."""
        w = self.w if mask is None else self.w * mask
        return float(np.sqrt(((D ** 2).sum(1) * w).sum() / w.sum()))

    def norm(self, P):
        X = P[self.face]
        X = X - (X * self.w[:, None]).sum(0)
        return X / np.sqrt(((X ** 2).sum(1) * self.w).sum()) * self.s0 * 1000.0     # mm at the neutral face's size

    def canon(self, P):
        """Proportions of an attractive face (CANON) measured on a sculpt: real units, not population z."""
        L = {k: P[v] for k, v in self.L.items()}
        en = abs(L["En_L"][0] - L["En_R"][0])
        ew = (np.linalg.norm(L["En_L"] - L["Ex_L"]) + np.linalg.norm(L["En_R"] - L["Ex_R"])) / 2
        nw = abs(L["Al_L"][0] - L["Al_R"][0])
        mw = abs(L["Ch_L"][0] - L["Ch_R"][0])
        tilt = np.degrees(np.arctan2(((L["Ex_L"][1] - L["En_L"][1]) + (L["Ex_R"][1] - L["En_R"][1])) / 2, (abs(L["Ex_L"][0] - L["En_L"][0]) + abs(L["Ex_R"][0] - L["En_R"][0])) / 2))
        return dict(mid_lower_thirds=(L["N"][1] - L["Sn"][1]) / (L["Sn"][1] - L["Me"][1]), lip_chin=(L["Sn"][1] - L["Sto"][1]) / (L["Sto"][1] - L["Me"][1]),
                    eye_spacing=en / ew, nose_vs_eyes=nw / en, mouth_vs_nose=mw / nw, canthal_tilt_deg=float(tilt),
                    lower_upper_lip=(L["Sto"][1] - L["Li"][1]) / max(1e-4, L["Ls"][1] - L["Sto"][1]),
                    jaw_vs_cheeks=abs(L["Go_L"][0] - L["Go_R"][0]) / abs(L["Zy_L"][0] - L["Zy_R"][0]),
                    chin_profile_mm=float((L["Pg"][2] - L["Li"][2]) * 1000), eye_width_mm=float(ew * 1000))

    def features(self, P):
        L = {k: P[v] for k, v in self.L.items()}
        def d(a, b):
            return float(np.linalg.norm(L[a] - L[b]))
        fh = d("N", "Me")
        zy = abs(L["Zy_L"][0] - L["Zy_R"][0])
        en = abs(L["En_L"][0] - L["En_R"][0])
        ew = (d("En_L", "Ex_L") + d("En_R", "Ex_R")) / 2
        mw = abs(L["Ch_L"][0] - L["Ch_R"][0])
        eyc = (L["En_L"][1] + L["Ex_L"][1]) / 2
        f = dict(
            face_index=fh / zy, jaw_width=abs(L["Go_L"][0] - L["Go_R"][0]) / zy, eye_spacing=en / zy, eye_width=ew / zy,
            canthal_tilt=((L["Ex_L"][1] - L["En_L"][1]) + (L["Ex_R"][1] - L["En_R"][1])) / 2 / ew,
            nose_length=(L["N"][1] - L["Sn"][1]) / fh, nose_width=abs(L["Al_L"][0] - L["Al_R"][0]) / en,
            nose_projection=(L["Prn"][2] - L["Sn"][2]) / fh, nose_bridge=(L["Prn"][2] - L["N"][2]) / fh,
            mouth_width=mw / zy, upper_lip=(L["Sn"][1] - L["Sto"][1]) / fh,
            lip_fullness_up=(L["Ls"][2] - L["Sn"][2]) / fh, lip_fullness_lo=(L["Li"][2] - L["Pg"][2]) / fh,
            lower_face=(L["Sn"][1] - L["Me"][1]) / fh, chin_height=(L["Li"][1] - L["Me"][1]) / fh,
            chin_projection=(L["Pg"][2] - L["Sn"][2]) / fh, brow_height=((L["Br_L"][1] + L["Br_R"][1]) / 2 - eyc) / fh,
            brow_ridge=((L["Br_L"][2] + L["Br_R"][2]) / 2 - L["N"][2]) / fh, forehead=(L["Vx"][1] - L["N"][1]) / fh,
            forehead_slope=(L["Ft"][2] - L["N"][2]) / fh, cheekbone_depth=((L["Zy_L"][2] + L["Zy_R"][2]) / 2 - L["Go_R"][2]) / fh,
            mouth_corner_tilt=((L["Ch_L"][1] + L["Ch_R"][1]) / 2 - L["Sto"][1]) / mw)
        return f


FEATS = None


# ---------------------------------------------------------------------------------------------------------------
# appearance
# ---------------------------------------------------------------------------------------------------------------
def lab(h):
    if not h:
        return np.array([50.0, 0, 0])
    c = np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    x = M @ c / np.array([0.95047, 1.0, 1.08883])
    f = np.where(x > 0.008856, np.cbrt(x), 7.787 * x + 16 / 116)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])


def appearance(a, b):
    """0..1 shared look (skin, hair colour and style, eyes, facial hair, brows) and the parts that match."""
    def dE(k, d=None):
        return float(np.linalg.norm(lab(a.get(k, d)) - lab(b.get(k, d))))
    parts = dict(skin=np.exp(-dE("skin") / 8.0), hair_colour=np.exp(-dE("hairColor", "2e2119") / 12.0),
                 hair_style=1.0 if a.get("hair") == b.get("hair") else 0.0, eyes=np.exp(-dE("eyes", "5a4030") / 12.0),
                 facial_hair=1.0 - min(1.0, abs(a.get("stubble", 0) - b.get("stubble", 0)) + abs(a.get("beard", 0) - b.get("beard", 0))),
                 brows=1.0 - min(1.0, abs(a.get("browThick", 0.5) - b.get("browThick", 0.5)) * 2))
    w = dict(skin=0.3, hair_colour=0.15, hair_style=0.2, eyes=0.1, facial_hair=0.15, brows=0.1)
    return float(sum(parts[k] * w[k] for k in w)), {k: round(float(v), 2) for k, v in parts.items()}


# ---------------------------------------------------------------------------------------------------------------
# reference population
# ---------------------------------------------------------------------------------------------------------------
def mh_age(years):
    if years <= 11:
        return max(0.0, (years - 1) / 10 * 0.1875)
    if years <= 25:
        return 0.1875 + (years - 11) / 14 * 0.3125
    return min(1.0, 0.5 + (years - 25) / 65 * 0.5)


def face_modifiers():
    out = []
    for g in ("head", "forehead", "eyebrows", "eyes", "nose", "mouth", "cheek", "chin"):
        for k in mh.list_modifiers(g):
            if "head-age" in k or "head-fat" in k or "trans-" in k and g == "head":
                continue
            out.append(k)
    return out


def population(n, seed=1):
    rng = np.random.default_rng(seed)
    mods = face_modifiers()
    shapes = [k for k in mods if k.split("/")[1] in ("head-oval", "head-round", "head-rectangular", "head-square", "head-triangular", "head-invertedtriangular", "head-diamond")]
    pairs = {}
    for k in mods:       # left / right modifiers move together (symmetric faces), like cast_humans.sym
        base = k.replace("/l-", "/X-").replace("/r-", "/X-")
        pairs.setdefault(base, []).append(k)
    groups = [v for v in pairs.values() if not any(x in shapes for x in v)]
    pop = []
    for i in range(n):
        kid = rng.random() < 0.15
        g = float(rng.random() < 0.5)
        years = rng.uniform(5, 12) if kid else rng.uniform(19, 70)
        a = rng.dirichlet([0.6, 0.6, 0.6])
        macro = dict(gender=(0.85 if g else 0.15) if kid else g, age=mh_age(years), muscle=rng.uniform(0.3, 0.75), weight=rng.uniform(0.3, 0.7),
                     caucasian=a[0], african=a[1], asian=a[2], proportions=0.62 if kid else 0.72, height=0.5)
        det = {}
        if rng.random() < 0.8:
            det[shapes[rng.integers(len(shapes))]] = float(rng.uniform(0.1, 0.6))
        for grp in groups:
            if rng.random() < 0.45:
                v = float(np.clip(rng.normal(0, 0.35), -0.9, 0.9))
                for k in grp:
                    det[k] = v
        pop.append(dict(id=f"pop{i}", group="kid" if kid else ("m" if g else "f"), years=years, macro=macro, details=det))
    return pop


# ---------------------------------------------------------------------------------------------------------------
def group_of(c):
    if c["years"] < 14:
        return "kid"
    return "m" if c["macro"]["gender"] >= 0.5 else "f"


def landmark_plot(FS, out):
    from PIL import Image, ImageDraw
    P = FS.P0 * 1000
    im = Image.new("RGB", (900, 560), (250, 250, 250))
    dr = ImageDraw.Draw(im)
    cy = P[FS.L["N"], 1]
    cols = {r: c for r, c in zip(FS.regions, [(200, 60, 60), (60, 160, 60), (60, 60, 200), (200, 140, 30), (140, 60, 180), (30, 160, 170), (120, 120, 120), (220, 90, 160)])}
    for k, i in enumerate(FS.face):
        x, y, z = P[i]
        col = cols[FS.region[k]]
        dr.point((225 + x * 2.6, 200 - (y - cy) * 2.6), fill=col)
        dr.point((675 + (z - 110) * 2.6, 200 - (y - cy) * 2.6), fill=col)
    for n, i in FS.L.items():
        x, y, z = P[i]
        for X, Y in ((225 + x * 2.6, 200 - (y - cy) * 2.6), (675 + (z - 110) * 2.6, 200 - (y - cy) * 2.6)):
            dr.ellipse((X - 3, Y - 3, X + 3, Y + 3), outline=(0, 0, 0))
            dr.text((X + 4, Y - 6), n, fill=(0, 0, 0))
    y0 = 10
    for r, c in cols.items():
        dr.text((10, y0), r, fill=c)
        y0 += 12
    im.save(out)


def main(argv):
    global FEATS
    out = argv[0]
    os.makedirs(out, exist_ok=True)
    def flag(n, d=None):
        return next((a.split("=", 1)[1] for a in argv if a.startswith("--" + n + "=")), d)
    FS = FaceSpace()
    if "--landmarks" in argv:
        landmark_plot(FS, os.path.join(out, "landmarks.png"))
        print("landmarks ->", os.path.join(out, "landmarks.png"), len(FS.face), "face vertices")
        return
    import cast_nrzero as C
    cast = [c for c in C.CAST if not flag("ids") or c["id"] in flag("ids").split(",")]
    print(len(cast), "characters, faces from", C.FACES_DIR, "overrides:", sorted(C.FACES_APPLIED), flush=True)

    def sculpt(macro, details, shape=None):
        return mh.sculpt(macro, details, shape=shape)

    # --- reference population
    pop = population(int(flag("pop", 400)))
    PX, PF = [], []
    for q in pop:
        P = sculpt(q["macro"], q["details"])
        PX.append(FS.norm(P))
        PF.append(FS.features(P))
    FEATS = list(PF[0])
    PFm = np.array([[f[k] for k in FEATS] for f in PF])
    mu, sd = PFm.mean(0), PFm.std(0) + 1e-9
    pg = np.array([q["group"] for q in pop])
    PXa = np.array(PX)
    pz = (PFm - mu) / sd
    ref = {}
    for g in ("m", "f", "kid"):
        ix = np.where(pg == g)[0]
        geo, lm = [], []
        for i, j in itertools.combinations(ix, 2):
            geo.append(FS.rms(PXa[i] - PXa[j]))
            lm.append(np.sqrt(((pz[i] - pz[j]) ** 2).mean()))
        ref[g] = dict(geo=np.sort(geo), lm=np.sort(lm))
    allgeo = np.sort(np.concatenate([ref[g]["geo"] for g in ref]))
    alllm = np.sort(np.concatenate([ref[g]["lm"] for g in ref]))
    def pct(arr, v):
        return float(100.0 * np.searchsorted(arr, v) / len(arr))
    pop_det = []
    for q in pop[:60]:
        P0 = sculpt(q["macro"], {})
        pop_det.append(FS.rms(FS.norm(sculpt(q["macro"], q["details"])) - FS.norm(P0)))

    # --- the cast
    X, X0, Fz, info = {}, {}, {}, {}
    for c in cast:
        P = sculpt(c["macro"], c.get("details"), mh.shape_of(c))      # fix round 4: with the face file's dense shape layer
        X[c["id"]] = FS.norm(P)
        f = FS.features(P)
        Fz[c["id"]] = (np.array([f[k] for k in FEATS]) - mu) / sd
        X0[c["id"]] = FS.norm(sculpt(c["macro"], {}))       # the macro-only face (sex, age, build, ancestry)
        det = FS.rms(X[c["id"]] - X0[c["id"]])
        info[c["id"]] = dict(group=group_of(c), years=c["years"], role=c.get("role", ""), detail_energy_mm=round(det, 2),
                             details=c.get("details", {}), ancestry=[round(c["macro"][k], 2) for k in ("caucasian", "african", "asian")],
                             features={k: round(float(v), 2) for k, v in zip(FEATS, Fz[c["id"]])},
                             canon={k: round(float(v), 2) for k, v in FS.canon(P).items()},
                             canon_fail=canon_check(FS.canon(P), group_of(c), c["macro"]),
                             look=dict(skin=c.get("skin"), hair=c.get("hair"), hairColor=c.get("hairColor"), eyes=c.get("eyes"),
                                       stubble=c.get("stubble", 0), beard=c.get("beard", 0)))
    ids = [c["id"] for c in cast]
    spec = {c["id"]: c for c in cast}
    pairs = []
    for a, b in itertools.combinations(ids, 2):
        ga, gb = info[a]["group"], info[b]["group"]
        geo = FS.rms(X[a] - X[b])
        reg = {r: round(FS.rms(X[a] - X[b], FS.region == r), 2) for r in FS.regions}
        lm = float(np.sqrt(((Fz[a] - Fz[b]) ** 2).mean()))
        R = ref[ga] if ga == gb else dict(geo=allgeo, lm=alllm)
        pg_, pl_ = pct(R["geo"], geo), pct(R["lm"], lm)
        app, parts = appearance(spec[a], spec[b])
        close_feats = [k for k, x, y in zip(FEATS, Fz[a], Fz[b]) if abs(x - y) < 0.25]
        p5 = float(np.percentile(R["geo"], 5))
        gm = FS.rms(X0[a] - X0[b])
        ag = float(np.abs(np.array(info[a]["ancestry"]) - np.array(info[b]["ancestry"])).sum() / 2)
        why = []
        if ga == gb and ag < 0.2:
            why.append(f"same sex and near-identical ancestry mix (gap {ag:.2f})")
        if ga == gb and abs(info[a]["years"] - info[b]["years"]) < 12:
            why.append("same age band")
        ea, eb, pm = info[a]["detail_energy_mm"], info[b]["detail_energy_mm"], 2.7
        if max(ea, eb) < 1.0:
            why.append(f"weak face details ({ea} / {eb} mm against ~{pm} mm for a random face)")
        if geo < 1.15 * gm + 0.2:
            why.append(f"the details barely separate them (macro-only {gm:.2f} mm -> {geo:.2f} mm)")
        shared = [k for k, v in parts.items() if v > 0.7]
        if shared:
            why.append("shared " + ", ".join(shared))
        pairs.append(dict(a=a, b=b, same_group=ga == gb, group=ga if ga == gb else ga + "/" + gb, geo_mm=round(geo, 2), lm=round(lm, 3),
                          pct_geo=round(pg_, 1), pct_lm=round(pl_, 1), sim=round((pg_ + pl_) / 2, 1), app=round(app, 2), app_parts=parts,
                          regions_mm=reg, close_features=close_feats, same_person=(a, b) in SAME_PERSON or (b, a) in SAME_PERSON,
                          ancestry_gap=round(ag, 2), geo_macro_mm=round(gm, 2), geo_rel_p5=round(geo / p5, 2), why=why))

    # --- same person at another age: the details on the other body (identity, not age)
    def aged(src, dst):
        if src not in spec or dst not in spec:
            return None
        m = dict(spec[dst]["macro"])
        for k in ("caucasian", "african", "asian"):
            m[k] = spec[src]["macro"][k]
        det = dict(spec[src].get("details", {}))
        for k, v in spec[dst].get("details", {}).items():
            if "age" in k:
                det[k] = v
        sh = mh.shape_of(spec[src])       # the source's dense shape layer goes with its details (identity)
        Pa = FS.norm(sculpt(m, det, sh))
        geo = FS.rms(Pa - X[dst])
        g = info[dst]["group"]
        fa = FS.features(sculpt(m, det, sh))
        lm = float(np.sqrt(((((np.array([fa[k] for k in FEATS]) - mu) / sd) - Fz[dst]) ** 2).mean()))
        return dict(src=src, dst=dst, geo_mm=round(geo, 2), lm=round(lm, 3), sim=round((pct(ref[g]["geo"], geo) + pct(ref[g]["lm"], lm)) / 2, 1))
    identity = [x for x in (aged("kai", "witness"), aged("kai", "kid_kai"), aged("mira", "kid_mira"), aged("oskar", "oskar26")) if x]

    # --- verdicts
    T = THRESH

    def verdict(p):
        if p["same_person"]:
            return "same person (allowed)"
        if not p["same_group"]:      # a man and a woman (or an adult and a child) read apart unless the meshes nearly coincide
            return "SAME FACE" if p["geo_rel_p5"] < 0.5 else ""
        if p["sim"] < T["same"] and p["pct_geo"] < 2 * T["same"] and p["pct_lm"] < 2 * T["same"]:
            return "SAME FACE"
        if p["sim"] < T["alike"]:
            return "look-alike"
        return ""
    for p in pairs:
        p["verdict"] = verdict(p)
    def crowd(i):
        return i.startswith(CROWD_PREFIX)
    fails = []
    for p in pairs:
        if p["same_person"] or not p["same_group"]:
            continue
        need = T["min_crowd"] if crowd(p["a"]) and crowd(p["b"]) else T["min_pair"]
        if "kai" in (p["a"], p["b"]):
            need = max(need, T["min_vs_kai"]) if "mira" not in (p["a"], p["b"]) else need
        if p["sim"] < need:
            fails.append(dict(a=p["a"], b=p["b"], sim=p["sim"], need=need, rule="pair distance"))
        if p["app"] >= T["app_max"]:
            fails.append(dict(a=p["a"], b=p["b"], sim=p["app"], need=T["app_max"], rule="shared look (app) too high"))
    for p in pairs:      # no "same face" / "look-alike" verdict between different people, across groups too
        if not p["same_group"] and not p["same_person"] and p["verdict"]:
            fails.append(dict(a=p["a"], b=p["b"], sim=p["sim"], need=T["alike"], rule="cross-group " + p["verdict"]))
    for x in identity:   # the same person at another age stays recognisable
        if x["sim"] > T["witness_max"]:
            fails.append(dict(a=x["src"], b=x["dst"], sim=x["sim"], need=T["witness_max"], rule="same person must stay alike (<=)"))
    km = next((p for p in pairs if {p["a"], p["b"]} == {"kai", "mira"}), None)
    if km and not T["mira_band"][0] <= km["sim"] <= T["mira_band"][1]:
        fails.append(dict(a="kai", b="mira", sim=km["sim"], need=T["mira_band"], rule="family band"))
    for i in ids:        # attractive proportions: principals and named NPCs at most one miss, crowds two
        nf, allow = len(info[i]["canon_fail"]), (2 if crowd(i) else 1)
        if nf > allow:
            fails.append(dict(a=i, b="-", sim=nf, need=allow, rule="CANON misses (<=)"))
    kai_rank = sorted([p for p in pairs if "kai" in (p["a"], p["b"])], key=lambda p: (p["sim"], p["geo_rel_p5"]))
    # clusters: connected components of the look-alike graph (same group, not the same person)
    adj = {i: set() for i in ids}
    for p in pairs:
        if p["same_group"] and not p["same_person"] and p["sim"] < T["alike"]:
            adj[p["a"]].add(p["b"])
            adj[p["b"]].add(p["a"])
    seen, clusters = set(), []
    for i in ids:
        if i in seen or not adj[i]:
            continue
        comp, st = set(), [i]
        while st:
            k = st.pop()
            if k in comp:
                continue
            comp.add(k)
            st += list(adj[k] - comp)
        seen |= comp
        inner = [p for p in pairs if p["a"] in comp and p["b"] in comp]
        clusters.append(dict(ids=sorted(comp), mean_sim=round(float(np.mean([p["sim"] for p in inner])), 1), min_sim=min(p["sim"] for p in inner)))
    clusters.sort(key=lambda c: (-len(c["ids"]), c["mean_sim"]))

    # tight clusters: complete linkage on geo / P5 within each group (every pair in a cluster is under the cut), the
    # same person at two ages kept out: groups of people who share one face
    G = {(p["a"], p["b"]): p for p in pairs}
    G.update({(p["b"], p["a"]): p for p in pairs})
    tight = []
    for grp in ("m", "f", "kid"):
        cl = [[i] for i in ids if info[i]["group"] == grp]

        def link(x, y):
            v = [G[(i, j)] for i in x for j in y]
            return 9.0 if any(p["same_person"] for p in v) else max(p["geo_rel_p5"] for p in v)
        while len(cl) > 1:
            best = min(((link(x, y), a, b) for a, x in enumerate(cl) for b, y in enumerate(cl) if a < b), default=None)
            if best is None or best[0] > 0.6:
                break
            _, a, b = best
            cl[a] = cl[a] + cl[b]
            del cl[b]
        for c in cl:
            if len(c) > 1:
                inner = [G[(i, j)] for i, j in itertools.combinations(c, 2)]
                tight.append(dict(ids=sorted(c), group=grp, mean_geo_mm=round(float(np.mean([p["geo_mm"] for p in inner])), 2),
                                  max_geo_rel_p5=max(p["geo_rel_p5"] for p in inner)))
    tight.sort(key=lambda c: (-len(c["ids"]), c["mean_geo_mm"]))

    res = dict(thresholds=T, faces_dir=C.FACES_DIR, overrides=sorted(C.FACES_APPLIED), features=FEATS, face_vertices=int(len(FS.face)),
               regions=FS.regions, population=dict(n=len(pop), geo_pct={g: [round(float(np.percentile(ref[g]["geo"], q)), 2) for q in (5, 10, 25, 50)] for g in ref},
                                                    lm_pct={g: [round(float(np.percentile(ref[g]["lm"], q)), 3) for q in (5, 10, 25, 50)] for g in ref},
                                                    detail_energy_median_mm=round(float(np.median(pop_det)), 2)),
               canon=CANON, characters=info, pairs=pairs, identity=identity, fails=fails, clusters=clusters, tight_clusters=tight)
    json.dump(res, open(os.path.join(out, "faces.json"), "w"), indent=1)
    with open(os.path.join(out, "matrix_sim.csv"), "w") as f:
        S = {(p["a"], p["b"]): p["sim"] for p in pairs}
        f.write("id," + ",".join(ids) + "\n")
        for a in ids:
            f.write(a + "," + ",".join("" if a == b else str(S.get((a, b), S.get((b, a)))) for b in ids) + "\n")
    report(res, ids, os.path.join(out, "report.md"), kai_rank)
    try:
        heatmap(res, ids, os.path.join(out, "heatmap.png"))
    except ImportError:
        pass
    print("->", out, "| fails", len(fails), "| same-face pairs", sum(p["verdict"] == "SAME FACE" for p in pairs),
          "| look-alikes", sum(p["verdict"] == "look-alike" for p in pairs))


def report(res, ids, path, kai_rank):
    T, P = res["thresholds"], res["pairs"]
    L = [f"# Face distinctness ({len(ids)} builds, faces from {res['faces_dir']}, overrides: {', '.join(res['overrides']) or 'none'})", "",
         "sim = mean of the geo and landmark percentiles against random same-group strangers of the reference population "
         f"(n={res['population']['n']}); geo mm at the neutral face size. Population same-group geo percentiles 5/10/25/50: "
         + "; ".join(f"{g} {v}" for g, v in res["population"]["geo_pct"].items()) + ". Detail energy of a random population face (median): "
         f"{res['population']['detail_energy_median_mm']} mm.", "",
         f"Thresholds: same face < {T['same']}, look-alike < {T['alike']}; targets: pairs >= {T['min_pair']}, crowd-crowd >= {T['min_crowd']}, "
         f"vs Kai >= {T['min_vs_kai']}, Witness vs aged Kai <= {T['witness_max']}, Mira vs Kai in {T['mira_band']}.", ""]
    L += ["## Tight clusters (complete linkage, every pair under 0.6 x the population's P5 geo distance: one face several times)", ""]
    for c in res["tight_clusters"]:
        L.append(f"- {c['group']}, {len(c['ids'])}: {', '.join(c['ids'])} (mean geo {c['mean_geo_mm']} mm, worst pair {c['max_geo_rel_p5']} x P5)")
    sf = sorted([p for p in P if p["verdict"] == "SAME FACE"], key=lambda p: p["geo_rel_p5"])
    L += ["", f"## Pairs that read as the same face ({len(sf)}; the 60 closest, geo / population P5 ascending)", "",
          "| a | b | group | geo/P5 | geo mm | macro-only mm | lm pct | app | closest regions | why |", "|---|---|---|---|---|---|---|---|---|---|"]
    for p in sf[:60]:
        reg = ", ".join(f"{k} {v}" for k, v in sorted(p["regions_mm"].items(), key=lambda kv: kv[1])[:3])
        L.append(f"| {p['a']} | {p['b']} | {p['group']} | {p['geo_rel_p5']} | {p['geo_mm']} | {p['geo_macro_mm']} | {p['pct_lm']} | {p['app']} | {reg} | {'; '.join(p['why'])} |")
    L += ["", "## Look-alikes", "", "| a | b | group | sim | geo mm | app |", "|---|---|---|---|---|---|"]
    for p in sorted([p for p in P if p["verdict"] == "look-alike"], key=lambda p: p["sim"]):
        L.append(f"| {p['a']} | {p['b']} | {p['group']} | {p['sim']} | {p['geo_mm']} | {p['app']} |")
    L += ["", "## Against Kai (most alike first)", "", "| other | group | sim | geo/P5 | geo mm | macro-only mm | lm pct | app | verdict | why |", "|---|---|---|---|---|---|---|---|---|---|"]
    for p in sorted(kai_rank, key=lambda p: (p["sim"], p["geo_rel_p5"]))[:32]:
        o = p["b"] if p["a"] == "kai" else p["a"]
        L.append(f"| {o} | {p['group']} | {p['sim']} | {p['geo_rel_p5']} | {p['geo_mm']} | {p['geo_macro_mm']} | {p['pct_lm']} | {p['app']} | {p['verdict']} | {'; '.join(p['why'])} |")
    L += ["", "## Same person at another age (the first one's details on the second one's body)", ""]
    for x in res["identity"]:
        L.append(f"- {x['src']} -> {x['dst']}: geo {x['geo_mm']} mm, lm {x['lm']}, sim {x['sim']}")
    L += ["", "## Clusters (connected look-alikes, same group)", ""]
    for c in res["clusters"]:
        L.append(f"- {len(c['ids'])}: {', '.join(c['ids'])} (mean sim {c['mean_sim']}, min {c['min_sim']})")
    L += ["", f"## Target failures ({len(res['fails'])})", ""]
    for f in sorted(res["fails"], key=lambda f: (f["rule"], str(f["sim"]))):
        L.append(f"- {f['a']} / {f['b']}: {f['rule']}: {f['sim']} (target {f['need']})")
    L += ["", "## Attractive proportions (face_metric.CANON; adults; value [target])", ""]
    for i in ids:
        cf = res["characters"][i]["canon_fail"]
        if cf:
            L.append(f"- {i}: " + "; ".join(f"{k} {v} [{lo}, {hi}]" for k, v, lo, hi in cf))
    from collections import Counter
    cnt = Counter(k for i in ids for k, *_ in res["characters"][i]["canon_fail"])
    adults = sum(1 for i in ids if res["characters"][i]["group"] != "kid")
    L += ["", "Out of range, of " + str(adults) + " adults: " + ", ".join(f"{k} {n}" for k, n in cnt.most_common())]
    L += ["", "## Per character", "", "| id | group | age | detail energy mm | details | ancestry c/a/as | nearest (sim) |", "|---|---|---|---|---|---|---|"]
    for i in ids:
        c = res["characters"][i]
        nb = sorted([p for p in P if i in (p["a"], p["b"]) and p["same_group"]], key=lambda p: p["sim"])[:2]
        nn = ", ".join(f"{p['b'] if p['a'] == i else p['a']} ({p['sim']})" for p in nb)
        L.append(f"| {i} | {c['group']} | {c['years']} | {c['detail_energy_mm']} | {len(c['details'])} | {'/'.join(str(x) for x in c['ancestry'])} | {nn} |")
    open(path, "w").write("\n".join(L) + "\n")


def heatmap(res, ids, path):
    from PIL import Image, ImageDraw
    n, cell, pad = len(ids), 12, 90
    im = Image.new("RGB", (pad + n * cell, pad + n * cell), (255, 255, 255))
    dr = ImageDraw.Draw(im)
    S = {}
    for p in res["pairs"]:
        S[(p["a"], p["b"])] = S[(p["b"], p["a"])] = p
    for i, a in enumerate(ids):
        dr.text((2, pad + i * cell), a[:14], fill=(0, 0, 0))
        tx = Image.new("RGB", (pad, cell), (255, 255, 255))
        ImageDraw.Draw(tx).text((2, 0), a[:14], fill=(0, 0, 0))
        im.paste(tx.rotate(90, expand=True), (pad + i * cell, 0))
        for j, b in enumerate(ids):
            if a == b:
                col = (40, 40, 40)
            else:
                p = S[(a, b)]
                s = p["sim"] / 100.0
                col = (255, int(255 * min(1, s * 2.2)), int(255 * min(1, s * 2.2))) if p["same_group"] else (235, 235, 245)
                if p["same_person"]:
                    col = (120, 160, 255)
            dr.rectangle((pad + j * cell, pad + i * cell, pad + j * cell + cell - 1, pad + i * cell + cell - 1), fill=col)
    im.save(path)


if __name__ == "__main__":
    main(sys.argv[1:])
