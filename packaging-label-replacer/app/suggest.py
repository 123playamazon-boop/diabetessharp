"""Heuristic detection of a saturated (color) label region — experimental."""

from __future__ import annotations

import numpy as np
import cv2

from app.image_decode import decode_bgr


def _read_bgr(data: bytes) -> np.ndarray:
    try:
        return decode_bgr(data)
    except Exception as e:
        raise ValueError("Não foi possível decodificar a imagem.") from e


def _plausible_front_label_quad(pts: list[tuple[float, float]], fw: int, fh: int) -> bool:
    """Rejeita quads que cobrem quase a foto ou estão colados a uma lateral (ex. blob de frutos)."""
    if len(pts) != 4:
        return False
    arr = np.array(pts, dtype=np.float32).reshape(-1, 1, 2)
    a = abs(cv2.contourArea(arr))
    if a < 0.006 * fw * fh or a > 0.52 * fw * fh:
        return False
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    cx = float(np.mean(xs))
    cy = float(np.mean(ys))
    if cx < 0.28 * fw or cx > 0.72 * fw:
        return False
    if cy < 0.12 * fh or cy > 0.88 * fh:
        return False
    wbb = max(xs) - min(xs)
    hbb = max(ys) - min(ys)
    # Tarja vertical (Publix) pode ocupar quase toda a altura da frente do pote.
    if wbb > 0.62 * fw or hbb > 0.92 * fh:
        return False
    return True


def _quad_from_contour(c: np.ndarray, scale_x: float, scale_y: float) -> list[tuple[float, float]] | None:
    peri = cv2.arcLength(c, True)
    if peri < 20:
        return None
    for eps in (0.02, 0.03, 0.04, 0.05):
        approx = cv2.approxPolyDP(c, eps * peri, True)
        if len(approx) == 4:
            pts = approx.reshape(4, 2).astype(np.float32)
            return [(float(x * scale_x), float(y * scale_y)) for x, y in pts]
    rect = cv2.minAreaRect(c)
    box = cv2.boxPoints(rect).astype(np.float32)
    return [(float(x * scale_x), float(y * scale_y)) for x, y in box]


def suggest_white_label_corners(package_bytes: bytes) -> list[tuple[float, float]] | None:
    """Rótulo claro na tampa / fundo branco (alto valor em escala de cinza)."""
    full = _read_bgr(package_bytes)
    fh, fw = full.shape[:2]
    max_edge = 1400
    r = min(1.0, max_edge / max(fh, fw))
    sw, sh = int(round(fw * r)), int(round(fh * r))
    small = cv2.resize(full, (sw, sh), interpolation=cv2.INTER_AREA)

    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (9, 9), 0)
    _, mask = cv2.threshold(blur, 195, 255, cv2.THRESH_BINARY)

    k = max(5, int(round(min(sw, sh) * 0.014)))
    if k % 2 == 0:
        k += 1
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k, k))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    area_img = float(sw * sh)
    best = None
    best_area = 0.0
    for c in contours:
        a = cv2.contourArea(c)
        if a < 0.012 * area_img or a > 0.65 * area_img:
            continue
        if a > best_area:
            best_area = a
            best = c

    if best is None:
        return None

    scale_x = fw / sw
    scale_y = fh / sh
    q = _quad_from_contour(best, scale_x, scale_y)
    if q and _plausible_front_label_quad(q, fw, fh):
        return q
    return None


def suggest_saturated_label_corners(package_bytes: bytes) -> list[tuple[float, float]] | None:
    """
    Finds the largest high-saturation blob (works for many colored labels, not plain white paper).
    Returns None if nothing plausible is found.
    """
    full = _read_bgr(package_bytes)
    fh, fw = full.shape[:2]
    max_edge = 1400
    r = min(1.0, max_edge / max(fh, fw))
    sw, sh = int(round(fw * r)), int(round(fh * r))
    small = cv2.resize(full, (sw, sh), interpolation=cv2.INTER_AREA)

    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    s_ch = hsv[:, :, 1].astype(np.float32)
    v_ch = hsv[:, :, 2].astype(np.float32)
    # Colorful label vs pale background / plastic
    mask = ((s_ch > 28) & (v_ch > 35) & (v_ch < 252)).astype(np.uint8) * 255

    k = max(7, int(round(min(sw, sh) * 0.012)))
    if k % 2 == 0:
        k += 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    area_img = float(sw * sh)
    best = None
    best_area = 0.0
    for c in contours:
        a = cv2.contourArea(c)
        if a < 0.015 * area_img or a > 0.92 * area_img:
            continue
        if a > best_area:
            best_area = a
            best = c

    if best is None:
        return None

    scale_x = fw / sw
    scale_y = fh / sh
    q = _quad_from_contour(best, scale_x, scale_y)
    if q and _plausible_front_label_quad(q, fw, fh):
        return q
    return None


