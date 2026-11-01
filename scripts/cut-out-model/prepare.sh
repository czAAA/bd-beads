#!/usr/bin/env bash
# Cut out with AI (ticket 0767, ADR 0087): make the model files the app serves, into public/ai/, and write their list to
# src/data/cutOutFiles.json.  bash scripts/cut-out-model/prepare.sh [isnet-general-use-uint8.onnx]
# Given an exported model (spike 0763's .work/isnet/ holds one), it only splits it. Otherwise it needs python3 (3.9+)
# and network once: a venv with torch and the upstream weights go to scripts/cut-out-model/.work/ (gitignored, 1.5 GB).
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
here="$root/scripts/cut-out-model"
work="$here/.work"
DIS_COMMIT=b6764e20381f6f42a70f83fa3324181529ed1403
WEIGHTS_DRIVE_ID=1XHIzgTzY5BQHw140EDIgwIb53K659ENH # isnet-general-use.pth, linked from DIS's README
WEIGHTS_SHA256=9e1aafea58f0b55d0c35077e0ceade6ba1ba2bce372fd4f8f77215391f3fac13

model=${1:-}
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

cd "$root"
node "$here/pack.mjs" "$model"
