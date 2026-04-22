"""
Pós-processamento para exportação: unsharp na zona do rótulo, sombra elíptica,
realce de estúdio e gravação PNG (sem compressão agressiva + DPI 300).
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Tuple

import cv2
import numpy as np
from PIL import Image

# Metadados de impressão (PNG pHYs: pixels por metro ≈ 300 DPI)
_DPI = 300
_PNG_COMPRESS_LEVEL = 0  # sem compressão zlib agressiva (PNG continua sem perdas)


def _scale_xywh(
    xywh: Tuple[int, int, int, int],
    scale_x: float,
    scale_y: float,
) -> Tuple[int, int, int, int]:
    x, y, w, h = xywh
    return (
        int(round(x * scale_x)),
        int(round(y * scale_y)),
        max(1, int(round(w * scale_x))),
        max(1, int(round(h * scale_y))),
    )


def unsharp_mask_label_region(
    bgr: np.ndarray,
    label_xywh: Tuple[int, int, int, int],
    *,
    amount: float = 1.5,
    radius_px: float = 1.5,
    threshold: int = 3,
) -> np.ndarray:
    """
    Unsharp mask só na região do rótulo (Amount 150% = 1.5, Radius 1.5px, Threshold 3).
    """
    if bgr.size == 0:
        return bgr
    h, w = bgr.shape[:2]
    x, y, lw, lh = label_xywh
    x = max(0, min(x, w - 1))
    y = max(0, min(y, h - 1))
    lw = max(1, min(lw, w - x))
    lh = max(1, min(lh, h - y))

    img = bgr.astype(np.float32)
    blur = cv2.GaussianBlur(img, (0, 0), sigmaX=radius_px, sigmaY=radius_px)
    high = img - blur
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    blur_u8 = np.clip(blur, 0, 255).astype(np.uint8)
    gray_b = cv2.cvtColor(blur_u8, cv2.COLOR_BGR2GRAY).astype(np.float32)
    significant = np.abs(gray - gray_b) >= float(threshold)
    significant = significant.astype(np.float32)

    label_mask = np.zeros((h, w), dtype=np.float32)
    label_mask[y : y + lh, x : x + lw] = 1.0
    k = max(3, int(round(radius_px * 4)) | 1)
    label_mask = cv2.GaussianBlur(label_mask, (k, k), radius_px * 0.35)
    label_mask = label_mask[:, :, np.newaxis]

    apply_m = significant[:, :, np.newaxis] * label_mask
    sharpened = img + amount * high * apply_m
    return np.clip(sharpened, 0, 255).astype(np.uint8)


def add_elliptical_drop_shadow(
    bgr: np.ndarray,
    fg_alpha: np.ndarray,
    *,
    shadow_alpha: float = 0.15,
    blur_px: float = 20.0,
    offset_y: int = 15,
) -> np.ndarray:
    """
    Sombra elíptica suave abaixo do contentor: rgba(0,0,0,0.15), blur ~20px, offset Y +15.
    """
    if bgr.size == 0 or fg_alpha.size == 0:
        return bgr
    hh, ww = bgr.shape[:2]
    if fg_alpha.shape[:2] != (hh, ww):
        fg_alpha = cv2.resize(fg_alpha, (ww, hh), interpolation=cv2.INTER_LINEAR)

    m = (fg_alpha >= 0.5).astype(np.uint8) * 255
    ys, xs = np.where(m > 0)
    if len(xs) == 0:
        return bgr

    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    base_y = y1
    cx = (x0 + x1) * 0.5
    rx = max(8, int((x1 - x0) * 0.45))
    ry = max(6, int(hh * 0.028))

    shadow = np.zeros((hh, ww), dtype=np.float32)
    cy = min(hh - 1, base_y + offset_y)
    cv2.ellipse(shadow, (int(cx), cy), (rx, ry), 0, 0, 360, 1.0, -1)
    shadow = cv2.GaussianBlur(shadow, (0, 0), sigmaX=blur_px, sigmaY=blur_px * 0.55)
    shadow *= shadow_alpha

    out = bgr.astype(np.float32)
    for c in range(3):
        out[:, :, c] *= 1.0 - shadow
    return np.clip(out, 0, 255).astype(np.uint8)


def add_studio_highlight_top_left(
    bgr: np.ndarray,
    fg_alpha: np.ndarray,
    *,
    max_opacity: float = 0.08,
) -> np.ndarray:
    """
    Realce branco muito subtil (8%) do canto superior-esquerdo ao inferior-direito,
    só sobre o primeiro plano do contentor.
    """
    if bgr.size == 0:
        return bgr
    hh, ww = bgr.shape[:2]
    if fg_alpha.shape[:2] != (hh, ww):
        fg_alpha = cv2.resize(fg_alpha, (ww, hh), interpolation=cv2.INTER_LINEAR)

    yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float32)
    gx = xx / max(ww - 1, 1)
    gy = yy / max(hh - 1, 1)
    t = 0.5 * (gx + gy)
    grad = np.clip(1.0 - t, 0.0, 1.0) ** 1.15

    fg = np.clip(fg_alpha, 0.0, 1.0).astype(np.float32)
    k = max(3, int(round(min(hh, ww) * 0.012)) | 1)
    fg = cv2.GaussianBlur(fg, (k, k), 0)
    strength = max_opacity * grad * fg

    out = bgr.astype(np.float32)
    white = np.float32(255.0)
    for c in range(3):
        out[:, :, c] = out[:, :, c] + strength * (white - out[:, :, c])
    return np.clip(out, 0, 255).astype(np.uint8)


def ensure_min_size_2000(
    bgr: np.ndarray,
    fg_alpha: np.ndarray,
    label_xywh: Tuple[int, int, int, int],
    min_w: int = 2000,
    min_h: int = 2000,
) -> tuple[np.ndarray, np.ndarray, Tuple[int, int, int, int]]:
    """Redimensiona imagem, alpha e retângulo do rótulo para largura e altura ≥ mínimos."""
    if bgr.size == 0:
        return bgr, fg_alpha, label_xywh
    ih, iw = bgr.shape[:2]
    scale = max(min_w / float(iw), min_h / float(ih), 1.0)
    if scale <= 1.0:
        if fg_alpha.shape[:2] != (ih, iw):
            fg_alpha = cv2.resize(fg_alpha, (iw, ih), interpolation=cv2.INTER_LINEAR)
        return bgr, fg_alpha, label_xywh

    nw = max(min_w, int(round(iw * scale)))
    nh = max(min_h, int(round(ih * scale)))
    out_bgr = cv2.resize(bgr, (nw, nh), interpolation=cv2.INTER_LANCZOS4)
    out_a = cv2.resize(fg_alpha, (nw, nh), interpolation=cv2.INTER_LINEAR)
    sx = nw / float(iw)
    sy = nh / float(ih)
    out_xywh = _scale_xywh(label_xywh, sx, sy)
    return out_bgr, out_a, out_xywh


def finalize_export_bgr(
    bgr: np.ndarray,
    label_xywh: Tuple[int, int, int, int],
    fg_alpha: np.ndarray,
    *,
    min_w: int = 2000,
    min_h: int = 2000,
) -> np.ndarray:
    """
    Ordem: upscale para ≥2000×2000 → unsharp só no rótulo → sombra → realce de estúdio.
    """
    bgr, fg_alpha, xywh = ensure_min_size_2000(
        bgr, fg_alpha, label_xywh, min_w=min_w, min_h=min_h
    )
    out = unsharp_mask_label_region(bgr, xywh)
    out = add_elliptical_drop_shadow(out, fg_alpha)
    out = add_studio_highlight_top_left(out, fg_alpha)
    return out


def bgr_to_png_bytes_print_ready(bgr: np.ndarray) -> bytes:
    """PNG com compress_level=0 e DPI 300 em metadados."""
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    im = Image.fromarray(rgb)
    # pixels por metro = dpi / 0.0254
    ppm = int(round(_DPI / 0.0254))
    buf = io.BytesIO()
    im.save(
        buf,
        format="PNG",
        compress_level=_PNG_COMPRESS_LEVEL,
        dpi=(_DPI, _DPI),
    )
    return buf.getvalue()


def save_bgr_png_print_ready(bgr: np.ndarray, path: Path | str) -> None:
    Path(path).write_bytes(bgr_to_png_bytes_print_ready(bgr))
