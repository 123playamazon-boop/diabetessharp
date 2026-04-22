"""Fundo branco puro (255,255,255) após rembg — PIL paste com máscara (sem fundo transparente/escuro)."""

from __future__ import annotations

import io

import cv2
import numpy as np
from PIL import Image


def remove_background_white_bgr(image_bytes: bytes) -> tuple[np.ndarray, np.ndarray]:
    """
    Remove o fundo com rembg e compõe sobre RGB(255,255,255) com image.paste(..., mask).
    Devolve (BGR uint8, alpha do primeiro plano float 0..1).
    """
    if not image_bytes:
        raise ValueError("Imagem vazia.")

    try:
        from rembg import remove
    except ImportError as e:
        raise ImportError(
            "A biblioteca rembg é necessária para remover o fundo. Instale: pip install rembg"
        ) from e

    rgba_bytes = remove(image_bytes)
    foreground = Image.open(io.BytesIO(rgba_bytes)).convert("RGBA")
    if foreground.mode != "RGBA":
        foreground = foreground.convert("RGBA")

    w, h = foreground.size
    white = Image.new("RGB", (w, h), (255, 255, 255))
    white.paste(foreground, (0, 0), foreground.split()[3])

    rgb = np.array(white, dtype=np.uint8)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    alpha_ch = np.array(foreground.split()[3], dtype=np.float32) / 255.0
    alpha = np.clip(alpha_ch, 0.0, 1.0).astype(np.float32)
    return bgr, alpha
