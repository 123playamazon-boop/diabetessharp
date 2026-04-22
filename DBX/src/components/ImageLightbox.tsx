import { useEffect } from "react";

/** Zoom em ecrã inteiro — clique fora ou Escape para fechar. */
export function ImageLightbox({ src, alt = "", onClose }: { src: string; alt?: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-950/85 backdrop-blur-[2px]"
        aria-label="Fechar"
        onClick={onClose}
      />
      <img
        src={src}
        alt={alt}
        className="relative z-[1] max-h-[min(92vh,900px)] max-w-[min(96vw,900px)] rounded-xl border border-white/20 object-contain shadow-2xl"
      />
    </div>
  );
}
