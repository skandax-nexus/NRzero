"""AFTERZERO voice build: perform every spoken line with a neural voice per character.

  python3 tools/voice/build_voices.py PIPER_DIR VOICES_JSON [--only m1,m2] [--limit N]

- Lines are extracted from src/missions/*.js: ui.say / game.say / ui.subtitle / ui.choice calls and ui.talk([...]) pairs.
- Voices: the LibriTTS multi-speaker Piper model (904 speakers, CC BY 4.0). VOICES_JSON is the pitch/pace catalogue made
  by catalog.py; each character gets a distinct speaker in its pitch band (CHARACTERS below), extras get a stable one.
- Treatment per character with ffmpeg (phone/PA radio band, the Voice's cathedral echo, the child's raised pitch),
  loudness normalised, encoded as AAC (.m4a, mono) for every phone browser.
- Output: assets/voice/<key>.m4a + assets/voice/manifest.json { lines: {key: file}, speakers: {id: speaker} }.
  key = FNV-1a("speaker|text") in base 36, the same as Voice.lineKey() in src/core/voice.js. Existing files are kept.
"""
import json, os, re, subprocess, sys, tempfile, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PIPER, CATALOG = sys.argv[1], sys.argv[2]
ONLY = None
LIMIT = None
for i, a in enumerate(sys.argv):
    if a == '--only': ONLY = set(sys.argv[i + 1].split(','))
    if a == '--limit': LIMIT = int(sys.argv[i + 1])
OUT = os.path.join(ROOT, 'assets', 'voice')
MODEL = os.path.join(PIPER, 'libritts', 'en-us-libritts-high.onnx')

# id: (sex, f0 band Hz, pace (length scale), treatment, voice of another character)
CHARACTERS = {
    'kai': ('m', (104, 122), 1.0, None, None),
    'witness': ('m', (88, 102), 1.1, 'aged', None),
    'voice': ('m', (88, 102), 1.15, 'cathedral', 'witness'),
    'rook': ('m', (112, 132), 1.06, None, None),
    'phone': ('m', (112, 132), 1.06, 'radio', 'rook'),
    'mira': ('f', (190, 218), 1.0, None, None),
    'sera': ('f', (165, 186), 0.96, None, None),
    'niko': ('m', (128, 150), 0.98, None, None),
    'tala': ('f', (172, 192), 1.04, None, None),
    'iven': ('m', (118, 136), 1.0, None, None),
    'jun': ('m', (120, 142), 1.02, None, None),
    'hale': ('m', (92, 108), 1.04, None, None),
    'brandt': ('m', (108, 124), 0.98, None, None),
    'child': ('f', (225, 290), 0.95, 'child', None),
    'speaker': ('f', (180, 210), 1.05, 'pa', None),
}
FILTERS = {
    None: '',
    'radio': 'highpass=f=320,lowpass=f=3200,acompressor=threshold=-20dB:ratio=4,',
    'pa': 'highpass=f=250,lowpass=f=4200,aecho=0.8:0.6:120|260:0.35|0.22,',
    'cathedral': 'asetrate=22050*0.94,aresample=22050,atempo=1.0638,aecho=0.8:0.85:180|420|760:0.45|0.32|0.2,lowpass=f=6000,',
    'aged': 'asetrate=22050*0.97,aresample=22050,atempo=1.031,',
    'child': 'asetrate=22050*1.14,aresample=22050,atempo=0.877,',
}

# ---------------------------------------------------------------- extraction
STR = r"('(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\"|`(?:[^`\\$]|\\.)*`)"
CALL = re.compile(r"\b(say|subtitle|choice)\(\s*(null|'[\w:-]+'|\"[\w:-]+\")\s*,\s*" + STR)
PAIR = re.compile(r"\[\s*'([\w:-]+)'\s*,\s*" + STR + r"\s*[,\]]")


def unjs(lit):
    q, body = lit[0], lit[1:-1]
    out, i = [], 0
    while i < len(body):
        c = body[i]
        if c == '\\' and i + 1 < len(body):
            n = body[i + 1]
            if n == 'n': out.append('\n'); i += 2; continue
            if n == 'u' and i + 5 < len(body):
                out.append(chr(int(body[i + 2:i + 6], 16))); i += 6; continue
            out.append(n); i += 2; continue
        out.append(c); i += 1
    return ''.join(out)


