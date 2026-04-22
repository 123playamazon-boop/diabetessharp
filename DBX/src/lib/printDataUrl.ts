/**
 * Abre PDF ou imagem (data URL) num separador para visualização — sem diálogo de impressão.
 * Usa blob URL (o mesmo truque que `printDataUrlInNewWindow`) porque `window.open(data:…)` falha em vários browsers.
 */
export function openDataUrlInNewWindow(dataUrl: string, title = "Etiqueta"): void {
  const safeTitle = title.replace(/</g, "").slice(0, 80);
  void (async () => {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const objUrl = URL.createObjectURL(blob);
      const isPdf = blob.type === "application/pdf" || dataUrl.startsWith("data:application/pdf");
      const w = window.open("", "_blank", "noopener,noreferrer,width=960,height=1200");
      if (!w) {
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = /\.pdf$/i.test(safeTitle) ? safeTitle : `${safeTitle}.pdf`;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(objUrl), 120_000);
        return;
      }
      w.document.open();
      if (isPdf) {
        w.document.write(
          `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${safeTitle}</title>` +
            `<style>html,body{height:100%;margin:0}iframe{border:0;width:100%;height:100%}</style></head><body>` +
            `<iframe src="${objUrl}"></iframe></body></html>`,
        );
      } else {
        w.document.write(
          `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${safeTitle}</title>` +
            `<style>body{margin:0;display:flex;justify-content:center;align-items:flex-start;background:#f4f4f5}img{max-width:100%;height:auto}</style></head><body>` +
            `<img src="${objUrl}" alt=""/></body></html>`,
        );
      }
      w.document.close();
      w.addEventListener("beforeunload", () => URL.revokeObjectURL(objUrl));
    } catch {
      window.open(dataUrl, "_blank", "noopener,noreferrer");
    }
  })();
}

/** Abre janela para o utilizador imprimir PDF ou imagem (data URL). Usa blob URL — mais fiável que `<embed>` com data URL em alguns browsers. */
export function printDataUrlInNewWindow(dataUrl: string, title = "Etiqueta"): void {
  const safeTitle = title.replace(/</g, "").slice(0, 80);
  void (async () => {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const objUrl = URL.createObjectURL(blob);
      const isPdf = blob.type === "application/pdf" || dataUrl.startsWith("data:application/pdf");
      const w = window.open("", "_blank", "noopener,noreferrer,width=960,height=1200");
      if (!w) {
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = /\.pdf$/i.test(safeTitle) ? safeTitle : `${safeTitle}.pdf`;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(objUrl), 120_000);
        return;
      }
      w.document.open();
      if (isPdf) {
        w.document.write(
          `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${safeTitle}</title>` +
            `<style>html,body{height:100%;margin:0}iframe{border:0;width:100%;height:100%}</style></head><body>` +
            `<iframe src="${objUrl}"></iframe>` +
            `<script>addEventListener("load",function(){setTimeout(function(){try{focus();print()}catch(e){}},600)})` +
            `<\/script></body></html>`,
        );
      } else {
        w.document.write(
          `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${safeTitle}</title>` +
            `<style>body{margin:0;display:flex;justify-content:center;align-items:flex-start;background:#f4f4f5}img{max-width:100%;height:auto}</style></head><body>` +
            `<img src="${objUrl}" alt="" onload="setTimeout(function(){try{print()}catch(e){}},400)"/>` +
            `</body></html>`,
        );
      }
      w.document.close();
      w.addEventListener("beforeunload", () => URL.revokeObjectURL(objUrl));
    } catch {
      window.open(dataUrl, "_blank", "noopener,noreferrer");
    }
  })();
}
