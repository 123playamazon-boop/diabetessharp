"""Acabamento tipo catálogo e-commerce: contraste local, cor, nitidez — conservador para Amazon."""

from __future__ import annotations

import cv2
import numpy as np


def finish_product_photo(bgr: np.ndarray) -> np.ndarray:
    """
    Melhora automática da foto final (embalagem + rótulo já compostos).
    Mantém cores críveis; evita HDR agressivo ou saturação artificial forte.
    """
    if bgr.size == 0:
        return bgr

    x = bgr.astype(np.float32) / 255.0

    # Nitidez conservadora — valores altos + CLAHE forte davam aspecto “pintado”.
    blur = cv2.GaussianBlur(x, (0, 0), sigmaX=0.85)
    x = np.clip(x + 0.16 * (x - blur), 0, 1)

    lab = cv2.cvtColor((x * 255).astype(np.uint8), cv2.COLOR_BGR2LAB)
    L, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=1.25, tileGridSize=(8, 8))
    L = clahe.apply(L)
    lab = cv2.merge([L, a, b])
    mid = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    hsv = cv2.cvtColor(mid, cv2.COLOR_BGR2HSV)
    h_ch, s_ch, v_ch = cv2.split(hsv)
    s_ch = np.clip(s_ch.astype(np.float32) * 1.04, 0, 255).astype(np.uint8)
    # Leve abertura de tons médios / sombras
    v_f = v_ch.astype(np.float32)
    v_f = np.clip((v_f - 127.5) * 1.02 + 127.5, 0, 255)
    v_ch = v_f.astype(np.uint8)
    hsv = cv2.merge([h_ch, s_ch, v_ch])
    out = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

    # Micro-contraste final no canal L (leve “pop”)
    lab2 = cv2.cvtColor(out, cv2.COLOR_BGR2LAB)
    L2, a2, b2 = cv2.split(lab2)
    Lf = L2.astype(np.float32) / 255.0
    Lf = np.clip(Lf**0.99, 0, 1)
    L2 = (Lf * 255).astype(np.uint8)
    out = cv2.cvtColor(cv2.merge([L2, a2, b2]), cv2.COLOR_LAB2BGR)

    return out


def upscale_min_short_side(bgr: np.ndarray, min_side: int = 2000) -> np.ndarray:
    """Garante que o lado mais curto tenha pelo menos min_side px (proporção mantida)."""
    if bgr.size == 0:
        return bgr
    h, w = bgr.shape[:2]
    short = min(h, w)
    if short >= min_side:
        return bgr
    scale = min_side / float(short)
    nw = max(min_side, int(round(w * scale)))
    nh = max(min_side, int(round(h * scale)))
    return cv2.resize(bgr, (nw, nh), interpolation=cv2.INTER_LANCZOS4)


def ensure_at_least_2000x2000(bgr: np.ndarray, min_w: int = 2000, min_h: int = 2000) -> np.ndarray:
    """Largura e altura finais ≥ min_w e min_h; upscale com INTER_LANCZOS4."""
    if bgr.size == 0:
        return bgr
    h, w = bgr.shape[:2]
    scale = max(min_w / float(w), min_h / float(h), 1.0)
    if scale <= 1.0:
        return bgr
    nw = max(min_w, int(round(w * scale)))
    nh = max(min_h, int(round(h * scale)))
    return cv2.resize(bgr, (nw, nh), interpolation=cv2.INTER_LANCZOS4)


def post_upscale_sharpen(
    bgr: np.ndarray,
    min_side: int = 2000,
    *,
    min_width: int | None = None,
    min_height: int | None = None,
) -> np.ndarray:
    """
    Upscale + nitidez leve. Por defeito garante imagem ≥2000×2000 px (ambas as dimensões).
    """
    mw = min_width if min_width is not None else min_side
    mh = min_height if min_height is not None else min_side
    x = ensure_at_least_2000x2000(bgr, min_w=mw, min_h=mh)
    blur = cv2.GaussianBlur(x, (0, 0), sigmaX=0.95)
    sharp = cv2.addWeighted(x, 1.12, blur, -0.12, 0)
    return sharp
