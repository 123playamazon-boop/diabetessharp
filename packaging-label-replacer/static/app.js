(function () {
  const pkgInput = document.getElementById("pkgInput");
  const statusHint = document.getElementById("statusHint");
  const errorHint = document.getElementById("errorHint");
  const editorWrap = document.getElementById("editorWrap");
  const stage = document.getElementById("stage");
  const bgPreview = document.getElementById("bgPreview");
  const labelLayer = document.getElementById("labelLayer");
  const labelDrag = document.getElementById("labelDrag");
  const widthSlider = document.getElementById("widthSlider");
  const widthValue = document.getElementById("widthValue");
  const btnSuggest = document.getElementById("btnSuggest");
  const btnCenter = document.getElementById("btnCenter");
  const btnExport = document.getElementById("btnExport");
  const resultWrap = document.getElementById("resultWrap");
  const resultImg = document.getElementById("resultImg");
  const downloadBtn = document.getElementById("downloadBtn");

  if (!pkgInput || !bgPreview || !labelDrag) {
    console.error("rotulo-app: elementos em falta no HTML");
    return;
  }

  let previewUrl = null;
  let resultUrl = null;
  let currentFile = null;
  let dragState = null;

  function showError(msg) {
    errorHint.hidden = false;
    errorHint.textContent = msg;
  }

  function clearError() {
    errorHint.hidden = true;
    errorHint.textContent = "";
  }

  function formatErr(detail) {
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((d) => (typeof d === "object" && d.msg ? d.msg : String(d))).join("; ");
    }
    return String(detail || "Erro");
  }

  function apiUrl(path) {
    const base = window.location.origin;
    if (!base || base === "null") return path;
    return base.replace(/\/$/, "") + path;
  }

  /** Área da imagem visível (sem letterbox neste layout: img escala só pela largura). */
  function getFitMetrics(img) {
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const cw = img.clientWidth;
    const ch = img.clientHeight;
    return { dw: cw, dh: ch, ox: 0, oy: 0, nw, nh, cw, ch };
  }

  function displayRectToNatural(img, left, top, width, height) {
    const m = getFitMetrics(img);
    const sx = m.nw / m.dw;
    const sy = m.nh / m.dh;
    return {
      x: Math.round((left - m.ox) * sx),
      y: Math.round((top - m.oy) * sy),
      w: Math.round(width * sx),
      h: Math.round(height * sy),
    };
  }

  function naturalRectToDisplay(img, rect) {
    const m = getFitMetrics(img);
    const dx = m.ox + (rect.x * m.dw) / m.nw;
    const dy = m.oy + (rect.y * m.dh) / m.nh;
    const dW = (rect.w * m.dw) / m.nw;
    const dH = (rect.h * m.dh) / m.nh;
    return { left: dx, top: dy, width: dW, height: dH };
  }

  function clampLabelPosition() {
    const lw = labelDrag.offsetWidth;
    const lh = labelDrag.offsetHeight;
    const W = labelLayer.clientWidth;
    const H = labelLayer.clientHeight;
    let left = parseFloat(labelDrag.style.left) || 0;
    let top = parseFloat(labelDrag.style.top) || 0;
    left = Math.max(0, Math.min(left, W - lw));
    top = Math.max(0, Math.min(top, H - lh));
    labelDrag.style.left = `${left}px`;
    labelDrag.style.top = `${top}px`;
  }

  /** Coloca o rótulo com largura = frac * largura útil, centrado. */
  function layoutLabelWidthFrac(frac) {
    if (!bgPreview.naturalWidth || !labelDrag.naturalWidth) return;
    const m = getFitMetrics(bgPreview);
    const ar = labelDrag.naturalHeight / labelDrag.naturalWidth;
    const w = m.dw * frac;
    const h = w * ar;
    const left = m.ox + (m.dw - w) / 2;
    const top = m.oy + (m.dh - h) / 2;
    labelDrag.style.width = `${w}px`;
    labelDrag.style.height = "auto";
    labelDrag.style.left = `${left}px`;
    labelDrag.style.top = `${top}px`;
    clampLabelPosition();
  }

  /** Mantém o centro, altera só a largura (frac da área da foto). */
  function setLabelWidthFracPreserveCenter(frac) {
    const m = getFitMetrics(bgPreview);
    const cx =
      parseFloat(labelDrag.style.left) + labelDrag.offsetWidth / 2;
    const cy =
      parseFloat(labelDrag.style.top) + labelDrag.offsetHeight / 2;
    const ar = labelDrag.naturalHeight / labelDrag.naturalWidth;
    const w = m.dw * frac;
    const h = w * ar;
    let left = cx - w / 2;
    let top = cy - h / 2;
    labelDrag.style.width = `${w}px`;
    labelDrag.style.height = "auto";
    labelDrag.style.left = `${left}px`;
    labelDrag.style.top = `${top}px`;
    clampLabelPosition();
  }

  function centerLabel() {
    const m = getFitMetrics(bgPreview);
    const w = labelDrag.offsetWidth;
    const h = labelDrag.offsetHeight;
    labelDrag.style.left = `${m.ox + (m.dw - w) / 2}px`;
    labelDrag.style.top = `${m.oy + (m.dh - h) / 2}px`;
    clampLabelPosition();
  }

  async function loadPreview(file) {
    clearError();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
    resultWrap.hidden = true;
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      resultUrl = null;
    }

    statusHint.textContent = "A remover fundo e a preparar pré-visualização…";
    editorWrap.hidden = true;

    const form = new FormData();
    form.append("package", file);

    const res = await fetch(apiUrl("/api/white-bg-preview"), {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(formatErr(err.detail) || res.statusText);
    }
    const blob = await res.blob();
    previewUrl = URL.createObjectURL(blob);
    bgPreview.src = previewUrl;
  }

  function whenImgReady(img, fn) {
    if (img.complete && img.naturalWidth) fn();
    else img.onload = () => fn();
  }

  function initLabelWhenReady() {
    whenImgReady(bgPreview, () => {
      labelDrag.src = apiUrl("/static/labels/official-label.png");
      whenImgReady(labelDrag, () => {
        layoutLabelWidthFrac(Number(widthSlider.value) / 100);
        editorWrap.hidden = false;
        statusHint.textContent =
          "Arraste o rótulo e clique em Gerar PNG final quando estiver alinhado.";
      });
    });
  }

  async function applySuggestedRect() {
    if (!currentFile) return;
    statusHint.textContent = "A calcular posição sugerida…";
    const fd = new FormData();
    fd.append("package", currentFile);
    const res = await fetch(apiUrl("/api/suggest-label-rect"), {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(formatErr(err.detail) || res.statusText);
    }
    const j = await res.json();
    const d = naturalRectToDisplay(bgPreview, {
      x: j.x,
      y: j.y,
      w: j.w,
      h: j.h,
    });
    labelDrag.style.width = `${d.width}px`;
    labelDrag.style.height = "auto";
    labelDrag.style.left = `${d.left}px`;
    labelDrag.style.top = `${d.top}px`;
    clampLabelPosition();
    const m = getFitMetrics(bgPreview);
    const frac = labelDrag.offsetWidth / m.dw;
    widthSlider.value = String(Math.round(frac * 100));
    widthValue.textContent = `${widthSlider.value}%`;
    statusHint.textContent = "Posição sugerida aplicada. Ajuste à mão se precisar.";
  }

  async function exportFinal() {
    if (!currentFile) return;
    const left = parseFloat(labelDrag.style.left) || 0;
    const top = parseFloat(labelDrag.style.top) || 0;
    const w = labelDrag.offsetWidth;
    const h = labelDrag.offsetHeight;
    const nat = displayRectToNatural(bgPreview, left, top, w, h);

    statusHint.textContent = "A gerar imagem final…";
    btnExport.disabled = true;

    const fd = new FormData();
    fd.append("package", currentFile);
    fd.append("x", String(nat.x));
    fd.append("y", String(nat.y));
    fd.append("w", String(nat.w));
    fd.append("h", String(nat.h));

    const res = await fetch(apiUrl("/api/compose-label-at"), {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(formatErr(err.detail) || res.statusText);
    }
    const blob = await res.blob();
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(blob);
    resultImg.src = resultUrl;
    downloadBtn.href = resultUrl;
    resultWrap.hidden = false;
    statusHint.textContent = "Pronto. Pode baixar o PNG.";
    btnExport.disabled = false;
  }

  /* Arrastar */
  function pointerDown(e) {
    if (e.target !== labelDrag) return;
    e.preventDefault();
    const rect = labelDrag.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragState = {
      ox: clientX - rect.left,
      oy: clientY - rect.top,
    };
  }

  function pointerMove(e) {
    if (!dragState) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const layerRect = labelLayer.getBoundingClientRect();
    let nx = clientX - layerRect.left - dragState.ox;
    let ny = clientY - layerRect.top - dragState.oy;
    const lw = labelDrag.offsetWidth;
    const lh = labelDrag.offsetHeight;
    nx = Math.max(0, Math.min(nx, layerRect.width - lw));
    ny = Math.max(0, Math.min(ny, layerRect.height - lh));
    labelDrag.style.left = `${nx}px`;
    labelDrag.style.top = `${ny}px`;
  }

  function pointerUp() {
    dragState = null;
  }

  labelDrag.addEventListener("mousedown", pointerDown);
  document.addEventListener("mousemove", pointerMove);
  document.addEventListener("mouseup", pointerUp);
  labelDrag.addEventListener("touchstart", pointerDown, { passive: false });
  document.addEventListener("touchmove", pointerMove, { passive: false });
  document.addEventListener("touchend", pointerUp);

  widthSlider.addEventListener("input", () => {
    widthValue.textContent = `${widthSlider.value}%`;
    setLabelWidthFracPreserveCenter(Number(widthSlider.value) / 100);
  });

  btnCenter.addEventListener("click", () => centerLabel());

  btnSuggest.addEventListener("click", async () => {
    try {
      await applySuggestedRect();
    } catch (err) {
      showError(String(err.message || err));
      statusHint.textContent = "Falhou a sugestão.";
    }
  });

  btnExport.addEventListener("click", async () => {
    try {
      await exportFinal();
    } catch (err) {
      showError(String(err.message || err));
      statusHint.textContent = "Falhou a exportação.";
      btnExport.disabled = false;
    }
  });

  window.addEventListener("resize", () => {
    if (
      !editorWrap.hidden &&
      bgPreview.naturalWidth &&
      labelDrag.offsetWidth
    ) {
      const nat = displayRectToNatural(
        bgPreview,
        parseFloat(labelDrag.style.left) || 0,
        parseFloat(labelDrag.style.top) || 0,
        labelDrag.offsetWidth,
        labelDrag.offsetHeight
      );
      requestAnimationFrame(() => {
        const d = naturalRectToDisplay(bgPreview, nat);
        labelDrag.style.width = `${d.width}px`;
        labelDrag.style.height = "auto";
        labelDrag.style.left = `${d.left}px`;
        labelDrag.style.top = `${d.top}px`;
        clampLabelPosition();
      });
    }
  });

  pkgInput.addEventListener("change", async () => {
    const f = pkgInput.files?.[0];
    clearError();
    if (!f) {
      editorWrap.hidden = true;
      statusHint.textContent = "Escolha uma imagem.";
      return;
    }
    currentFile = f;
    try {
      await loadPreview(f);
      initLabelWhenReady();
    } catch (err) {
      const msg = String(err.message || err);
      statusHint.textContent = "Falhou.";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        showError(
          "Sem ligação ao servidor. Corra: uvicorn app.main:app --host 127.0.0.1 --port 8765"
        );
      } else {
        showError(msg);
      }
    }
  });

  downloadBtn.addEventListener("click", (e) => {
    if (!resultUrl) e.preventDefault();
  });
})();
