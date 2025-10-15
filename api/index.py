import io
import json
import math
import urllib.request
from typing import Dict, Any, List, Tuple

import numpy as np
from flask import Flask, request, jsonify
from PIL import Image, ImageOps
import piexif
from skimage.color import rgb2gray
from skimage.measure import shannon_entropy
from skimage.filters import laplace

# Flask app for Vercel Python Runtime
app = Flask(__name__)

# -------- Image Utilities -------- #

def _load_image_from_bytes(data: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(data))
    img = ImageOps.exif_transpose(img)
    return img


def _pil_to_nd_gray(img: Image.Image) -> np.ndarray:
    if img.mode not in ("L", "LA"):
        arr = np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0
        gray = 0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]
    else:
        gray = np.asarray(img.convert("L"), dtype=np.float32) / 255.0
    return gray


def _resize_for_metrics(img: Image.Image, max_side: int = 1024) -> Image.Image:
    w, h = img.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1.0:
        new_size = (int(round(w * scale)), int(round(h * scale)))
        return img.resize(new_size, Image.BICUBIC)
    return img

# -------- Metadata Extraction -------- #

def extract_metadata(img: Image.Image) -> Dict[str, Any]:
    meta: Dict[str, Any] = {}
    # Basic
    meta["format"] = img.format
    meta["mode"] = img.mode
    meta["size"] = {"width": img.size[0], "height": img.size[1]}

    # PIL info
    info = {}
    for k, v in (img.info or {}).items():
        try:
            if isinstance(v, (bytes, bytearray)):
                # keep short preview only
                info[k] = {"type": "bytes", "length": len(v)}
            else:
                info[k] = v
        except Exception:
            pass
    if info:
        meta["pil_info"] = info

    # ICC profile
    icc = img.info.get("icc_profile")
    if icc:
        meta["icc_profile_length"] = len(icc)

    # EXIF with piexif (JPEG/TIFF/WEBP may have EXIF)
    exif_data = {}
    try:
        exif_bytes = img.info.get("exif")
        if exif_bytes:
            exif_dict = piexif.load(exif_bytes)
        else:
            exif_dict = piexif.load(img.tobytes())  # may throw
        for ifd_name, ifd in exif_dict.items():
            if isinstance(ifd, dict):
                readable_ifd = {}
                for tag_id, value in ifd.items():
                    try:
                        tag_name = piexif.TAGS[ifd_name][tag_id]["name"]
                    except Exception:
                        tag_name = str(tag_id)
                    try:
                        if isinstance(value, bytes):
                            # decode best-effort
                            try:
                                readable_ifd[tag_name] = value.decode("utf-8", "ignore")
                            except Exception:
                                readable_ifd[tag_name] = f"<bytes:{len(value)}>"
                        else:
                            readable_ifd[tag_name] = value
                    except Exception:
                        pass
                if readable_ifd:
                    exif_data[ifd_name] = readable_ifd
    except Exception:
        pass

    if exif_data:
        meta["exif"] = exif_data

    return meta

# -------- Generator Tag Detection -------- #

GENERATOR_KEYWORDS = [
    "stable diffusion", "stability.ai", "automatic1111", "invokeai", "comfyui",
    "midjourney", "dall-e", "dall·e", "openai", "novelai", "runway", "firefly",
    "leonardo", "sdxl", "genai", "ai generated", "clipdrop", "ideogram", "flux.1"
]


