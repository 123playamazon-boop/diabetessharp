"""Bounding box da embalagem (face frontal): contornos OpenCV + fallback na máscara."""

from __future__ import annotations

import cv2
import numpy as np


def _largest_plausible_contour_bbox(
    binary: np.ndarray,
    *,
    min_area_ratio: float = 0.004,
    max_area_ratio: float = 0.96,
) -> tuple[int, int, int, int] | None:
    """Maior contorno externo plausível → (x, y, w, h)."""
    h, w = binary.shape[:2]
    area_img = float(h * w)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    best_a = 0.0
    for c in contours:
        a = cv2.contourArea(c)
        if a < min_area_ratio * area_img or a > max_area_ratio * area_img:
            continue
        if a > best_a:
            best_a = a
            best = c
    if best is None:
        return None
    x, y, bw, bh = cv2.boundingRect(best)
    return int(x), int(y), max(1, int(bw)), max(1, int(bh))


def binary_mask_from_alpha(alpha: np.ndarray, thresh: float = 0.5) -> np.ndarray:
    return ((alpha >= thresh).astype(np.uint8)) * 255


def binary_mask_from_bgr_light_background(bgr: np.ndarray) -> np.ndarray:
    """
    Primeiro plano escuro/colorido sobre fundo claro (foto de estúdio sem alpha).
    """
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, th = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    th = cv2.morphologyEx(th, cv2.MORPH_CLOSE, k, iterations=2)
    th = cv2.morphologyEx(th, cv2.MORPH_OPEN, k, iterations=1)
    return th


def container_bbox_from_contours(
    bgr: np.ndarray,
    alpha: np.ndarray | None = None,
    *,
    pad_px: int = 0,
) -> tuple[int, int, int, int]:
    """
    Bounding box da embalagem via cv2.findContours na máscara de primeiro plano.
    Se alpha existir, usa-a; senão estima máscara a partir do BGR (fundo claro).
    """
    h, w = bgr.shape[:2]
    if alpha is not None and alpha.shape[:2] == (h, w):
        binary = binary_mask_from_alpha(alpha)
    else:
        binary = binary_mask_from_bgr_light_background(bgr)

    bbox = _largest_plausible_contour_bbox(binary)
    if bbox is None:
        ys, xs = np.where(binary > 0)
        if len(xs) == 0:
            return 0, 0, w, h
        x0, x1 = int(xs.min()), int(xs.max()) + 1
        y0, y1 = int(ys.min()), int(ys.max()) + 1
        bbox = (x0, y0, max(1, x1 - x0), max(1, y1 - y0))

    x, y, bw, bh = bbox
    if pad_px > 0:
        x = max(0, x - pad_px)
        y = max(0, y - pad_px)
        bw = min(w - x, bw + 2 * pad_px)
        bh = min(h - y, bh + 2 * pad_px)
    return x, y, max(1, bw), max(1, bh)


def foreground_bbox(
    alpha: np.ndarray,
    *,
    thresh: float = 0.5,
    pad_ratio: float = 0.02,
) -> tuple[int, int, int, int]:
    """
    Compat: bbox a partir só da alpha (sem contornos).
    Preferir container_bbox_from_contours no pipeline novo.
    """
    h, w = alpha.shape[:2]
    m = (alpha >= thresh).astype(np.uint8)
    ys, xs = np.where(m > 0)
    if len(xs) == 0:
        return 0, 0, w, h

    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    bw, bh = max(1, x1 - x0), max(1, y1 - y0)
    pad = int(round(max(w, h) * pad_ratio))
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(w, x1 + pad)
    y1 = min(h, y1 + pad)
    return x0, y0, max(1, x1 - x0), max(1, y1 - y0)
