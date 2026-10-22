#!/usr/bin/env bash
# AFTERZERO trailer sound: rebuild the score, sound design, voice-over, both mixes and the verification report.
#
#   tools/trailer/build_audio.sh            # everything (about 5 minutes of CPU at nice 10)
#   tools/trailer/build_audio.sh mix        # only remix + report from the stems already on disk
#
# Resumable: each stage writes its own files and is skipped when its outputs are newer than its inputs
# (FORCE=1 rebuilds everything). Outputs go to $TRAILER_AUDIO (default: the session scratchpad trailer/audio).
# Needs: ffmpeg, npm (sample fetch), the venv at /home/user/tools/trailer-venv (numpy scipy soundfile matplotlib),
# and Piper at /home/user/tools/piper only if a VO line has no recorded clip.
set -euo pipefail
cd "$(dirname "$0")/../.."
PY=${TRAILER_PY:-/home/user/tools/trailer-venv/bin/python}
if [ ! -x "$PY" ]; then
  python3 -m venv /home/user/tools/trailer-venv && /home/user/tools/trailer-venv/bin/pip install -q numpy scipy soundfile matplotlib
  PY=/home/user/tools/trailer-venv/bin/python
fi
OUT=${TRAILER_AUDIO:-/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad/trailer/audio}
export TRAILER_AUDIO=$OUT
mkdir -p "$OUT/stems" "$OUT/store" "$OUT/logs"
S=tools/trailer/sound
N="nice -n 10"

stale() {  # stale OUTPUT INPUT... : true when OUTPUT is missing or older than any input
  [ "${FORCE:-0}" = 1 ] && return 0
  local out=$1; shift
  [ -f "$out" ] || return 0
  for f in "$@"; do [ "$f" -nt "$out" ] && return 0; done
  return 1
}
step() { echo "== $1"; }

if [ "${1:-all}" != mix ]; then
  step "samples"; $S/fetch_samples.sh
  T=tools/trailer/trailer.json
  if stale "$OUT/stems/music.wav" $T $S/score.py $S/sampler.py $S/textures.py $S/dsp.py; then
    step "score"; $N $PY $S/score.py | tee "$OUT/logs/score.log"
  fi
  if stale "$OUT/store/music.wav" $T $S/score.py $S/sampler.py $S/textures.py $S/dsp.py; then
    step "score (store cut)"; $N $PY $S/score.py --store | tee "$OUT/logs/score_store.log"
  fi
  if stale "$OUT/stems/sfx.wav" $T $S/sfx.py $S/textures.py $S/dsp.py; then
    step "sound design"; $N $PY $S/sfx.py | tee "$OUT/logs/sfx.log"
  fi
  if stale "$OUT/store/sfx.wav" $T $S/sfx.py $S/textures.py $S/dsp.py; then
    step "sound design (store cut)"; $N $PY $S/sfx.py --store | tee "$OUT/logs/sfx_store.log"
  fi
  if stale "$OUT/stems/vo.wav" $T tools/trailer/vo.py assets/voice/manifest.json; then
    step "voice-over"; $N $PY tools/trailer/vo.py | tee "$OUT/logs/vo.log"
  fi
  if stale "$OUT/store/vo.wav" $T tools/trailer/vo.py; then
    step "voice-over (store cut)"; $N $PY tools/trailer/vo.py --store | tee "$OUT/logs/vo_store.log"
  fi
fi
if stale "$OUT/trailer_mix.wav" "$OUT/stems/music.wav" "$OUT/stems/sfx.wav" "$OUT/stems/vo.wav" $S/mix.py || [ "${1:-}" = mix ]; then
  step "mix"; (cd $S && $N $PY mix.py) | tee "$OUT/logs/mix.log"
fi
if stale "$OUT/store_mix.wav" "$OUT/store/music.wav" "$OUT/store/sfx.wav" "$OUT/store/vo.wav" $S/mix.py || [ "${1:-}" = mix ]; then
  step "mix (store cut)"; (cd $S && $N $PY mix.py --store) | tee "$OUT/logs/mix_store.log"
fi
step "report"; (cd $S && $N $PY analyze.py --report) > "$OUT/logs/report.log"
$PY - "$OUT/report.json" <<'EOF'
import json, sys
r = json.load(open(sys.argv[1]))
e, s = r['ebur128'], r.get('store', {}).get('ebur128', {})
print(f"trailer: I {e['I']} LUFS, TP {e['TP']} dBTP, LRA {e['LRA']} LU, clicks {len(r['clicks'])}, silences {r['silence_peak_dbfs']}")
if s:
    print(f"store:   I {s['I']} LUFS, TP {s['TP']} dBTP, LRA {s['LRA']} LU, clicks {len(r['store']['clicks'])}")
print('VO onset error (ms):', [o['error_ms'] for o in r['vo_onsets']])
EOF
echo "outputs in $OUT"
