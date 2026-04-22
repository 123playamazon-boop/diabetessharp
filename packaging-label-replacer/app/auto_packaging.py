"""
Heurística de “tipo” de embalagem a partir do quadrilátero do rótulo na foto +
pré-deformação da arte (cilindro leve + pincushion) para simular curva sem modelo 3D.
"""

from __future__ import annotations

import cv2
import numpy as np

_WARP = cv2.INTER_LANCZOS4


def _classify(dst_raw: np.ndarray, pw: int, ph: int) -> str:
    pts = dst_raw.reshape(4, 2).astype(np.float32)
    _, cy = float(pts[:, 0].mean()), float(pts[:, 1].mean())
    cyn = cy / max(ph, 1)

    rect = cv2.minAreaRect(pts)
    w_r, h_r = rect[1]
    w_r = max(w_r, 1e-3)
    h_r = max(h_r, 1e-3)
    long_s, short_s = max(w_r, h_r), min(w_r, h_r)
    elong = long_s / short_s

    area = abs(cv2.contourArea(pts.reshape(-1, 1, 2)))
    area_r = area / max(pw * ph, 1)

    # Tampa: parte superior da foto, retângulo ajustado pouco alongado
    if cyn < 0.42 and elong < 1.42 and area_r < 0.48:
        return "lid"
    # Frente / faixa vertical (pote, saco em pé)
    if elong > 1.38 and cyn > 0.2:
        return "tall_front"
    # Faixa horizontal larga (rótulo “landscape” na foto)
    if elong < 1.22 and cyn > 0.35:
        return "wide_band"
    return "generic"


def _preset(kind: str) -> tuple[float, float]:
    """(pincushion, cylinder_h) — valores moderados para não distorcer texto."""
    # Cilindro/pincushion fortes em “tall_front” distorcem texto; manter subtil.
    m = {
        "lid": (0.022, 0.028),
        "tall_front": (0.032, 0.065),
        "wide_band": (0.040, 0.07),
        "generic": (0.038, 0.055),
    }
    return m.get(kind, m["generic"])


def _cylinder_h_remap(
    bgr: np.ndarray, alpha: np.ndarray | None, strength: float
) -> tuple[np.ndarray, np.ndarray | None]:
    """Comprime horizontalmente topo/fundo da arte (sugestão de cilindro vertical)."""
    if strength <= 0:
        return bgr, alpha
    h, w = bgr.shape[:2]
    mx, my = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    cx = (w - 1) * 0.5
    yn = (my - (h - 1) * 0.5) / max((h - 1) * 0.5, 1e-6)
    scale_x = 1.0 - strength * (yn**2)
    scale_x = np.clip(scale_x, 0.82, 1.0)
    map_x = np.clip(cx + (mx - cx) * scale_x, 0, w - 1).astype(np.float32)
    map_y = my.astype(np.float32)
    out = cv2.remap(bgr, map_x, map_y, _WARP, borderMode=cv2.BORDER_REPLICATE)
    ao = None
    if alpha is not None:
        ao = cv2.remap(alpha, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return out, ao


def _pincushion_remap(
    bgr: np.ndarray, alpha: np.ndarray | None, strength: float
) -> tuple[np.ndarray, np.ndarray | None]:
    if strength <= 0:
        return bgr, alpha
    h, w = bgr.shape[:2]
    mx, my = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    cx = (w - 1) * 0.5
    cy = (h - 1) * 0.5
    nx = (mx - cx) / max(cx, 1e-6)
    ny = (my - cy) / max(cy, 1e-6)
    r2 = nx * nx + ny * ny
    s = 1.0 - strength * np.clip(r2, 0.0, 2.0)
    map_x = np.clip(cx + (mx - cx) * s, 0, w - 1).astype(np.float32)
    map_y = np.clip(cy + (my - cy) * s, 0, h - 1).astype(np.float32)
    out = cv2.remap(bgr, map_x, map_y, _WARP, borderMode=cv2.BORDER_REPLICATE)
    ao = None
    if alpha is not None:
        ao = cv2.remap(alpha, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return out, ao


def curve_label_artwork(
    bgr: np.ndarray,
    alpha: np.ndarray | None,
    dst_corners: np.ndarray,
    pw: int,
    ph: int,
) -> tuple[np.ndarray, np.ndarray | None]:
    """
    Aplica curvatura automática na arte antes da perspectiva.
    dst_corners: (4,2) pontos na foto (ordem original do utilizador).
    """
    kind = _classify(dst_corners, pw, ph)
    pin, cyl = _preset(kind)
    bgr, alpha = _cylinder_h_remap(bgr, alpha, cyl)
    bgr, alpha = _pincushion_remap(bgr, alpha, pin)
    return bgr, alpha
