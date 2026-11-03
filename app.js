(function () {
  const $ = (id) => document.getElementById(id);
  const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "";
  let imageDataUrl = null;
  let lastResult = null;

  const views = {
    home: $("view-home"),
    loading: $("view-loading"),
    result: $("view-result"),
  };

  function show(name) {
    Object.values(views).forEach((v) => v.classList.remove("active"));
    views[name].classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 压缩图片到最长边 1024px，JPEG 格式，减少上传体积
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const max = 1024;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // 上传与预览
  $("fileInput").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return showError("请选择图片文件");
    try {
      imageDataUrl = await compressImage(file);
      $("previewImg").src = imageDataUrl;
      $("previewWrap").classList.remove("hidden");
      $("uploadHint").classList.add("hidden");
      updateStartBtn();
      hideError();
    } catch (err) {
      showError("图片读取失败，请换一张试试");
    }
  });

  $("agreeCheck").addEventListener("change", updateStartBtn);

  function updateStartBtn() {
    $("startBtn").disabled = !(imageDataUrl && $("agreeCheck").checked);
  }

  function showError(msg) {
    $("errorMsg").textContent = msg;
    $("errorMsg").classList.remove("hidden");
  }
  function hideError() {
    $("errorMsg").classList.add("hidden");
  }

  // 开始测试
  $("startBtn").addEventListener("click", runAnalysis);

  async function runAnalysis() {
    hideError();
    show("loading");
    const texts = ["正在翻找你的前世卷宗…", "正在比对眉眼间的旧年气韵…", "正在拟定你的前世判词…"];
    let i = 0;
    const timer = setInterval(() => {
      i = (i + 1) % texts.length;
      $("loadingText").textContent = texts[i];
    }, 1800);

    try {
      const result = await callApi(imageDataUrl);
      lastResult = result;
      renderResult(result);
      show("result");
    } catch (err) {
      console.error(err);
      // 模型失败时使用本地模板兜底，保证页面可用
      lastResult = localFallback();
      renderResult(lastResult);
      show("result");
    } finally {
      clearInterval(timer);
    }
  }

  async function callApi(dataUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const resp = await fetch(API_BASE + "/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      return validateResult(data);
    } finally {
      clearTimeout(timeout);
    }
  }

  // 校验模型输出，缺字段则抛错，走兜底
  function validateResult(d) {
    const dims = d && d.dimensions;
    if (!d || !d.title || !d.dynasty || !d.verdict || !d.story || !dims) {
      throw new Error("invalid result");
    }
    const names = DIMENSION_NAMES;
    const dimensions = {};
    names.forEach((n) => {
      const v = Number(dims[n]);
      dimensions[n] = Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 70;
    });
    return {
      dynasty: String(d.dynasty),
      title: String(d.title),
      verdict: String(d.verdict),
      story: String(d.story),
      dimensions,
      observations: Array.isArray(d.observations) ? d.observations.slice(0, 3).map(String) : [],
      style_tips: Array.isArray(d.style_tips) ? d.style_tips.slice(0, 3).map(String) : [],
    };
  }

  function localFallback() {
    const a = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];
    const dimensions = {};
    DIMENSION_NAMES.forEach((n) => (dimensions[n] = 60 + Math.floor(Math.random() * 35)));
    return {
      dynasty: a.dynasty,
      title: a.title,
      verdict: a.tags,
      story: `你前世是${a.dynasty}朝的${a.title}，性情${a.tags.split("、")[0]}。一生不慕浮名，常与笔墨、山水为伴，晚年归于林下，留下一段清淡而动人的故事。`,
      dimensions,
      observations: ["眉眼之间有一股沉静的气韵", "神情自然，适合淡雅的古风打扮"],
      style_tips: [`发饰可选${a.accessory}`, `服色推荐${a.color}`, "妆容以淡雅为主，突出眉眼"],
      offline: true,
    };
  }

  function renderResult(r) {
    $("rDynasty").textContent = `${r.dynasty}朝`;
    $("rTitle").textContent = r.title;
    $("rVerdict").textContent = `「${r.verdict}」`;
    $("rStory").textContent = r.story;

    $("rDims").innerHTML = DIMENSION_NAMES.map(
      (n) => `<li>${n}：<b>${r.dimensions[n]}</b></li>`
    ).join("");
    $("rObs").innerHTML = r.observations.map((o) => `<li>${escapeHtml(o)}</li>`).join("");
    $("rTips").innerHTML = r.style_tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("");

    drawRadar($("radar"), r.dimensions);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // 雷达图
  function drawRadar(canvas, dims, size) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2, R = (size || Math.min(w, h)) * 0.36;
    ctx.clearRect(0, 0, w, h);
    const names = DIMENSION_NAMES;
    const n = names.length;
    const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

    ctx.strokeStyle = "#e4d8bf";
    ctx.lineWidth = 1;
    for (let level = 1; level <= 4; level++) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = cx + Math.cos(angle(i)) * R * (level / 4);
        const y = cy + Math.sin(angle(i)) * R * (level / 4);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle(i)) * R, cy + Math.sin(angle(i)) * R);
      ctx.stroke();
    }

    ctx.beginPath();
    names.forEach((name, i) => {
      const v = dims[name] / 100;
      const x = cx + Math.cos(angle(i)) * R * v;
      const y = cy + Math.sin(angle(i)) * R * v;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(168,67,47,0.25)";
    ctx.fill();
    ctx.strokeStyle = "#a8432f";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#2b2420";
    ctx.font = "14px 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    names.forEach((name, i) => {
      ctx.fillText(name, cx + Math.cos(angle(i)) * (R + 22), cy + Math.sin(angle(i)) * (R + 22));
    });
  }

  // 分享卡：生成竖版图片，不包含用户原图
  function buildShareCard(r) {
    const c = $("shareCanvas");
    const ctx = c.getContext("2d");
    const W = c.width, H = c.height;

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#fbf3df");
    g.addColorStop(1, "#efdcb0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 30, W - 60, H - 60);

    ctx.textAlign = "center";
    ctx.fillStyle = "#c9a24a";
    ctx.font = "28px 'Microsoft YaHei', serif";
    ctx.fillText(`· ${r.dynasty}朝 ·`, W / 2, 150);

    ctx.fillStyle = "#2b2420";
    ctx.font = "bold 84px 'Microsoft YaHei', serif";
    ctx.fillText(r.title, W / 2, 270);

    ctx.fillStyle = "#a8432f";
    ctx.font = "40px 'Microsoft YaHei', serif";
    ctx.fillText(`「${r.verdict}」`, W / 2, 350);

    // 雷达图
    const radarCanvas = document.createElement("canvas");
    radarCanvas.width = 560;
    radarCanvas.height = 560;
    drawRadar(radarCanvas, r.dimensions, 480);
    ctx.drawImage(radarCanvas, (W - 560) / 2, 400, 560, 560);

    ctx.fillStyle = "#7a6e62";
    ctx.font = "26px 'Microsoft YaHei', sans-serif";
    ctx.fillText("你的前世是谁 · 仅供娱乐", W / 2, H - 110);
    return c;
  }

  $("shareBtn").addEventListener("click", async () => {
    if (!lastResult) return;
    const canvas = buildShareCard(lastResult);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "前世卡.png", { type: "image/png" });
      // 支持系统分享的设备直接调起分享面板
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "我的前世", text: `我的前世是${lastResult.dynasty}朝的${lastResult.title}` });
          return;
        } catch (e) { /* 用户取消则降级为下载 */ }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "前世卡.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, "image/png");
  });

  // 再测一次：清空照片和结果
  $("retryBtn").addEventListener("click", () => {
    imageDataUrl = null;
    lastResult = null;
    $("fileInput").value = "";
    $("previewImg").removeAttribute("src");
    $("previewWrap").classList.add("hidden");
    $("uploadHint").classList.remove("hidden");
    $("agreeCheck").checked = false;
    updateStartBtn();
    show("home");
  });
})();