def speakers_known():
    ids = {'voice', 'speaker', 'phone', 'child', 'echo', 'recording'}
    src = open(os.path.join(ROOT, 'src', 'story', 'cast.js'), encoding='utf-8').read()
    ids |= set(re.findall(r"^  (\w+): \{", src, re.M))
    for d in ('missions', 'world', 'systems'):
        mdir = os.path.join(ROOT, 'src', d)
        if not os.path.isdir(mdir):
            continue
        for f in os.listdir(mdir):
            if f.endswith('.js'):
                ids |= set(re.findall(r"registerCast\(\s*'(\w+)'", open(os.path.join(mdir, f), encoding='utf-8').read()))
    return ids


def extract():
    known = speakers_known()
    lines = {}
    mdir = os.path.join(ROOT, 'src', 'missions')
    for f in sorted(os.listdir(mdir)):
        if not f.endswith('.js'):
            continue
        tag = 'm' + re.sub(r'^m0?(\d+).*', r'\1', f)
        if ONLY and tag not in ONLY:
            continue
        src = open(os.path.join(mdir, f), encoding='utf-8').read()
        for m in CALL.finditer(src):
            kind, who, lit = m.group(1), m.group(2).strip('\'"'), m.group(3)
            text = unjs(lit)
            if '${' in lit or not text.strip():
                continue
            if who == 'null':
                if kind != 'subtitle':
                    continue
                who, text = 'crowd:' + str(len(text)), re.sub(r'^"|"$', '', text)
            if who.startswith('crowd:') or who in known:
                lines[(who, text.strip())] = tag
        for m in re.finditer(r"\b(say|subtitle)\(\s*'([\w:-]+)'\s*,\s*\[([^\]]*)\]", src):  # say(id, ['a', 'b'][i])
            if m.group(2) in known:
                for lit in re.findall(STR, m.group(3)):
                    if '${' not in lit and len(unjs(lit)) > 1:
                        lines[(m.group(2), unjs(lit).strip())] = tag
        for m in PAIR.finditer(src):
            who, lit = m.group(1), m.group(2)
            text = unjs(lit)
            if '${' in lit or len(text) < 2 or who not in known:
                continue
            lines[(who, text.strip())] = tag
    return lines


def fnv36(s):
    h = 2166136261
    for unit in [int.from_bytes(s.encode('utf-16-le')[i:i + 2], 'little') for i in range(0, len(s.encode('utf-16-le')), 2)]:
        h ^= unit
        h = (h * 16777619) & 0xFFFFFFFF
    digits, n = '0123456789abcdefghijklmnopqrstuvwxyz', h
    out = ''
    while True:
        out = digits[n % 36] + out
        n //= 36
        if n == 0:
            return out


# ---------------------------------------------------------------- voice casting
def cast_voices(catalog, speakers_needed, cast_sex):
    cat = {int(k): v for k, v in catalog.items() if v['f0'] > 0}
    taken, chosen = set(), {}
    order = [k for k in CHARACTERS if CHARACTERS[k][4] is None] + [k for k in CHARACTERS if CHARACTERS[k][4]]
    for cid in order:
        sex, band, pace, fx, alias = CHARACTERS[cid]
        if alias:
            chosen[cid] = chosen[alias]
            continue
        mid = (band[0] + band[1]) / 2
        # clearest voices first: middle of the band, natural pace (shorter duration reads as more fluent)
        cands = sorted((sp for sp, v in cat.items() if band[0] <= v['f0'] <= band[1] and sp not in taken), key=lambda sp: abs(cat[sp]['f0'] - mid) * 0.04 + cat[sp]['dur'])
        sp = cands[0] if cands else min(cat, key=lambda s: abs(cat[s]['f0'] - mid))
        taken.add(sp)
        chosen[cid] = sp
    male = sorted((sp for sp, v in cat.items() if 95 <= v['f0'] <= 145 and sp not in taken))
    female = sorted((sp for sp, v in cat.items() if 170 <= v['f0'] <= 235 and sp not in taken))
    for who in speakers_needed:
        if who in chosen:
            continue
        h = int(hashlib.md5(who.encode()).hexdigest(), 16)
        fem = cast_sex.get(who.split(':')[0])
        if fem is None:
            fem = h % 2 == 1
        pool = female if fem else male
        chosen[who] = pool[h % len(pool)]
    return chosen


