"""Colagem plana do rótulo (sem rotação nem homografia) com alpha compositing via PIL."""

from __future__ import annotations

from typing import Literal

import cv2
import numpy as np
from PIL import Image

from app.clean_old_label import remove_store_label_heuristic
from app.image_decode import decode_bgr_alpha
from app.label_placement import placement_rect_full_label, placement_rect_wrap_bottom
from app.package_bbox import container_bbox_from_contours
_ANTIALIAS_SIGMA = 0.35
# 0 = face estritamente plana; valores ~0.01–0.015 = barril horizontal muito leve na arte.
_DEFAULT_BARREL = 0.0


def _subtle_horizontal_barrel(
    bgr: np.ndarray,
    alpha: np.ndarray | None,
    strength: float,
) -> tuple[np.ndarray, np.ndarray]:
    """Correção muito subtil em barril horizontal só na arte (face plana no produto)."""
    if strength <= 0:
        if alpha is None:
            alpha = np.ones((bgr.shape[0], bgr.shape[1]), dtype=np.float32)
        return bgr, alpha.astype(np.float32)

    h, w = bgr.shape[:2]
    mx, my = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    cx = (w - 1) * 0.5
    nx = (mx - cx) / max(cx, 1e-6)
    nx2 = np.clip(nx * nx, 0.0, 1.0)
    scale = 1.0 + strength * (1.0 - nx2)
    map_x = np.clip(cx + (mx - cx) * scale, 0, w - 1).astype(np.float32)
    map_y = my.astype(np.float32)
    out_b = cv2.remap(bgr, map_x, map_y, cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
    if alpha is None:
        ao = np.ones((h, w), dtype=np.float32)
    else:
        ao = cv2.remap(alpha.astype(np.float32), map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return out_b, np.clip(ao, 0.0, 1.0)


def apply_label_flat(
    package_bytes: bytes,
    label_bytes: bytes,
    x: int,
    y: int,
    w: int,
    h: int,
    *,
    skip_store_label_clean: bool = True,
    label_matte_black: bool = False,
    subtle_barrel_strength: float = _DEFAULT_BARREL,
) -> bytes:
    """
    Sobreposição plana (ângulo 0): cola o rótulo por cima da foto (incluindo rótulo branco da loja).

    Por defeito **não** apaga o rótulo antigo (inpainting) — `skip_store_label_clean=True`.
    Para tentar remover o rótulo da loja antes, passe `skip_store_label_clean=False`.
    """
    if w < 1 or h < 1:
        raise ValueError("Dimensões do retângulo do rótulo inválidas.")

    pkg_bgr, _ = decode_bgr_alpha(package_bytes)
    if not skip_store_label_clean:
        pkg_bgr = remove_store_label_heuristic(pkg_bgr)
    ph, pw = pkg_bgr.shape[:2]

    x = max(0, min(int(x), pw - 1))
    y = max(0, min(int(y), ph - 1))
    w = max(1, min(int(w), pw - x))
    h = max(1, min(int(h), ph - y))

    lbl_bgr, lbl_alpha = decode_bgr_alpha(
        label_bytes, matte_black_background=label_matte_black
    )
    lbl_bgr = cv2.resize(lbl_bgr, (w, h), interpolation=cv2.INTER_LANCZOS4)
    if lbl_alpha is not None:
        lbl_alpha = cv2.resize(lbl_alpha, (w, h), interpolation=cv2.INTER_LINEAR)
    else:
        lbl_alpha = np.ones((h, w), dtype=np.float32)

    lbl_bgr, lbl_alpha = _subtle_horizontal_barrel(
        lbl_bgr, lbl_alpha, subtle_barrel_strength
    )

    a = np.clip(lbl_alpha, 0.0, 1.0).astype(np.float32)
    if _ANTIALIAS_SIGMA > 0:
        k = max(3, int(round(_ANTIALIAS_SIGMA * 6)) | 1)
        a = cv2.GaussianBlur(a, (k, k), _ANTIALIAS_SIGMA)

    base_rgb = cv2.cvtColor(pkg_bgr, cv2.COLOR_BGR2RGB)
    lbl_rgb = cv2.cvtColor(lbl_bgr, cv2.COLOR_BGR2RGB)

    base_pil = Image.fromarray(base_rgb).convert("RGBA")
    lbl_pil = Image.fromarray(lbl_rgb).convert("RGBA")
    alpha_u8 = np.clip(a * 255.0, 0, 255).astype(np.uint8)
    lbl_pil.putalpha(Image.fromarray(alpha_u8, mode="L"))

    base_pil.paste(lbl_pil, (x, y), lbl_pil)

    out_rgb = np.array(base_pil.convert("RGB"))
    out_bgr = cv2.cvtColor(out_rgb, cv2.COLOR_RGB2BGR)
    # Não aplicar CLAHE/nitidez global aqui: em fundo branco + plástico gera artefactos
    # (halos, “X”/polígonos claros) e reforça borrões do inpainting. O export usa finalize_export_bgr.

    ok, buf = cv2.imencode(".png", out_bgr, [cv2.IMWRITE_PNG_COMPRESSION, 3])
    if not ok:
        raise RuntimeError("Falha ao codificar PNG.")
    return buf.tobytes()


def apply_label(
    package_bytes: bytes,
    label_bytes: bytes,
    corners: list[tuple[float, float]] | None = None,
    *,
    placement: Literal["wrap", "full"] = "full",
    skip_store_label_clean: bool = True,
    label_matte_black: bool = False,
    label_edge_shadow: float = 0.0,
    subtle_barrel_strength: float = _DEFAULT_BARREL,
) -> bytes:
    """
    Coloca o rótulo com base no bbox do contentor (contornos), não nos cantos.

    - placement=\"full\": largura 85% do contentor, centrado em X e Y.
    - placement=\"wrap\": largura 90% do contentor, base a 5 px do fundo da face.

    Por defeito não corre inpainting do rótulo da loja — só sobrepõe o PNG novo.

    `corners` é opcional (API antiga); se passado, tem de ter 4 pontos mas é ignorado
    para tamanho/posição. `label_edge_shadow` ignorado.
    """
    if corners is not None and len(corners) != 4:
        raise ValueError("São necessários exatamente 4 cantos.")

    pkg_bgr, pkg_alpha = decode_bgr_alpha(package_bytes)
    if not skip_store_label_clean:
        pkg_bgr = remove_store_label_heuristic(pkg_bgr)
    ph, pw = pkg_bgr.shape[:2]
    bbox = container_bbox_from_contours(pkg_bgr, pkg_alpha)

    lbl_bgr, _ = decode_bgr_alpha(
        label_bytes, matte_black_background=label_matte_black
    )
    label_h, label_w = lbl_bgr.shape[:2]

    if placement == "wrap":
        x, y, w, h = placement_rect_wrap_bottom(bbox, label_w, label_h, pw, ph)
    else:
        x, y, w, h = placement_rect_full_label(bbox, label_w, label_h, pw, ph)

    ok, enc = cv2.imencode(".png", pkg_bgr, [cv2.IMWRITE_PNG_COMPRESSION, 3])
    if not ok:
        raise RuntimeError("Falha ao preparar imagem.")
    return apply_label_flat(
        enc.tobytes(),
        label_bytes,
        x,
        y,
        w,
        h,
        skip_store_label_clean=True,
        label_matte_black=label_matte_black,
        subtle_barrel_strength=subtle_barrel_strength,
    )
