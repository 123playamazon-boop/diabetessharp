"""
Inpainting via Replicate (SDXL ou modelo configurável) quando REPLICATE_API_TOKEN está definido.
Caso contrário devolve None para o chamador usar a heurística OpenCV.
"""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING

import cv2
import numpy as np
import urllib.request

from app.image_decode import decode_bgr

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

DEFAULT_INPAINT_PROMPT = (
    "clear plastic container filled with nuts, transparent PET plastic, "
    "natural reflections and highlights, seamless fill, photorealistic, studio lighting"
)


def _download_image(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "mockup-pipeline/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def inpaint_with_replicate(
    bgr: np.ndarray,
    mask_255: np.ndarray,
    *,
    prompt: str | None = None,
) -> np.ndarray | None:
    """
    mask_255: 255 = área a preencher (rótulo antigo).
    None se token em falta, dependência em falta ou falha da API.
    """
    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not token:
        return None

    try:
        import replicate  # type: ignore
    except ImportError:
        logger.warning("replicate não instalado; instale com: pip install replicate")
        return None

    model = os.environ.get(
        "REPLICATE_INPAINT_MODEL",
        "zsxkib/flux-dev-inpainting",
    ).strip()
    p = prompt or os.environ.get("REPLICATE_INPAINT_PROMPT", DEFAULT_INPAINT_PROMPT)

    ok_i, enc_i = cv2.imencode(".png", bgr)
    ok_m, enc_m = cv2.imencode(".png", mask_255)
    if not ok_i or not ok_m:
        return None

    tmp = Path(tempfile.mkdtemp(prefix="inpaint_"))
    img_path = tmp / "in.png"
    mask_path = tmp / "mask.png"
    try:
        img_path.write_bytes(enc_i.tobytes())
        mask_path.write_bytes(enc_m.tobytes())

        os.environ["REPLICATE_API_TOKEN"] = token
        with open(img_path, "rb") as fi, open(mask_path, "rb") as fm:
            raw_in: dict = {
                "image": fi,
                "mask": fm,
                "prompt": p,
            }
            if os.environ.get("REPLICATE_INPAINT_NEGATIVE_PROMPT"):
                raw_in["negative_prompt"] = os.environ["REPLICATE_INPAINT_NEGATIVE_PROMPT"]
            steps = os.environ.get("REPLICATE_INPAINT_STEPS")
            if steps and steps.isdigit():
                raw_in["num_inference_steps"] = int(steps)
            strength = os.environ.get("REPLICATE_INPAINT_STRENGTH")
            if strength:
                try:
                    raw_in["strength"] = float(strength)
                except ValueError:
                    pass

            out = replicate.run(model, input=raw_in)

        url: str | None = None
        if isinstance(out, str):
            url = out
        elif isinstance(out, list) and len(out) > 0:
            first = out[0]
            url = first if isinstance(first, str) else getattr(first, "url", None) or str(first)

        if not url:
            logger.warning("Resposta inesperada do Replicate: %r", out)
            return None

        data = _download_image(url)
        result_bgr = decode_bgr(data)
        if result_bgr.shape[:2] != bgr.shape[:2]:
            result_bgr = cv2.resize(result_bgr, (bgr.shape[1], bgr.shape[0]), interpolation=cv2.INTER_LANCZOS4)
        return result_bgr
    except Exception as e:
        logger.warning("Inpainting Replicate falhou: %s", e)
        return None
    finally:
        for f in (img_path, mask_path):
            try:
                f.unlink(missing_ok=True)
            except OSError:
                pass
        try:
            tmp.rmdir()
        except OSError:
            pass


def clean_old_label_smart(bgr: np.ndarray, mask: np.ndarray | None) -> np.ndarray:
    """
    Tenta Replicate com máscara; se mask None ou API falhar, usa remove_store_label_heuristic.
    """
    from app.clean_old_label import remove_store_label_heuristic

    if mask is not None and np.count_nonzero(mask) > 50:
        rep = inpaint_with_replicate(bgr, mask)
        if rep is not None:
            return rep
    return remove_store_label_heuristic(bgr)
