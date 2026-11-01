#!/usr/bin/env bash
# Cut out with AI (tickets 0767, 0769, ADR 0087): make the model files the app serves, into public/ai/, and write their
# list to src/data/cutOutFiles.json.  bash scripts/cut-out-model/prepare.sh [isnet-general-use-uint8.onnx]
# Given an exported IS-Net (spike 0763's .work/isnet/ holds one), it only splits it. Otherwise it needs python3 (3.9+)
# and network once: a venv with torch and the upstream weights go to scripts/cut-out-model/.work/ (gitignored, 1.5 GB).
# The tap model, SlimSAM-77, is fetched once into .work/slimsam/ at a pinned revision and checked.
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
here="$root/scripts/cut-out-model"
work="$here/.work"
DIS_COMMIT=b6764e20381f6f42a70f83fa3324181529ed1403
WEIGHTS_DRIVE_ID=1XHIzgTzY5BQHw140EDIgwIb53K659ENH # isnet-general-use.pth, linked from DIS's README
WEIGHTS_SHA256=9e1aafea58f0b55d0c35077e0ceade6ba1ba2bce372fd4f8f77215391f3fac13
SLIMSAM_REV=5850ab45f587c112167512ffef949107115e26a0 # Xenova/slimsam-77-uniform, Apache-2.0
SLIMSAM_ENCODER_SHA256=cce23c7b2e5d4f330932738fb67ba518e04b0d99ccdd1cccd22a7da4e01f2971
SLIMSAM_DECODER_SHA256=cb90b279f549d2cab7fd6e20c38522438c65d84bdcca3d2a764cff7d857fdce2

model=${1:-}
[ -z "$model" ] || model="$(cd "$(dirname "$model")" && pwd)/$(basename "$model")"
if [ -z "$model" ]; then
  mkdir -p "$work"
  [ -x "$work/venv/bin/python" ] || python3 -m venv "$work/venv"
  "$work/venv/bin/pip" install -q torch==2.8.0 onnx==1.19.1 onnxruntime==1.19.2 gdown numpy
  cd "$work"
  [ -f isnet.py ] || curl -fsSL -o isnet.py "https://raw.githubusercontent.com/xuebinqin/DIS/$DIS_COMMIT/IS-Net/models/isnet.py"
  [ -f isnet-general-use.pth ] || "$work/venv/bin/gdown" -q "$WEIGHTS_DRIVE_ID" -O isnet-general-use.pth
  echo "$WEIGHTS_SHA256  isnet-general-use.pth" | shasum -a 256 -c -
  [ -f isnet-general-use-uint8.onnx ] || "$work/venv/bin/python" "$here/export_isnet.py" isnet.py isnet-general-use.pth .
  model="$work/isnet-general-use-uint8.onnx"
fi

mkdir -p "$work/slimsam"
cd "$work/slimsam"
for f in vision_encoder_quantized.onnx prompt_encoder_mask_decoder_quantized.onnx; do
  [ -f "$f" ] || curl -fsSL -o "$f" "https://huggingface.co/Xenova/slimsam-77-uniform/resolve/$SLIMSAM_REV/onnx/$f"
done
printf '%s  %s\n' "$SLIMSAM_ENCODER_SHA256" vision_encoder_quantized.onnx "$SLIMSAM_DECODER_SHA256" prompt_encoder_mask_decoder_quantized.onnx | shasum -a 256 -c -

cd "$root"
node "$here/pack.mjs" "$model" "$work/slimsam/vision_encoder_quantized.onnx" "$work/slimsam/prompt_encoder_mask_decoder_quantized.onnx"
