from __future__ import annotations

import zipfile
from io import BytesIO
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.image_decode import decode_bgr_alpha
from app.label_placement import placement_rect_full_label
from app.label_warp import apply_label_flat
from app.mockup_pipeline import render_mockup_pair
from app.package_bbox import container_bbox_from_contours
from app.export_enhance import bgr_to_png_bytes_print_ready, finalize_export_bgr
from app.white_background import remove_background_white_bgr

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
DEFAULT_LABEL_PATH = STATIC_DIR / "labels" / "official-label.png"

app = FastAPI(title="Rótulo automático na embalagem", version="2.0.0")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
async def root():
    return FileResponse(STATIC_DIR / "index.html")


@app.post("/api/white-bg-preview")
async def api_white_bg_preview(package: UploadFile = File(...)):
    """Foto com fundo branco (rembg), sem rótulo — para pré-visualização interativa."""
    data = await package.read()
    if not data:
        raise HTTPException(status_code=400, detail="Imagem vazia.")
    try:
        bgr, _ = remove_background_white_bgr(data)
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail="Instale rembg: pip install rembg",
        ) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    ok, enc = cv2.imencode(".png", bgr, [cv2.IMWRITE_PNG_COMPRESSION, 3])
    if not ok:
        raise HTTPException(status_code=500, detail="Falha ao codificar PNG.")
    return Response(content=enc.tobytes(), media_type="image/png")


@app.post("/api/suggest-label-rect")
async def api_suggest_label_rect(package: UploadFile = File(...)):
    """Sugestão automática de retângulo do rótulo (px na imagem pós-rembg), igual ao /api/apply-auto."""
    data = await package.read()
    if not data:
        raise HTTPException(status_code=400, detail="Imagem vazia.")
    if not DEFAULT_LABEL_PATH.is_file():
        raise HTTPException(
            status_code=500,
            detail="Coloque o PNG oficial em static/labels/official-label.png",
        )
    lbl_bytes = DEFAULT_LABEL_PATH.read_bytes()
    try:
        bgr, alpha = remove_background_white_bgr(data)
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail="Instale rembg: pip install rembg",
        ) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    ph, pw = bgr.shape[:2]
    bbox = container_bbox_from_contours(bgr, alpha)
    lbl_bgr, _ = decode_bgr_alpha(lbl_bytes)
    lh, lw = lbl_bgr.shape[:2]
    rx, ry, rw, rh = placement_rect_full_label(bbox, lw, lh, pw, ph)
    return JSONResponse({"x": rx, "y": ry, "w": rw, "h": rh, "imageWidth": pw, "imageHeight": ph})


@app.post("/api/compose-label-at")
async def api_compose_label_at(
    package: UploadFile = File(...),
    x: int = Form(...),
    y: int = Form(...),
    w: int = Form(...),
    h: int = Form(...),
):
    """Compõe o rótulo oficial nas coordenadas (px) sobre a imagem com fundo branco."""
    if not DEFAULT_LABEL_PATH.is_file():
        raise HTTPException(
            status_code=500,
            detail="Coloque o PNG oficial em static/labels/official-label.png",
        )
    if w < 1 or h < 1:
        raise HTTPException(status_code=400, detail="Largura e altura devem ser ≥ 1.")
    pkg = await package.read()
    if not pkg:
        raise HTTPException(status_code=400, detail="Imagem vazia.")
    lbl = DEFAULT_LABEL_PATH.read_bytes()
    try:
        bgr, alpha = remove_background_white_bgr(pkg)
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail="Instale rembg: pip install rembg",
        ) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    ph, pw = bgr.shape[:2]
    x = max(0, min(int(x), pw - 1))
    y = max(0, min(int(y), ph - 1))
    w = max(1, min(int(w), pw - x))
    h = max(1, min(int(h), ph - y))
    ok, enc = cv2.imencode(".png", bgr, [cv2.IMWRITE_PNG_COMPRESSION, 3])
    if not ok:
        raise HTTPException(status_code=500, detail="Falha ao preparar imagem.")
    try:
        png = apply_label_flat(
            enc.tobytes(),
            lbl,
            x,
            y,
            w,
            h,
            skip_store_label_clean=True,
            label_matte_black=True,
        )
        bgr_out, _ = decode_bgr_alpha(png)
        hh, ww = bgr_out.shape[:2]
        if alpha.shape[:2] != (hh, ww):
            fa = cv2.resize(alpha.astype(np.float32), (ww, hh), interpolation=cv2.INTER_LINEAR)
        else:
            fa = alpha.astype(np.float32)
        bgr_out = finalize_export_bgr(bgr_out, (x, y, w, h), fa)
        out_bytes = bgr_to_png_bytes_print_ready(bgr_out)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return Response(content=out_bytes, media_type="image/png")


