"""Decode images with EXIF orientation (same as most browsers) — OpenCV alone ignores Orientation."""

from __future__ import annotations

import io

import cv2
import numpy as np
from PIL import Image, ImageOps


def _rgb_matte_black_to_alpha(rgb: np.ndarray, lo: float = 14.0, hi: float = 40.0) -> np.ndarray:
    """Fundo preto em RGB → alpha suave (arte flat sem canal alpha)."""
    lum = np.max(rgb, axis=2).astype(np.float32)
    a = (lum - lo) / max(hi - lo, 1e-3)
    return np.clip(a, 0.0, 1.0)


def decode_bgr_alpha(
    data: bytes,
    *,
    matte_black_background: bool = False,
) -> tuple[np.ndarray, np.ndarray | None]:
    """
    Returns BGR uint8 (H,W,3) and optional alpha float (H,W) in [0,1].
    Applies EXIF transpose so pixel layout matches browser/canvas.
    matte_black_background: se True e a imagem for RGB, trata preto/cinza muito escuro como transparente.
    """
    if not data:
        raise ValueError("Dados de imagem vazios.")

    im = Image.open(io.BytesIO(data))
    im = ImageOps.exif_transpose(im)

    if im.mode == "P":
        im = im.convert("RGBA" if "transparency" in im.info else "RGB")

    if im.mode in ("RGBA", "LA"):
        if im.mode == "LA":
            im = im.convert("RGBA")
        rgba = np.array(im.convert("RGBA"))
        if rgba.dtype == np.uint16:
            rgba = (np.clip(rgba.astype(np.float32) * (255.0 / 65535.0), 0, 255)).astype(np.uint8)
        else:
            rgba = rgba.astype(np.uint8)
        bgr = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2BGR)
        alpha = rgba[:, :, 3].astype(np.float32) / 255.0
        return bgr, alpha

    if im.mode == "L":
        gray = np.array(im)
        if gray.dtype == np.uint16:
            gray = (np.clip(gray.astype(np.float32) * (255.0 / 65535.0), 0, 255)).astype(np.uint8)
        else:
            gray = gray.astype(np.uint8)
        bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        return bgr, None

    rgb = np.array(im.convert("RGB"))
    if rgb.dtype == np.uint16:
        rgb = (np.clip(rgb.astype(np.float32) * (255.0 / 65535.0), 0, 255)).astype(np.uint8)
    else:
        rgb = rgb.astype(np.uint8)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    if matte_black_background:
        alpha = _rgb_matte_black_to_alpha(rgb)
        return bgr, alpha
    return bgr, None


def decode_bgr(data: bytes) -> np.ndarray:
    bgr, _ = decode_bgr_alpha(data)
    return bgr
