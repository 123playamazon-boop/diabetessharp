"""Sombra de contacto leve no fundo branco (evita produto “a flutuar”)."""

from __future__ import annotations

import cv2
import numpy as np


def add_ground_shadow(
    bgr: np.ndarray,
    fg_alpha: np.ndarray,
    *,
    opacity: float = 0.14,
    blur_sigma: float = 28.0,
    offset_y: int = 6,
    spread_y: float = 0.022,
) -> np.ndarray:
    """
    Desenha uma elipse suave sob a base do primeiro plano (alpha > 0.5).
    """
    if bgr.size == 0 or fg_alpha.size == 0:
        return bgr

    h, w = bgr.shape[:2]
    m = (fg_alpha >= 0.5).astype(np.uint8) * 255
    ys, xs = np.where(m > 0)
    if len(xs) == 0:
        return bgr

    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    base_y = y1
    cx = (x0 + x1) * 0.5
    rx = max(8, int((x1 - x0) * 0.42))
    ry = max(4, int(h * spread_y))

    shadow = np.zeros((h, w), dtype=np.float32)
    cv2.ellipse(
        shadow,
        (int(cx), min(h - 1, base_y + offset_y)),
        (rx, ry),
        0,
        0,
        360,
        1.0,
        -1,
    )
    shadow = cv2.GaussianBlur(shadow, (0, 0), sigmaX=blur_sigma, sigmaY=blur_sigma * 0.55)
    shadow *= opacity

    out = bgr.astype(np.float32)
    for c in range(3):
        out[:, :, c] *= 1.0 - shadow
    return np.clip(out, 0, 255).astype(np.uint8)