@app.post("/api/apply-auto")
async def api_apply_auto(package: UploadFile = File(...)):
    """
    Foto da embalagem + rótulo em static/labels/official-label.png.
    O rótulo novo é colado por cima da imagem (sem apagar o rótulo branco da loja).
    """
    pkg_bytes = await package.read()
    if not pkg_bytes:
        raise HTTPException(status_code=400, detail="Imagem vazia.")
    if not DEFAULT_LABEL_PATH.is_file():
        raise HTTPException(
            status_code=500,
            detail="Coloque o PNG oficial em static/labels/official-label.png",
        )
    lbl_bytes = DEFAULT_LABEL_PATH.read_bytes()
    try:
        pkg_bgr, pkg_alpha = remove_background_white_bgr(pkg_bytes)
        ph, pw = pkg_bgr.shape[:2]
        bbox = container_bbox_from_contours(pkg_bgr, pkg_alpha)
        lbl_bgr, _ = decode_bgr_alpha(lbl_bytes)
        lh, lw = lbl_bgr.shape[:2]
        rx, ry, rw, rh = placement_rect_full_label(bbox, lw, lh, pw, ph)
        ok, enc = cv2.imencode(".png", pkg_bgr, [cv2.IMWRITE_PNG_COMPRESSION, 3])
        if not ok:
            raise HTTPException(status_code=500, detail="Falha ao preparar a imagem.")
        pkg_png_bytes = enc.tobytes()
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail="Instale rembg: pip install rembg",
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    try:
        png = apply_label_flat(
            pkg_png_bytes,
            lbl_bytes,
            rx,
            ry,
            rw,
            rh,
            skip_store_label_clean=True,
            label_matte_black=True,
        )
        bgr_out, _ = decode_bgr_alpha(png)
        hh, ww = bgr_out.shape[:2]
        if pkg_alpha is not None and pkg_alpha.shape[:2] == (hh, ww):
            fa = pkg_alpha.astype(np.float32)
        else:
            fa = (
                np.ones((hh, ww), dtype=np.float32)
                if pkg_alpha is None
                else cv2.resize(pkg_alpha.astype(np.float32), (ww, hh), interpolation=cv2.INTER_LINEAR)
            )
        bgr_out = finalize_export_bgr(bgr_out, (rx, ry, rw, rh), fa)
        png = bgr_to_png_bytes_print_ready(bgr_out)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return Response(content=png, media_type="image/png")


@app.post("/api/mockup-pair")
async def api_mockup_pair(
    package: UploadFile = File(...),
    wrap_label: UploadFile = File(...),
    full_label: UploadFile = File(...),
):
    """
    Pipeline completo do PDF: dois PNG num ZIP — *_amazon_cover.png e *_delivery_photo.png.
    Form fields: package, wrap_label, full_label.
    """
    pkg_bytes = await package.read()
    wrap_bytes = await wrap_label.read()
    full_bytes = await full_label.read()
    if not pkg_bytes or not wrap_bytes or not full_bytes:
        raise HTTPException(status_code=400, detail="Todos os ficheiros são obrigatórios.")
    stem = Path(package.filename or "pack").stem
    try:
        amazon_bgr, delivery_bgr = render_mockup_pair(pkg_bytes, wrap_bytes, full_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            f"{stem}_amazon_cover.png",
            bgr_to_png_bytes_print_ready(amazon_bgr),
        )
        zf.writestr(
            f"{stem}_delivery_photo.png",
            bgr_to_png_bytes_print_ready(delivery_bgr),
        )
    buf.seek(0)
    zip_name = f"{stem}_mockups.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_name}"'},
    )