def cast_sexes():
    """female flags of CAST looks and registerCast() looks in the mission files"""
    out = {}
    paths = [os.path.join(ROOT, 'src', 'story', 'cast.js')]
    for d in ('missions', 'world', 'systems'):
        if os.path.isdir(os.path.join(ROOT, 'src', d)):
            paths += [os.path.join(ROOT, 'src', d, f) for f in os.listdir(os.path.join(ROOT, 'src', d)) if f.endswith('.js')]
    for path in paths:
        src = open(path, encoding='utf-8').read()
        for m in re.finditer(r"(?:^|[\s{,])'?(\w+)'?\s*[:,]\s*\{[^{}]*?look:\s*\{([^{}]*)\}", src):
            out[m.group(1)] = 'female: true' in m.group(2) or "sex: 1" in m.group(2)
        for m in re.finditer(r"registerCast\(\s*'(\w+)'\s*,\s*\{(.*?)\}\s*\)", src, re.S):
            out[m.group(1)] = 'female: true' in m.group(2) or "sex: 'f'" in m.group(2)
    return out


def clean_for_tts(t):
    t = t.replace('“', '').replace('”', '').replace('"', '')
    t = re.sub(r'\s+[—–-]\s+', ', ', t).replace('...', '. ').replace('…', '. ')
    t = re.sub(r'<[^>]+>', '', t)
    return t


def main():
    os.makedirs(OUT, exist_ok=True)
    catalog = json.load(open(CATALOG))
    lines = extract()
    keys = sorted(lines)
    if LIMIT:
        keys = keys[:LIMIT]
    voices = cast_voices(catalog, {w for w, _ in keys}, cast_sexes())
    man_path = os.path.join(OUT, 'manifest.json')
    manifest = json.load(open(man_path)) if os.path.exists(man_path) else {'lines': {}, 'speakers': {}}
    todo = []
    for who, text in keys:
        k = fnv36(who + '|' + text)
        f = k + '.m4a'
        if os.path.exists(os.path.join(OUT, f)):
            manifest['lines'][k] = f
            continue
        todo.append((who, text, k, f))
    print(len(keys), 'lines,', len(todo), 'to perform', flush=True)
    with tempfile.TemporaryDirectory() as td:
        # one piper process per speaker (json-input batches)
        by = {}
        for i, (who, text, k, f) in enumerate(todo):
            by.setdefault(voices[who], []).append((who, text, k, f, os.path.join(td, k + '.wav')))
        done = 0
        for sp, items in by.items():
            role = items[0][0]
            pace = CHARACTERS.get(role, ('m', (0, 0), 1.0, None, None))[2]
            payload = '\n'.join(json.dumps({'text': clean_for_tts(t), 'speaker_id': sp, 'output_file': w}) for _, t, _, _, w in items)
            subprocess.run([os.path.join(PIPER, 'piper', 'piper'), '-m', MODEL, '--json-input', '--length_scale', str(pace), '--sentence_silence', '0.18'],
                           input=payload.encode(), capture_output=True, check=True)
            for who, text, k, f, w in items:
                fx = FILTERS[CHARACTERS.get(who, (0, 0, 0, None, None))[3]]
                af = fx + 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-17:TP=-2:LRA=9,aresample=24000'
                subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', w, '-af', af, '-ac', '1', '-c:a', 'aac', '-b:a', '40k', os.path.join(OUT, f)], check=True)
                manifest['lines'][k] = f
                done += 1
            print('performed', done, '/', len(todo), flush=True)
    manifest['speakers'] = {k: v for k, v in voices.items() if not k.startswith('crowd:')}
    manifest['credit'] = 'Voices: Piper TTS, LibriTTS-high model (LibriTTS dataset, CC BY 4.0, openslr.org/60).'
    json.dump(manifest, open(man_path, 'w'), indent=0)
    print('manifest', len(manifest['lines']), 'lines')


if __name__ == '__main__':
    main()
