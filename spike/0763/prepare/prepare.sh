#!/usr/bin/env bash
# Spike 0763: make the files the spike page serves, into public/spike-0763/ (gitignored, about 300 MB).
#   bash spike/0763/prepare/prepare.sh [photos dir]
# Needs python3 (3.9+), node and network once. Work files (a Python venv, the upstream weights) go to spike/0763/.work/.
set -euo pipefail
root=$(cd "$(dirname "$0")/../../.." && pwd)
here="$root/spike/0763/prepare"
work="$root/spike/0763/.work"
DIS_COMMIT=b6764e20381f6f42a70f83fa3324181529ed1403
WEIGHTS_DRIVE_ID=1XHIzgTzY5BQHw140EDIgwIb53K659ENH # isnet-general-use.pth, linked from DIS's README
WEIGHTS_SHA256=9e1aafea58f0b55d0c35077e0ceade6ba1ba2bce372fd4f8f77215391f3fac13
SLIMSAM_REV=5850ab45f587c112167512ffef949107115e26a0
mkdir -p "$work/isnet" "$work/slimsam"

[ -x "$work/venv/bin/python" ] || python3 -m venv "$work/venv"
"$work/venv/bin/pip" install -q torch==2.8.0 onnx==1.19.1 onnxruntime==1.19.2 gdown numpy

cd "$work/isnet"
[ -f isnet.py ] || curl -fsSL -o isnet.py "https://raw.githubusercontent.com/xuebinqin/DIS/$DIS_COMMIT/IS-Net/models/isnet.py"
[ -f isnet-general-use.pth ] || "$work/venv/bin/gdown" -q "$WEIGHTS_DRIVE_ID" -O isnet-general-use.pth
echo "$WEIGHTS_SHA256  isnet-general-use.pth" | shasum -a 256 -c -
[ -f isnet-general-use-uint8w.onnx ] || "$work/venv/bin/python" "$here/export_isnet.py" isnet.py isnet-general-use.pth .

cd "$work/slimsam"
for f in vision_encoder_quantized.onnx prompt_encoder_mask_decoder_quantized.onnx; do
  [ -f "$f" ] || curl -fsSL -o "$f" "https://huggingface.co/Xenova/slimsam-77-uniform/resolve/$SLIMSAM_REV/onnx/$f"
done

# Four kinds of photo from Wikimedia Commons (their licences in photos/SOURCES.txt), unless a folder of your own is given.
photos=${1:-$work/photos}
if [ -z "${1:-}" ]; then
  mkdir -p "$photos"
  : >"$photos/SOURCES.txt"
  while IFS='|' read -r name title; do
    [ -f "$photos/$name" ] || {
      info=$(curl -fsSL -A "bd-beads spike 0763" "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=2048&titles=$(node -p 'encodeURIComponent(process.argv[1])' "$title")")
      curl -fsSL -A "bd-beads spike 0763" -o "$photos/$name" "$(node -p 'Object.values(JSON.parse(process.argv[1]).query.pages)[0].imageinfo[0].thumburl' "$info")"
    }
    echo "$name: https://commons.wikimedia.org/wiki/$(echo "$title" | tr ' ' _)" >>"$photos/SOURCES.txt"
  done <<'LIST'
1-beadwork.jpg|File:Beading earrings.jpg
2-pet.jpg|File:Cat03.jpg
3-flower.jpg|File:Sunflower from Silesia2.jpg
4-busy.jpg|File:Times Square, New York City (HDR).jpg
LIST
fi

cd "$root"
node "$here/pack.mjs" "$work" public/spike-0763 "$photos"
