// ====== 配置区 ======

// 后端 API 地址：改成你在 Render 上的实际地址
// 例如：https://aistory-backend.onrender.com
const API_BASE = "https://aistory-backend.onrender.com";

// ====== DOM 获取 ======

const fileInput = document.getElementById("pptFile");
const uploadBtn = document.getElementById("uploadBtn");
const statusEl = document.getElementById("status");
const slidesContainer = document.getElementById("slidesContainer");

// 安全检查：防止 id 对不上时报错
if (!fileInput || !uploadBtn || !statusEl || !slidesContainer) {
  console.error(
    "[AIStoryteller] 请确认 HTML 中存在以下元素：#pptFile, #uploadBtn, #status, #slidesContainer"
  );
}

// ====== 工具函数 ======

function setStatus(message, type = "info") {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = "";
  statusEl.classList.add("status", `status-${type}`);
}

function clearSlides() {
  if (!slidesContainer) return;
  slidesContainer.innerHTML = "";
}

function humanReadableSlideType(slideType) {
  if (!slideType) return "UNKNOWN";

  // 后端返回的是小写：title / agenda / content_bullets ...
  const map = {
    title: "TITLE",
    agenda: "AGENDA",
    section: "SECTION",
    content: "CONTENT",
    content_bullets: "CONTENT_BULLETS",
    content_image: "CONTENT_IMAGE",
    ending: "ENDING",
    other: "OTHER",
  };

  const key = String(slideType).toLowerCase();
  return map[key] || slideType.toUpperCase();
}

function truncate(text, maxLen = 80) {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "…";
}

// ====== 渲染逻辑：把后端返回的数据画到页面上 ======

function renderSlides(data) {
  if (!slidesContainer) return;
  clearSlides();

  if (!data || !Array.isArray(data.slides) || data.slides.length === 0) {
    setStatus("没有解析到任何页面。请检查 PPT 内容。", "warn");
    return;
  }

  const { meta, slides } = data;

  // 在顶部显示一个摘要
  const summary = document.createElement("div");
  summary.className = "slides-summary";
  summary.innerHTML = `
    <div>共 <strong>${slides.length}</strong> 页</div>
    ${
      meta
        ? `<div class="slides-meta">尺寸（emu）：${meta.slide_width_emu} × ${meta.slide_height_emu}</div>`
        : ""
    }
  `;
  slidesContainer.appendChild(summary);

  // 每一页生成一个 slide 卡片
  slides.forEach((slide, idx) => {
    const slideEl = document.createElement("div");
    slideEl.className = "slide";
    slideEl.dataset.index = idx;

    // 右上角 badge：显示 slide_type
    const badge = document.createElement("div");
    badge.className = "slide-type-badge";
    const slideType = humanReadableSlideType(slide.slide_type);
    badge.textContent = slideType;
    slideEl.appendChild(badge);

    // 页码 + 布局名称
    const header = document.createElement("div");
    header.className = "slide-header";
    header.innerHTML = `
      <div class="slide-index">Slide ${idx + 1}</div>
      <div class="slide-layout">${slide.layout_name || ""}</div>
    `;
    slideEl.appendChild(header);

    // 主体内容：简单列出文本 shape（方便你 debug 类型）
    const body = document.createElement("div");
    body.className = "slide-body";

    const shapes = slide.shapes || [];
    if (shapes.length === 0) {
      const emptyHint = document.createElement("div");
      emptyHint.className = "slide-empty";
      emptyHint.textContent = "（这一页没有识别到可用元素）";
      body.appendChild(emptyHint);
    } else {
      // 把有文本的 shape 简单列出来
      const textShapes = shapes.filter(
        (s) => s.has_text_frame && s.text && s.text.trim().length > 0
      );

      if (textShapes.length === 0) {
        const noTextHint = document.createElement("div");
        noTextHint.className = "slide-empty";
        noTextHint.textContent = "（这一页没有文字内容）";
        body.appendChild(noTextHint);
      } else {
        textShapes.forEach((shape) => {
          const shapeEl = document.createElement("div");
          shapeEl.className = "shape-text-block";

          const metaLine = document.createElement("div");
          metaLine.className = "shape-meta";
          metaLine.textContent = `[${shape.shape_type}] ${shape.name || ""}`;
          shapeEl.appendChild(metaLine);

          const textLine = document.createElement("div");
          textLine.className = "shape-text";
          textLine.textContent = truncate(shape.text, 160);
          shapeEl.appendChild(textLine);

          body.appendChild(shapeEl);
        });
      }
    }

    slideEl.appendChild(body);
    slidesContainer.appendChild(slideEl);
  });
}

// ====== 调用后端 API：上传 PPT 并解析 ======

async function uploadAndParsePpt(file) {
  if (!file) {
    setStatus("请先选择一个 PPT 文件。", "warn");
    return;
  }

  setStatus("正在上传并解析 PPT，请稍候…", "info");
  clearSlides();

  const formData = new FormData();
  formData.append("file", file);

  try {
    const resp = await fetch(`${API_BASE}/api/parse_ppt`, {
      method: "POST",
      body: formData,
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("API Error:", text);
      setStatus(`解析失败（${resp.status}）：${text}`, "error");
      return;
    }

    const data = await resp.json();
    console.log("PPT parsed data:", data);

    setStatus("解析成功 ✅ 下面是每一页的结构和类型。", "success");
    renderSlides(data);
  } catch (err) {
    console.error(err);
    setStatus("请求出错，可能是网络问题或后端服务异常。", "error");
  }
}

// ====== 事件绑定 ======

if (uploadBtn) {
  uploadBtn.addEventListener("click", () => {
    const file = fileInput && fileInput.files && fileInput.files[0];
    uploadAndParsePpt(file);
  });
}

// 回车键快速触发上传（可选）
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (file) {
      uploadAndParsePpt(file);
    }
  }
});

// 初始状态
setStatus("请上传一个 PPT 文件，系统会自动解析并标注每一页的类型。", "info");
