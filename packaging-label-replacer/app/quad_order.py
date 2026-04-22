"""Ordenação estável dos 4 cantos para homografia (evita 'bowtie' e área preta)."""

from __future__ import annotations

import numpy as np
import cv2


def _convex_ccw(pts: np.ndarray) -> bool:
    """pts (4,2) em ordem ao redor do perímetro; True se convexo (todos os produtos vetoriais mesmo sinal)."""
    cross = []
    for i in range(4):
        a = pts[i]
        b = pts[(i + 1) % 4]
        c = pts[(i + 2) % 4]
        v1 = b - a
        v2 = c - b
        cross.append(v1[0] * v2[1] - v1[1] * v2[0])
    if not cross:
        return False
    s = [np.sign(x) for x in cross if abs(x) > 1e-6]
    if not s:
        return True
    return all(t >= 0 for t in s) or all(t <= 0 for t in s)


def normalize_dst_corners(
    corners: list[tuple[float, float]],
    label_w: int,
    label_h: int,
) -> np.ndarray:
    """
    Reordena os 4 pontos para corresponder a TL, TR, BR, BL da arte no plano da foto,
    evitando ordem que gera homografia invertida (amostragem fora do PNG = preto).
    """
    if label_w < 1 or label_h < 1:
        raise ValueError("Dimensões do rótulo inválidas.")

    P = np.array(corners, dtype=np.float32)
    src = np.array(
        [[0, 0], [label_w, 0], [label_w, label_h], [0, label_h]],
        dtype=np.float32,
    )

    c = P.mean(axis=0)
    ang = np.arctan2(P[:, 1] - c[1], P[:, 0] - c[0])
    order = np.argsort(ang)
    base = P[order]

    candidates: list[np.ndarray] = []
    for k in range(4):
        candidates.append(np.roll(base, k, axis=0))
        candidates.append(np.roll(base[::-1].copy(), k, axis=0))

    best = None
    best_score = -1.0

    for rolled in candidates:
        if not _convex_ccw(rolled):
            continue
        try:
            M = cv2.getPerspectiveTransform(src, rolled)
            Minv = np.linalg.inv(M)
        except (cv2.error, np.linalg.LinAlgError):
            continue

        xh, yh = rolled[:, 0], rolled[:, 1]
        xmin, xmax = float(xh.min()), float(xh.max())
        ymin, ymax = float(yh.min()), float(yh.max())
        poly = rolled.reshape(-1, 1, 2).astype(np.float32)

        inside = 0
        score_inside = 0
        for i in range(24):
            for j in range(24):
                t = (i + 0.5) / 24
                u = (j + 0.5) / 24
                ix = xmin + t * (xmax - xmin)
                iy = ymin + u * (ymax - ymin)
                if cv2.pointPolygonTest(poly, (ix, iy), False) < 0:
                    continue
                score_inside += 1
                p = np.array([[[ix, iy]]], dtype=np.float32)
                lab = cv2.perspectiveTransform(p, Minv)[0, 0]
                if 0 <= lab[0] < label_w and 0 <= lab[1] < label_h:
                    inside += 1

        if score_inside == 0:
            continue
        score = inside / score_inside
        if score > best_score:
            best_score = score
            best = rolled

    if best is not None:
        return best

    return P.astype(np.float32)
