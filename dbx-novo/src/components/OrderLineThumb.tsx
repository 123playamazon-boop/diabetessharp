import { useEffect, useState } from "react";
import type { ClientOrderShipmentLine } from "../types";
import { ImageLightbox } from "./ImageLightbox";
import { amazonImageUrlCandidates, looksLikeAmazonAsin } from "../lib/productImageFallback";

type LineImgStage = "primary" | "asinA" | "asinB" | "placeholder";

export function OrderLineThumb({
  line,
  size = 48,
  zoomable = false,
}: {
  line: ClientOrderShipmentLine;
  size?: 44 | 48 | 56;
  /** Clique para ampliar (equipa no admin). */
  zoomable?: boolean;
}) {
  const tryAmazon = looksLikeAmazonAsin(line.asin);
  const [asinA, asinB] = tryAmazon ? amazonImageUrlCandidates(line.asin) : ["", ""];
  const computeStage = (): LineImgStage => {
    if (line.imageUrl?.trim()) return "primary";
    if (tryAmazon) return "asinA";
    return "placeholder";
  };
  const [stage, setStage] = useState<LineImgStage>(() => computeStage());
  const [zoomOpen, setZoomOpen] = useState(false);
  useEffect(() => {
    setStage(computeStage());
  }, [line.asin, line.imageUrl]);

  const src =
    stage === "primary" && line.imageUrl?.trim()
      ? line.imageUrl.trim()
      : stage === "asinA" && tryAmazon
        ? asinA
        : stage === "asinB" && tryAmazon
          ? asinB
          : null;

  const onError = () => {
    setStage((s) => {
      if (s === "primary") return tryAmazon ? "asinA" : "placeholder";
      if (s === "asinA") return tryAmazon ? "asinB" : "placeholder";
      return "placeholder";
    });
  };

  const px = `${size}px`;
  if (!src) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-[10px] font-bold text-zinc-400"
        style={{ width: px, height: px }}
        title={line.title}
      >
        —
      </div>
    );
  }
  const img = (
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      className={`shrink-0 rounded-xl border border-zinc-200 object-cover ${zoomable ? "cursor-zoom-in transition hover:ring-2 hover:ring-teal-400/80" : ""}`}
      style={{ width: px, height: px }}
      onError={onError}
    />
  );

  if (!zoomable) return img;

  return (
    <>
      <button
        type="button"
        className="shrink-0 rounded-xl p-0 ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        title={line.title}
        onClick={() => setZoomOpen(true)}
      >
        {img}
      </button>
      {zoomOpen ? <ImageLightbox src={src} onClose={() => setZoomOpen(false)} /> : null}
    </>
  );
}
