"""
Retângulos destino (sem perspetiva), alinhados ao bbox do contentor.

Wrap (faixa inferior): 90% da largura, base a 5 px do fundo da face.
Full (frente): 85% da largura, centrado em X e Y.
"""

from __future__ import annotations

WRAP_WIDTH_FRAC = 0.90
FULL_WIDTH_FRAC = 0.85
WRAP_BOTTOM_PAD_PX = 5


def _clamp_rect(
    x: int,
    y: int,
    tw: int,
    th: int,
    frame_w: int,
    frame_h: int,
) -> tuple[int, int, int, int]:
    tw = max(1, tw)
    th = max(1, th)
    x = max(0, min(x, frame_w - 1))
    y = max(0, min(y, frame_h - 1))
    if x + tw > frame_w:
        tw = max(1, frame_w - x)
    if y + th > frame_h:
        th = max(1, frame_h - y)
    return x, y, tw, th


def placement_rect_full_label(
    bbox: tuple[int, int, int, int],
    original_label_w: int,
    original_label_h: int,
    frame_w: int,
    frame_h: int,
    *,
    width_frac: float = FULL_WIDTH_FRAC,
) -> tuple[int, int, int, int]:
    """
    label_width = int(container_width * 0.85)
    label_height = int(label_width * (original_label_h / original_label_w))
    label_x = container_x + (container_width - label_width) // 2
    label_y = container_y + (container_height - label_height) // 2
    """
    container_x, container_y, container_width, container_height = bbox
    ow = max(1, original_label_w)
    oh = max(1, original_label_h)

    label_width = int(container_width * width_frac)
    label_height = int(label_width * (oh / ow))
    label_x = container_x + (container_width - label_width) // 2
    label_y = container_y + (container_height - label_height) // 2

    return _clamp_rect(label_x, label_y, label_width, label_height, frame_w, frame_h)


def placement_rect_wrap_bottom(
    bbox: tuple[int, int, int, int],
    original_label_w: int,
    original_label_h: int,
    frame_w: int,
    frame_h: int,
    *,
    width_frac: float = WRAP_WIDTH_FRAC,
    bottom_pad_px: int = WRAP_BOTTOM_PAD_PX,
) -> tuple[int, int, int, int]:
    """
    label_width = int(container_width * 0.90)
    label_height = int(label_width * (original_label_h / original_label_w))
    label_x = container_x + (container_width - label_width) // 2
    label_y = container_y + container_height - label_height - 5
    """
    container_x, container_y, container_width, container_height = bbox
    ow = max(1, original_label_w)
    oh = max(1, original_label_h)

    label_width = int(container_width * width_frac)
    label_height = int(label_width * (oh / ow))
    label_x = container_x + (container_width - label_width) // 2
    label_y = container_y + container_height - label_height - bottom_pad_px

    return _clamp_rect(label_x, label_y, label_width, label_height, frame_w, frame_h)