def suggest_vertical_front_label_corners(package_bytes: bytes) -> list[tuple[float, float]] | None:
    """
    Tarja / rótulo vertical na frente do pote (clamshell, Publix, etc.).
    Evita usar o maior blob branco (fundo ou tampa inteira), que distorce o warp.
    """
    full = _read_bgr(package_bytes)
    fh, fw = full.shape[:2]
    max_edge = 1400
    r = min(1.0, max_edge / max(fh, fw))
    sw, sh = int(round(fw * r)), int(round(fh * r))
    small = cv2.resize(full, (sw, sh), interpolation=cv2.INTER_AREA)

    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    s_ch = hsv[:, :, 1]
    b, g, r = cv2.split(small)
    mx = cv2.max(cv2.max(b, g), r)
    mn = cv2.min(cv2.min(b, g), r)
    spread = (mx.astype(np.int16) - mn.astype(np.int16)).astype(np.uint8)
    neutral = spread < 16
    # Fundo estúdio ~240 com spread ~10 não entra; tarja branca ~248 sim.
    very_white = (mx > 245) & neutral & (s_ch < 60)
    fine_neutral = (mx > 238) & (spread <= 6) & (s_ch < 24)
    paper = ((very_white | fine_neutral).astype(np.uint8)) * 255

    roi = np.zeros((sh, sw), dtype=np.uint8)
    roi[int(0.08 * sh) : int(0.92 * sh), int(0.20 * sw) : int(0.80 * sw)] = 255
    bright = cv2.bitwise_and(paper, roi)

    kv = cv2.getStructuringElement(cv2.MORPH_RECT, (5, max(17, sh // 22)))
    bright = cv2.morphologyEx(bright, cv2.MORPH_CLOSE, kv)

    contours, _ = cv2.findContours(bright, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    area_img = float(sw * sh)
    cx_img = 0.5 * sw
    best = None
    best_score = -1.0

    for c in contours:
        a = cv2.contourArea(c)
        if a < 0.012 * area_img or a > 0.55 * area_img:
            continue
        x, y, bw, bh = cv2.boundingRect(c)
        cxc = x + bw * 0.5
        ar = bh / max(bw, 1)
        if ar < 0.95 or bw > 0.52 * sw:
            continue
        if abs(cxc - cx_img) > 0.22 * sw:
            continue
        # Preferir tarja alta e estreita (frente do pote), não manchas largas no topo.
        score = ar * min(bh / sh, 0.95) * (1.0 - bw / sw)
        if score > best_score:
            best_score = score
            best = c

    if best is None:
        return None

    scale_x = fw / sw
    scale_y = fh / sh
    q = _quad_from_contour(best, scale_x, scale_y)
    if q and _plausible_front_label_quad(q, fw, fh):
        return q
    return None


def suggest_label_corners(package_bytes: bytes) -> list[tuple[float, float]] | None:
    """Tarja vertical frontal primeiro; senão tampa branca; senão região colorida."""
    v = suggest_vertical_front_label_corners(package_bytes)
    if v:
        return v
    w = suggest_white_label_corners(package_bytes)
    if w:
        return w
    return suggest_saturated_label_corners(package_bytes)


def fallback_center_quad(package_bytes: bytes) -> list[tuple[float, float]]:
    """Retângulo vertical centrado — típico de pote clamshell com rótulo na frente."""
    img = _read_bgr(package_bytes)
    ph, pw = img.shape[:2]
    cx, cy = pw * 0.5, ph * 0.48
    ww, hh = pw * 0.30, ph * 0.42
    return [
        (cx - ww / 2, cy - hh / 2),
        (cx + ww / 2, cy - hh / 2),
        (cx + ww / 2, cy + hh / 2),
        (cx - ww / 2, cy + hh / 2),
    ]
