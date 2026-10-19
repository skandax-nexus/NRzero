"""Pack the recorded lines into a few chunk files for hosts that limit the number of files (web previews, stores).

  python3 tools/voice/pack_voices.py [OUT_DIR] [--chunk-kb 1200] [--src DIR]

Reads assets/voice/manifest.json (written by build_voices.py) and writes OUT_DIR/pack.json plus OUT_DIR/pack-<tag>-<n>.mp4.
Each chunk is a plain concatenation of the per-line AAC files of one mission (so a mission's opening lines arrive first);
pack.json maps every line key to [chunk index, byte offset, byte length]. Voice in src/core/voice.js falls back to the
pack when the per-line manifest is missing, fetches a mission's chunks on its first line and slices out each clip.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'assets', 'voice')
args = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith('--') and sys.argv[i - 1] not in ('--chunk-kb', '--src')]
OUT = args[0] if args else SRC
CHUNK = 1200 * 1024
for i, a in enumerate(sys.argv):
    if a == '--chunk-kb':
        CHUNK = int(sys.argv[i + 1]) * 1024
    if a == '--src':  # another set of the same clips (e.g. re-encoded for a test browser)
        SRC = sys.argv[i + 1]


def order(tag):
    n = tag[1:]
    return (0, int(n)) if n.isdigit() else (1, tag)


def main():
    man = json.load(open(os.path.join(SRC, 'manifest.json')))
    tags = man.get('tags', {})
    groups = {}
    for k, f in man['lines'].items():
        if os.path.exists(os.path.join(SRC, f)):
            groups.setdefault(tags.get(k, 'misc'), []).append((k, f))
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.startswith('pack-') and f.endswith(('.m4a', '.mp4')):
            os.remove(os.path.join(OUT, f))
    chunks, lines, total = [], {}, 0
    for tag in sorted(groups, key=order):
        buf, n = bytearray(), 0

        def flush():
            nonlocal buf, n
            if not buf:
                return
            name = f'pack-{tag}-{n}.mp4'  # .mp4: the same MPEG-4 audio container, served by more hosts than .m4a
            open(os.path.join(OUT, name), 'wb').write(buf)
            chunks.append({'file': name, 'tag': tag, 'size': len(buf)})
            buf, n = bytearray(), n + 1

        for k, f in groups[tag]:
            data = open(os.path.join(SRC, f), 'rb').read()
            if buf and len(buf) + len(data) > CHUNK:
                flush()
            lines[k] = [len(chunks), len(buf), len(data)]
            buf += data
            total += len(data)
        flush()
    first = next((open(os.path.join(SRC, f), 'rb').read(16) for g in groups.values() for _, f in g[:1]), b'')
    kind = 'audio/webm; codecs="opus"' if first[:4] == b'\x1a\x45\xdf\xa3' else 'audio/mp4; codecs="mp4a.40.2"'
    pack = {'type': kind, 'chunks': chunks, 'lines': lines, 'speakers': man.get('speakers', {}), 'credit': man.get('credit', '')}
    json.dump(pack, open(os.path.join(OUT, 'pack.json'), 'w'), separators=(',', ':'))
    print(f'packed {len(lines)} lines into {len(chunks)} chunks, {total / 1048576:.1f} MB')


main()
