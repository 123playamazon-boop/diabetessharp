"""
Remove rótulos de loja claros: faixa branca na tampa + tarja vertical (ex.: Publix)
antes de colar o novo rótulo — inpainting OpenCV.
"""

from __future__ import annotations

import cv2
import numpy as np


def _store_label_paper_mask(bgr: np.ndarray, s_ch: np.ndarray, v_ch: np.ndarray) -> np.ndarray:
    """
    Pixels que parecem papel/etiqueta clara, excluindo fundo cinza-claro de estúdio
    (ex.: BGR ~240,235,230 com spread maior que papel impresso).
    """
    b, g, r = cv2.split(bgr)
    mx = cv2.max(cv2.max(b, g), r)
    mn = cv2.min(cv2.min(b, g), r)
    spread = (mx.astype(np.int16) - mn.astype(np.int16)).astype(np.uint8)
    neutral = spread < 14

    # Papel bem branco do rótulo
    strong = (mx > 246) & neutral & (s_ch < 92)
    # Off-white muito neutro (pouca variação entre canais)
    off = (mx > 238) & (spread < 5) & (s_ch < 24)
    # Áreas claras com texto cinza (baixa S, V médio-alto)
    grey_field = (v_ch > 142) & (v_ch < 222) & (s_ch < 48) & neutral

    return (((strong | off | grey_field).astype(np.uint8)) * 255)


def _top_lid_mask_only(bgr: np.ndarray, s_ch: np.ndarray, v_ch: np.ndarray) -> np.ndarray:
    """Só branco/off-white — evita plástico transparente (tons médios) no topo."""
    b, g, r = cv2.split(bgr)
    mx = cv2.max(cv2.max(b, g), r)
    mn = cv2.min(cv2.min(b, g), r)
    spread = (mx.astype(np.int16) - mn.astype(np.int16)).astype(np.uint8)
    neutral = spread < 14
    strong = (mx > 246) & neutral & (s_ch < 92)
    off = (mx > 240) & (spread < 5) & (s_ch < 22)
    return (((strong | off).astype(np.uint8)) * 255)


def _strip_relaxed_paper(bgr: np.ndarray, s_ch: np.ndarray) -> np.ndarray:
    """Na faixa frontal: papel um pouco mais escuro/amarelado que o fundo de estúdio."""
    b, g, r = cv2.split(bgr)
    mx = cv2.max(cv2.max(b, g), r)
    mn = cv2.min(cv2.min(b, g), r)
    spread = (mx.astype(np.int16) - mn.astype(np.int16)).astype(np.uint8)
    neutral = spread < 16
    return (((mx > 228) & neutral & (s_ch < 58)).astype(np.uint8)) * 255


def _vertical_bright_band_mask(bgr: np.ndarray, h: int, w: int) -> np.ndarray:
    """
    Reforço na faixa central: só pixels “papel de rótulo”, não castanhas nem fundo de estúdio.
    """
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    _, s_ch, v_ch = cv2.split(hsv)
    y0, y1 = int(0.06 * h), int(0.93 * h)
    x0, x1 = int(0.26 * w), int(0.74 * w)
    roi = np.zeros((h, w), dtype=np.uint8)
    roi[y0:y1, x0:x1] = 255
    m = cv2.bitwise_or(_strip_relaxed_paper(bgr, s_ch), _store_label_paper_mask(bgr, s_ch, v_ch))
    m = cv2.bitwise_and(m, roi)
    kv = cv2.getStructuringElement(cv2.MORPH_RECT, (7, max(25, h // 18)))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, kv)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    return m


def compute_store_label_inpaint_mask(bgr: np.ndarray) -> np.ndarray | None:
    """
    Máscara 8-bit 0/255: 255 = região do rótulo antigo a preencher (API de inpainting ou OpenCV).
    None se a heurística não deve inpintar (máscara inválida ou cobertura excessiva).
    """
    h, w = bgr.shape[:2]
    if h < 40 or w < 40:
        return None

    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    _, s_ch, v_ch = cv2.split(hsv)
    base = _store_label_paper_mask(bgr, s_ch, v_ch)
    base_top = _top_lid_mask_only(bgr, s_ch, v_ch)
    relaxed_strip = _strip_relaxed_paper(bgr, s_ch)

    focus_top = np.zeros((h, w), dtype=np.uint8)
    y_top = int(h * 0.52)
    focus_top[0:y_top, int(0.22 * w) : int(0.78 * w)] = 255
    m_top = cv2.bitwise_and(base_top, focus_top)

    focus_strip = np.zeros((h, w), dtype=np.uint8)
    y_strip = int(h * 0.94)
    xs0, xs1 = int(0.20 * w), int(0.80 * w)
    focus_strip[0:y_strip, xs0:xs1] = 255
    strip_paper = cv2.bitwise_or(base, relaxed_strip)
    m_strip = cv2.bitwise_and(strip_paper, focus_strip)

    mask = cv2.bitwise_or(m_top, m_strip)

    k_vert = cv2.getStructuringElement(cv2.MORPH_RECT, (5, max(21, h // 20)))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k_vert)
    k_horiz = cv2.getStructuringElement(cv2.MORPH_RECT, (max(15, w // 40), 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k_horiz)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    area_img = float(w * h)
    cx_img = 0.5 * w
    clean = np.zeros_like(mask)

    for c in contours:
        a = cv2.contourArea(c)
        if a < 0.0015 * area_img:
            continue
        x, y, bw, bh = cv2.boundingRect(c)
        cxc = x + bw * 0.5
        cyc = y + bh * 0.5
        ar = bh / max(bw, 1)

        central = abs(cxc - cx_img) < 0.42 * w
        vertical_strip = ar >= 0.92 and bw < 0.50 * w and central
        if a > 0.56 * area_img:
            continue
        if a > 0.40 * area_img and not vertical_strip:
            continue

        top_lump = cyc < h * 0.36 and 0.06 * w < bw < 0.52 * w
        medium_block = (
            a > 0.004 * area_img
            and a < 0.14 * area_img
            and central
            and cyc < h * 0.52
        )

        if vertical_strip or top_lump or medium_block:
            cv2.drawContours(clean, [c], 0, 255, -1)

    band = _vertical_bright_band_mask(bgr, h, w)
    clean = cv2.bitwise_or(clean, band)

    if np.count_nonzero(clean) < 200:
        clean = band

    k_round = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
    clean = cv2.morphologyEx(clean, cv2.MORPH_CLOSE, k_round)
    k_edge = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    clean = cv2.dilate(clean, k_edge, iterations=1)

    cov = np.count_nonzero(clean) / area_img
    if cov > 0.48:
        return None

    return clean


def remove_store_label_heuristic(bgr: np.ndarray) -> np.ndarray:
    h, w = bgr.shape[:2]
    clean = compute_store_label_inpaint_mask(bgr)
    if clean is None:
        return bgr

    # Raio baixo = menos borrão nas castanhas / plástico (INPAINT_NS espalha para fora da máscara).
    radius = int(max(3, min(h, w) // 140))
    radius = min(radius, 8)
    out = cv2.inpaint(bgr, clean, radius, cv2.INPAINT_NS)

    # Segundo inpaint na faixa central costumava borrar o conteúdo visível no plástico.
    return out
