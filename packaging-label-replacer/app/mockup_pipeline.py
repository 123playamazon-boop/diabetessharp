"""
Pipeline automatizado: fundo branco (rembg) → cola o rótulo novo **por cima** da foto
(sem apagar o rótulo branco da loja — evita borrões do inpainting) → export (mockups + pós-processamento).

CLI (a partir da pasta packaging-label-replacer):
  python -m app.mockup_pipeline foto.jpg wrap.png full.png
  python -m app.mockup_pipeline foto.jpg wrap.png full.png -o ./output
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import cv2
import numpy as np

from app.export_enhance import finalize_export_bgr, save_bgr_png_print_ready
from app.image_decode import decode_bgr_alpha
from app.label_placement import placement_rect_full_label, placement_rect_wrap_bottom
from app.label_warp import apply_label_flat
from app.package_bbox import container_bbox_from_contours
from app.white_background import remove_background_white_bgr

logger = logging.getLogger(__name__)


def _encode_png(bgr: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", bgr, [cv2.IMWRITE_PNG_COMPRESSION, 3])
    if not ok:
        raise RuntimeError("Falha ao codificar PNG.")
    return buf.tobytes()


def _label_size(label_bytes: bytes) -> tuple[int, int]:
    bgr, _ = decode_bgr_alpha(label_bytes)
    h, w = bgr.shape[:2]
    return w, h


def render_mockup_pair(
    package_bytes: bytes,
    wrap_label_bytes: bytes,
    full_label_bytes: bytes,
    *,
    skip_rembg: bool = False,
    min_export_side: int = 2000,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Devolve (BGR amazon_cover, BGR delivery_photo) após export finalize (≥2000×2000,
    unsharp no rótulo, sombra, realce, prontos para PNG 300 DPI).
    """
    if skip_rembg:
        bgr, alpha_extra = decode_bgr_alpha(package_bytes)
        if alpha_extra is None:
            fg_alpha = np.ones((bgr.shape[0], bgr.shape[1]), dtype=np.float32)
        else:
            white = np.full_like(bgr, 255, dtype=np.float32)
            fg = bgr.astype(np.float32)
            a = np.clip(alpha_extra, 0.0, 1.0)[:, :, np.newaxis]
            composed = fg * a + white * (1.0 - a)
            bgr = np.clip(composed, 0, 255).astype(np.uint8)
            fg_alpha = np.clip(alpha_extra, 0.0, 1.0).astype(np.float32)
    else:
        bgr, fg_alpha = remove_background_white_bgr(package_bytes)

    ph, pw = bgr.shape[:2]
    bbox = container_bbox_from_contours(bgr, fg_alpha)
    lw_w, lw_h = _label_size(wrap_label_bytes)
    lf_w, lf_h = _label_size(full_label_bytes)

    rx_a, ry_a, rw_a, rh_a = placement_rect_wrap_bottom(
        bbox, lw_w, lw_h, pw, ph
    )
    rx_d, ry_d, rw_d, rh_d = placement_rect_full_label(
        bbox, lf_w, lf_h, pw, ph
    )

    pkg_bytes = _encode_png(bgr)

    png_amazon = apply_label_flat(
        pkg_bytes,
        wrap_label_bytes,
        rx_a,
        ry_a,
        rw_a,
        rh_a,
        skip_store_label_clean=True,
        label_matte_black=True,
    )
    png_delivery = apply_label_flat(
        pkg_bytes,
        full_label_bytes,
        rx_d,
        ry_d,
        rw_d,
        rh_d,
        skip_store_label_clean=True,
        label_matte_black=True,
    )

    def _post(png: bytes, label_xywh: tuple[int, int, int, int]) -> np.ndarray:
        out_bgr, _ = decode_bgr_alpha(png)
        hh, ww = out_bgr.shape[:2]
        if fg_alpha.shape[:2] != (hh, ww):
            fa = cv2.resize(fg_alpha, (ww, hh), interpolation=cv2.INTER_LINEAR)
        else:
            fa = fg_alpha
        return finalize_export_bgr(
            out_bgr,
            label_xywh,
            fa,
            min_w=min_export_side,
            min_h=min_export_side,
        )

    final_amazon = _post(png_amazon, (rx_a, ry_a, rw_a, rh_a))
    final_delivery = _post(png_delivery, (rx_d, ry_d, rw_d, rh_d))
    return final_amazon, final_delivery


def run_mockup_pipeline(
    package_bytes: bytes,
    wrap_label_bytes: bytes,
    full_label_bytes: bytes,
    *,
    output_dir: Path,
    stem: str,
    skip_rembg: bool = False,
    min_export_side: int = 2000,
) -> tuple[Path, Path]:
    """Grava {stem}_amazon_cover.png e {stem}_delivery_photo.png em output_dir."""
    output_dir.mkdir(parents=True, exist_ok=True)
    final_amazon, final_delivery = render_mockup_pair(
        package_bytes,
        wrap_label_bytes,
        full_label_bytes,
        skip_rembg=skip_rembg,
        min_export_side=min_export_side,
    )
    path_amazon = output_dir / f"{stem}_amazon_cover.png"
    path_delivery = output_dir / f"{stem}_delivery_photo.png"
    save_bgr_png_print_ready(final_amazon, path_amazon)
    save_bgr_png_print_ready(final_delivery, path_delivery)
    return path_amazon, path_delivery


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    p = argparse.ArgumentParser(
        description="Mockup Amazon: fundo branco, rótulo novo (wrap + entrega), output com sufixos do PDF.",
    )
    p.add_argument("package", type=Path, help="Foto da embalagem (JPG/PNG)")
    p.add_argument("wrap_label", type=Path, help="PNG wrap recortado (parte inferior)")
    p.add_argument("full_label", type=Path, help="PNG rótulo grande / face frontal")
    p.add_argument(
        "-o",
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "output",
        help="Pasta de saída (default: packaging-label-replacer/output)",
    )
    p.add_argument(
        "--skip-rembg",
        action="store_true",
        help="Não usar rembg (útil se a foto já tiver fundo branco ou alpha).",
    )
    p.add_argument(
        "--min-side",
        type=int,
        default=2000,
        help="Lado mínimo (px) após upscale (default: 2000).",
    )
    args = p.parse_args(argv)

    for path, name in (
        (args.package, "foto"),
        (args.wrap_label, "wrap"),
        (args.full_label, "rótulo grande"),
    ):
        if not path.is_file():
            logger.error("Ficheiro %s não encontrado: %s", name, path)
            return 1

    pkg = args.package.read_bytes()
    wrap = args.wrap_label.read_bytes()
    full = args.full_label.read_bytes()
    stem = args.package.stem

    try:
        a, d = run_mockup_pipeline(
            pkg,
            wrap,
            full,
            output_dir=args.output_dir.resolve(),
            stem=stem,
            skip_rembg=args.skip_rembg,
            min_export_side=args.min_side,
        )
    except Exception as e:
        logger.exception("Pipeline falhou: %s", e)
        return 1

    logger.info("Escrito: %s", a)
    logger.info("Escrito: %s", d)
    return 0


if __name__ == "__main__":
    sys.exit(main())