def detect_generator_reasons(metadata: Dict[str, Any]) -> List[str]:
    texts: List[str] = []

    def collect(obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                texts.append(str(k).lower())
                collect(v)
        elif isinstance(obj, list):
            for it in obj:
                collect(it)
        else:
            try:
                texts.append(str(obj).lower())
            except Exception:
                pass

    collect(metadata)

    reasons = []
    for kw in GENERATOR_KEYWORDS:
        if any(kw in t for t in texts):
            reasons.append(f"Generator tag detected: {kw}")
    return reasons

# -------- Heuristic Metrics -------- #

def compute_blockiness(gray: np.ndarray) -> float:
    # Compute average absolute difference across 8x8 block boundaries (JPEG artifacts)
    H, W = gray.shape
    if H < 16 or W < 16:
        return 0.0
    # vertical boundaries (columns at multiples of 8)
    v_edges = []
    for c in range(8, W, 8):
        if c < W:
            v_edges.append(np.mean(np.abs(gray[:, c] - gray[:, c - 1])))
    # horizontal boundaries (rows at multiples of 8)
    h_edges = []
    for r in range(8, H, 8):
        if r < H:
            h_edges.append(np.mean(np.abs(gray[r, :] - gray[r - 1, :])))
    all_edges = v_edges + h_edges
    if not all_edges:
        return 0.0
    val = float(np.mean(all_edges))
    return float(np.clip(val, 0.0, 1.0))


def compute_noise(gray: np.ndarray) -> float:
    # Proxy noise metric: standard deviation of Laplacian response (high-frequency energy)
    lap = laplace(gray)
    noise = float(np.std(lap))
    # Normalize by an empirical factor to ~[0,1]
    return float(np.clip(noise * 2.0, 0.0, 1.0))


def compute_entropy(gray: np.ndarray) -> float:
    # Shannon entropy in bits per pixel
    ent = float(shannon_entropy(gray))
    # Normalize assuming 8-bit grayscale max entropy ~8
    return float(np.clip(ent / 8.0, 0.0, 1.0))


def analyze_image(img: Image.Image) -> Dict[str, Any]:
    # Resize for metrics (speed)
    img_small = _resize_for_metrics(img)
    gray = _pil_to_nd_gray(img_small)

    metadata = extract_metadata(img)

    blockiness = compute_blockiness(gray)
    noise = compute_noise(gray)
    entropy = compute_entropy(gray)

    metrics = {
        "blockiness": blockiness,
        "noise_estimate": noise,
        "hist_entropy": entropy,
    }

    # Reasons and scoring
    reasons: List[str] = []

    gen_reasons = detect_generator_reasons(metadata)
    reasons.extend(gen_reasons)

    # Missing camera EXIF often appears in AI or edited images
    has_exif = bool(metadata.get("exif"))
    if not has_exif:
        reasons.append("No EXIF metadata present")

    # Heuristic checks
    if entropy < 0.35:
        reasons.append("Low histogram entropy")
    if noise < 0.20:
        reasons.append("Low high-frequency noise")
    if blockiness < 0.05 and img.format != "PNG":
        reasons.append("Very low JPEG blockiness")

    # Combine into score [0,1]
    score = 0.0
    if gen_reasons:
        score += 0.6
    if not has_exif:
        score += 0.15
    score += (0.35 - min(entropy, 0.35)) / 0.35 * 0.1  # up to +0.1 when entropy small
    score += (0.20 - min(noise, 0.20)) / 0.20 * 0.1    # up to +0.1 when noise small
    score += (0.05 - min(blockiness, 0.05)) / 0.05 * 0.05  # up to +0.05 when blockiness very small
    score = float(np.clip(score, 0.0, 1.0))

    if score >= 0.75:
        label = "Likely AI-generated"
    elif score >= 0.45:
        label = "Possibly AI-generated"
    else:
        label = "Likely human-captured"

    return {
        "score": score,
        "label": label,
        "reasons": reasons,
        "metadata": metadata,
        "metrics": metrics,
    }

# -------- Routes -------- #

@app.route("/", methods=["GET"])  # for quick health check
def health():
    return jsonify({"status": "ok"})


@app.route("/analyze", methods=["POST"])
@app.route("/api/analyze", methods=["POST"])  # for Vercel path passthrough
def analyze_upload():
    if "file" not in request.files:
        return jsonify({"error": "Missing 'file' in multipart form-data"}), 400
    f = request.files["file"]
    data = f.read()
    if not data:
        return jsonify({"error": "Empty file"}), 400
    try:
        img = _load_image_from_bytes(data)
    except Exception as e:
        return jsonify({"error": f"Invalid image: {e}"}), 400

    result = analyze_image(img)
    return jsonify(result)


@app.route("/analyze-url", methods=["POST"])
@app.route("/api/analyze-url", methods=["POST"])  # for Vercel path passthrough
def analyze_url():
    try:
        payload = request.get_json(force=True)
    except Exception:
        payload = None
    if not payload or "url" not in payload:
        return jsonify({"error": "Provide JSON with 'url'"}), 400
    url = payload["url"]

    try:
        with urllib.request.urlopen(url) as resp:
            data = resp.read()
    except Exception as e:
        return jsonify({"error": f"Failed to fetch URL: {e}"}), 400

    try:
        img = _load_image_from_bytes(data)
    except Exception as e:
        return jsonify({"error": f"Invalid image from URL: {e}"}), 400

    result = analyze_image(img)
    return jsonify(result)


# Optional: expose a handler name for legacy adapters while keeping native Vercel Python runtime usage
try:
    from vercel_wsgi import handle as _vercel_handle  # type: ignore
    handler = lambda request, response: _vercel_handle(app, request, response)  # noqa: E731
except Exception:
    handler = None  # Vercel will use the module-level `app`

if __name__ == "__main__":
    # Local development server
    app.run(host="127.0.0.1", port=5000, debug=True)
