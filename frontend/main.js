// ========= 全局状态 =========
let templateData = null;
let slidesData = [];
let currentIndex = 0;

// 本地开发：后端跑在 127.0.0.1:8001
// 部署到云上后，把这里改成你的后端公网地址
const API_BASE = "http://127.0.0.1:8001";

// ========= 主题加载 =========

async function loadTheme() {
  try {
    const res = await fetch("./mai_theme_v1.json");
    if (!res.ok) {
      console.warn("无法加载主题 JSON，使用默认样式:", res.status);
      return;
    }
    const theme = await res.json();
    applyTheme(theme);
  } catch (err) {
    console.warn("加载主题 JSON 出错:", err);
  }
}

/**
 * 把 mai_theme_v1.json 里的一些关键字段写到 CSS 变量里
 * 你可以根据实际结构调整映射关系
 */
function applyTheme(theme) {
  const root = document.documentElement;

  if (theme.fontFamilySans) {
    root.style.setProperty("--mai-font-family-sans", theme.fontFamilySans);
  }
  if (theme.colors) {
    const c = theme.colors;
    if (c.pageBg) root.style.setProperty("--mai-bg-page", c.pageBg);
    if (c.panelBg) root.style.setProperty("--mai-bg-panel", c.panelBg);
    if (c.cardBg) root.style.setProperty("--mai-bg-card", c.cardBg);
    if (c.textMain) root.style.setProperty("--mai-text-main", c.textMain);
    if (c.textMuted) root.style.setProperty("--mai-text-muted", c.textMuted);
    if (c.accent) root.style.setProperty("--mai-accent", c.accent);
  }
}

// ========= 数据结构辅助 =========

/**
 * 从后端返回的 JSON 里拿到 slides 数组
 * 后端结构是 { meta, slides }；如果以后你还想支持 sample_slides，则可以在这里兼容。
 */
function getSlidesArray(data) {
  if (data.slides && Array.isArray(data.slides)) {
    return data.slides;
  }
  if (data.sample_slides && Array.isArray(data.sample_slides)) {
    return data.sample_slides;
  }
  return [];
}

// ========= Slide 渲染 =========

function createSlideElements(meta, slides) {
  const slideContainer = document.getElementById("slide-container");
  slideContainer.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "slide-wrapper";
  slideContainer.appendChild(wrapper);

  const slideWidthEmu = meta.slide_width_emu;
  const slideHeightEmu = meta.slide_height_emu;

  slides.forEach((slide, idx) => {
    const slideEl = document.createElement("div");
    slideEl.className = "slide";
    slideEl.dataset.index = idx;

    // 可选：右上角一个小 badge 标出页面 index
    const badge = document.createElement("div");
    badge.className = "slide-type-badge";
    badge.textContent = `Slide ${idx + 1}`;
    slideEl.appendChild(badge);

    const shapes = slide.shapes || [];

    shapes.forEach((shape) => {
      const geom = shape.geometry || {};
      const left = geom.left_emu || 0;
      const top = geom.top_emu || 0;
      const width = geom.width_emu || 0;
      const height = geom.height_emu || 0;

      const leftPct = (left / slideWidthEmu) * 100;
      const topPct = (top / slideHeightEmu) * 100;
      const widthPct = (width / slideWidthEmu) * 100;
      const heightPct = (height / slideHeightEmu) * 100;

      const shapeEl = document.createElement("div");
      shapeEl.classList.add("shape");

      const shapeType = (shape.shape_type || "").toUpperCase();

      if (shapeType === "TEXT_BOX") {
        shapeEl.classList.add("shape-text");
      } else if (shapeType === "PICTURE" || shapeType === "MEDIA") {
        shapeEl.classList.add("shape-picture");
      } else if (shapeType === "LINE") {
        shapeEl.classList.add("shape-line");
      }

      shapeEl.style.left = leftPct + "%";
      shapeEl.style.top = topPct + "%";
      shapeEl.style.width = widthPct + "%";
      shapeEl.style.height = heightPct + "%";

      if (shape.has_text_frame && shape.text) {
        const text = shape.text;
        shapeEl.textContent = text;

        // 粗糙地猜一下是不是标题：在上 1/3 区域 + 字数不多
        const yCenter = (top + height / 2) / slideHeightEmu;
        const len = text.trim().length;
        if (yCenter < 0.3 && len > 0 && len <= 40) {
          shapeEl.classList.add("title-like");
        }
      }

      slideEl.appendChild(shapeEl);
    });

    wrapper.appendChild(slideEl);
  });
}

function showSlide(index) {
  if (!slidesData.length) return;

  if (index < 0) index = 0;
  if (index >= slidesData.length) index = slidesData.length - 1;

  currentIndex = index;

  const slides = document.querySelectorAll(".slide");
  slides.forEach((s) => s.classList.remove("active"));

  const active = document.querySelector(`.slide[data-index="${index}"]`);
  if (active) {
    active.classList.add("active");
  }

  const pageInfo = document.getElementById("page-info");
  pageInfo.textContent = `${index + 1} / ${slidesData.length}`;
}

// ========= 上传 & 调用后端 =========

async function uploadAndRenderPpt(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/parse_ppt`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error("解析 PPT 失败: " + res.status + " " + text);
  }

  const data = await res.json();
  console.log("后端解析 PPT 返回的数据:", data);

  templateData = data;
  slidesData = getSlidesArray(templateData);

  if (!slidesData.length) {
    document.getElementById("page-info").textContent = "0 / 0";
    document.getElementById("slide-container").innerHTML = "";
    return;
  }

  createSlideElements(templateData.meta, slidesData);
  showSlide(0);
}

// ========= 控件绑定 & 全屏 =========

function toggleFullscreen(element) {
  if (!document.fullscreenElement) {
    element.requestFullscreen().catch((err) => {
      console.warn("无法进入全屏:", err);
    });
  } else {
    document.exitFullscreen().catch((err) => {
      console.warn("退出全屏失败:", err);
    });
  }
}

function bindControls() {
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const btnFullscreen = document.getElementById("btn-fullscreen");
  const app = document.getElementById("app");
  const fileInput = document.getElementById("ppt-file-input");

  btnPrev.addEventListener("click", () => showSlide(currentIndex - 1));
  btnNext.addEventListener("click", () => showSlide(currentIndex + 1));
  btnFullscreen.addEventListener("click", () => toggleFullscreen(app));

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      showSlide(currentIndex - 1);
    } else if (e.key === "ArrowRight") {
      showSlide(currentIndex + 1);
    } else if (e.key === "f" || e.key === "F") {
      toggleFullscreen(app);
    }
  });

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      document.getElementById("page-info").textContent = "解析中...";
      await uploadAndRenderPpt(file);
    } catch (err) {
      console.error(err);
      alert(err.message);
      document.getElementById("page-info").textContent = "0 / 0";
    } finally {
      fileInput.value = ""; // 方便再次选择同一个文件
    }
  });
}

// ========= 初始化 =========

async function init() {
  try {
    await loadTheme();
    bindControls();
    document.getElementById("page-info").textContent = "0 / 0";
  } catch (err) {
    console.error("初始化失败:", err);
    alert("初始化失败：" + err.message);
  }
}

document.addEventListener("DOMContentLoaded", init);
