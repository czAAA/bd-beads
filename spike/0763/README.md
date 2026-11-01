# Spike 0763: AI cut out, speed and memory on the device

A throwaway page on the branch `spike/0763-ai-cut-out-ipads`. It never merges. It loads IS-Net general-use and
SlimSAM-77-uniform through onnxruntime-web on plain WebAssembly, one thread, in a Web Worker (ADR 0087), from static
files under 25 MiB each (a larger model in parts the worker joins), and measures download, load, the first and second
mask and the WebAssembly heap.

## 1. Make the files (once, on the Mac)

```sh
bash spike/0763/prepare/prepare.sh            # or: prepare.sh <folder of your own photos>
```

It needs python3 and network once, and writes about 300 MB to `public/spike-0763/` (gitignored); its work files
(a venv with torch, the upstream weights) go to `spike/0763/.work/` (gitignored, about 1.5 GB).

- **IS-Net general-use**: upstream `isnet-general-use.pth` from [xuebinqin/DIS](https://github.com/xuebinqin/DIS)
  (Apache-2.0; the weights are linked from its README), checked by SHA-256, with `isnet.py` from DIS at commit
  `b6764e2`. `prepare/export_isnet.py` exports it to ONNX (opset 17, 1024 × 1024) and writes three files:
  - `uint8`: dynamic uint8 quantization (ConvInteger), the "compressed, about 44 MB" of ADR 0087.
  - `uint8w`: the same uint8 weights, dequantized when the model loads, so it runs float Conv: the same download,
    probably faster, more memory. Measure it only if `uint8` is slow or its masks are poor.
  - `fp32`: uncompressed, 176 MB in 7 parts, only for the quality comparison.
  Not the onnx-community copy, which is tagged AGPL-3.0.
- **SlimSAM-77-uniform**: `vision_encoder_quantized.onnx` (8.9 MB) and `prompt_encoder_mask_decoder_quantized.onnx`
  (4.9 MB) from [Xenova/slimsam-77-uniform](https://huggingface.co/Xenova/slimsam-77-uniform) at `5850ab4`
  (Apache-2.0, from nielsr/slimsam-77-uniform and Zigeng/SlimSAM).
- **The runtime**: `ort-wasm-simd-threaded.wasm` (14.8 MB) from the `onnxruntime-web` package (MIT), version in the
  page's header. The worker fetches it itself and hands it to onnxruntime, so nothing loads from a CDN.
- **Photos**: four from Wikimedia Commons, their pages listed in `spike/0763/.work/photos/SOURCES.txt`: beaded
  earrings (CC BY 4.0), a cat (GFDL 1.2), a sunflower (CC BY-SA 3.0), Times Square (CC BY 2.0). Never committed. Add
  the maker's own beadwork photo with the page's file picker.

## 2. Serve it on the tailnet

```sh
npm run tailnet:start 5763
```

Open `https://<mac-name>.<tailnet>.ts.net:5763/spike/0763/` on each device. `npm run tailnet:stop` when done.

## 3. Measure on each device

On the iPad mini (A17 Pro), the iPad Air (M2), desktop Chrome and desktop Safari:

1. Type the device's name in **Device**.
2. Connect Safari's Web Inspector (Mac Safari, Develop menu, the iPad, the page). In **Timelines**, turn on Memory
   (and JavaScript & Events), and start recording.
3. Pick a photo, press **Run all**, wait for "Run all done", stop the recording. The Memory timeline's peak is the
   number for the report (also note the largest "Page" figure). In desktop Chrome use the Task Manager's
   "Memory footprint" of the tab and its dedicated worker instead.
4. Repeat for each photo. Each run starts a fresh worker, so the download and load are measured each time
   (the spike fetches with `cache: no-store`; the app will keep the files in Cache Storage).
   The download times are the tailnet's, from the dev server, uncompressed: they say little about a maker's
   connection. The download sizes are the ones that count.
5. Tap a few parts of the picture: each tap after the first is the decoder alone.
6. **Copy as Markdown** (or **Download JSON**) and paste the table into the report. The table is kept in the page
   until **Clear**, across reloads.

**Which time is which.** "first mask" and "second mask" run from the press to the mask drawn, after the model is
loaded (download and load are rows of their own); the model's own time is in the note. "first tap mask" includes
reading the picture (the encoder); each later tap is the decoder alone. The "taking longer" threshold comes from the
first mask's time on the slower iPad.

**Lean memory** loads the next models without onnxruntime's memory arena and memory pattern. If the peak is near
1.5 GB, run once more with it on (after **New worker**) and record both.

The **Wasm MB** column is the size of the worker's WebAssembly heap, which only grows: its last value is the heap's
peak. It is address space the runtime asked for, not all of it touched, so the real footprint is the Timelines one;
the column is a cross-check every browser can give.

**Checking the network panel.** In Web Inspector's Network tab during a run, every request goes to the page's own
origin: the page, its scripts, `spike-0763/manifest.json`, the runtime and the model parts. Nothing else.

## 4. Masks and the comparison

Look at the cut-out (IS-Net) and the tinted tap mask (SlimSAM) on each photo, and **Save the masks shown** for the
report. **Compare on this picture** runs the chosen compressed IS-Net and the uncompressed one in a worker of their
own and gives the IoU of their masks (at 0.5) and the mean difference, with a picture of where they differ. The
comparison doesn't depend on the device: run it once per photo on a desktop.

## Desktop runs from the command line

With the dev server running, `node spike/0763/measure.mjs http://localhost:5763/spike/0763/ chromium` (or `webkit`)
runs every photo in Playwright and prints the table and any request that left the origin (`--taps-only` for SlimSAM
alone, `--compare` for the comparison, `--lean` for lean memory). Playwright's WebKit is not Safari, and headless
Chromium is not Chrome; they check the page works and give a desktop baseline.
