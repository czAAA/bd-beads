"""Export IS-Net general-use to ONNX from the upstream weights and compress it (spike 0763).

    python export_isnet.py <isnet.py> <isnet-general-use.pth> <out dir>

Writes three models of the same network, input `input` [1,3,1024,1024] (RGB / 255 - 0.5, the picture stretched to
1024 x 1024 as upstream's Inference.py does) and output `mask` [1,1,1024,1024] (sigmoid, not yet min-max scaled):
- isnet-general-use-fp32.onnx      uncompressed, the reference for mask quality
- isnet-general-use-uint8.onnx     dynamic uint8 quantization (ConvInteger): smallest download and memory
- isnet-general-use-uint8w.onnx    uint8 weights dequantized at load (float Conv): same download, float speed
"""
import importlib.util
import sys
from pathlib import Path

import numpy as np
import onnx
import torch
from onnx import helper, numpy_helper
from onnxruntime.quantization import QuantType, quantize_dynamic
from onnxruntime.quantization.shape_inference import quant_pre_process

isnet_py, weights, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)

# Upstream's isnet.py imports torchvision for nothing it uses; load it without that line.
source = isnet_py.read_text().replace("from torchvision import models\n", "")
spec = importlib.util.spec_from_loader("isnet", loader=None)
isnet = importlib.util.module_from_spec(spec)
exec(source, isnet.__dict__)


class FirstSide(torch.nn.Module):
    """ISNetDIS returns six side outputs and their features; the mask is the first side output."""

    def __init__(self, net):
        super().__init__()
        self.net = net

    def forward(self, x):
        return self.net(x)[0][0]


net = isnet.ISNetDIS()
# weights_only: the .pth is a pickle, and this loads its tensors without running anything it holds.
net.load_state_dict(torch.load(weights, map_location="cpu", weights_only=True))
net.eval()

fp32 = out / "isnet-general-use-fp32.onnx"
with torch.no_grad():
    torch.onnx.export(
        FirstSide(net), torch.zeros(1, 3, 1024, 1024), str(fp32),
        input_names=["input"], output_names=["mask"], opset_version=17, do_constant_folding=True, dynamo=False,
    )
onnx.checker.check_model(str(fp32))

prepped = out / "isnet-prepped.onnx"
quant_pre_process(str(fp32), str(prepped), skip_symbolic_shape=True)
quantize_dynamic(str(prepped), str(out / "isnet-general-use-uint8.onnx"), weight_type=QuantType.QUInt8)
prepped.unlink()


def weights_only_uint8(src, dst):
    """Each float Conv weight stored as uint8 with a per-tensor scale, behind a DequantizeLinear the runtime folds at load."""
    model = onnx.load(str(src))
    graph = model.graph
    inits = {i.name: i for i in graph.initializer}
    conv_weights = {n.input[1] for n in graph.node if n.op_type == "Conv" and n.input[1] in inits}
    new_nodes = []
    for name in sorted(conv_weights):
        w = numpy_helper.to_array(inits[name]).astype(np.float32)
        lo, hi = min(float(w.min()), 0.0), max(float(w.max()), 0.0)
        scale = (hi - lo) / 255.0 or 1.0
        zero = int(round(-lo / scale))
        q = np.clip(np.round(w / scale) + zero, 0, 255).astype(np.uint8)
        graph.initializer.remove(inits[name])
        graph.initializer.extend([
            numpy_helper.from_array(q, name + "_q"),
            numpy_helper.from_array(np.array(scale, dtype=np.float32), name + "_scale"),
            numpy_helper.from_array(np.array(zero, dtype=np.uint8), name + "_zero"),
        ])
        new_nodes.append(helper.make_node("DequantizeLinear", [name + "_q", name + "_scale", name + "_zero"], [name]))
    nodes = list(graph.node)
    del graph.node[:]
    graph.node.extend(new_nodes + nodes)
    onnx.save(model, str(dst))


weights_only_uint8(fp32, out / "isnet-general-use-uint8w.onnx")

for f in sorted(out.glob("isnet-general-use-*.onnx")):
    print(f"{f.name}: {f.stat().st_size / 1e6:.1f} MB")
