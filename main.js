// 全局状态
let templateData = null;
let slidesData = [];
let currentIndex = 0;

/**
 * 加载 MAI 视觉主题 JSON，并写入 CSS 变量
 */
async function loadTheme() {
  const res = await fetch("./mai_theme_v1.json");
  if (!res.ok) {
    throw new Error("无法加载主题配置 mai_theme_v1.json");
  }
  const theme = await res.json();
  applyThemeToCssVars(theme);
  return theme;
}

function applyThemeToCssVars(theme) {
  const root = document.documentElement;
  const colors = theme.colors || {};
  const fonts = theme.fonts || {};
  const bodyFont = fonts.secondary?.name || "Segoe UI";
  const titleFont = fonts.primary?.name || "Times New Roman";

  // 背景色
  root.style.setProperty(
    "--mai-bg-page",
    colors.backgrounds?.page || "#FEF9ED"
  );
  root.style.setProperty(
    "--mai-bg-panel",
    colors.backgrounds?.panel || "#F5ECE0"
  );
  root.style.setProperty(
    "--mai-bg-card",
    colors.backgrounds?.card || "#EADAC7"
  );

  // 文本色
  root.style.setProperty(
    "--mai-text-primary",
    colors.text?.primary || "#72675B"
  );
  root.style.setProperty(
    "--mai-text-secondary",
    colors.text?.secondary || "#92877A"
  );
  root.style.setProperty(
    "--mai-text-strong",
    colors.text?.strong || "#3B230E"
  );
  root.style.setProperty(
    "--mai-text-muted",
    colors.text?.muted || "#B3A79A"
  );

  // 字体
  root.style.setProperty(
    "--mai-font-body",
    `"${bodyFont}", ${fonts.secondary?.fallbacks?.join(", ") || "sans-serif"}`
  );
  root.style.setProperty(
    "--mai-font-title",
    `"${titleFont}", ${fonts.primary?.fallbacks?.join(", ") || "serif"}`
  );

  // 字号（px）
  const sizes = fonts.recommended_sizes || {};
  root.style.setProperty(
    "--mai-font-size-title",
    (sizes.title || 72) + "px"
  );
  root.style.setProperty(
    "--mai-font-size-slide-title",
    (sizes.slide_title || 48) + "px"
  );
  root.style.setProperty(
    "--mai-font-size-heading",
    (sizes.heading || 32) + "px"
  );
  root.style.setProperty(
    "--mai-font-size-body",
    (sizes.body || 22) + "px"
  );
  root.style.setProperty(
    "--mai-font-size-caption",
    (sizes.caption || 16) + "px"
  );
}

/**
 * 加载模板结构 JSON
 */
async function loadTemplateJson() {
  const res = await fetch("./template_structure.json");
  if (!res.ok) {
    throw new Error("无法加载 template_structure.json");
  }
  const data = await res.json();
  return data;
}

/**
 * 有的版本是 data.slides，有的是 data.sample_slides
 */
function getSlidesArray(data) {
  if (Array.isArray(data.slides)) return data.slides;
  if (Array.isArray(data.sample_slides)) return data.sample_slides;
  return [];
}

/**
 * 根据 JSON 渲染所有 slide
 */
function createSlideElements(meta, slides) {
  const slideContainer = document.getElementById("slide-container");

  // 包一层 wrapper，保持 16:9 比例
  const wrapper = document.createElement("div");
  wrapper.className = "slide-wrapper";
  slideContainer.appendChild(wrapper);

  const slideWidthEmu = meta.slide_width_emu;
  const slideHeightEmu = meta.slide_height_emu;

  slides.forEach((slide, idx) => {
    const slideEl = document.createElement("div");
    slideEl.className = "slide";
    slideEl.dataset.index = idx;

    const shapes = slide.shapes || [];

    shapes.forEach((shape) => {
      const geom = shape.geometry || {};
      const left = geom.left_emu || 0;
      const top = geom.top_emu || 0;
      const width = geom.width_emu || 0;
      const height = geom.height_emu || 0;

      // EMU -> 百分比，适配不同屏幕大小
      const leftPct = (left / slideWidthEmu) * 100;
      const topPct = (top / slideHeightEmu) * 100;
      const widthPct = (width / slideWidthEmu) * 100;
      const heightPct = (height / slideHeightEmu) * 100;

      const shapeEl = document.createElement("div");
      shapeEl.classList.add("shape");

      const shapeType = (shape.shape_type || "").toUpperCase();

      // 不同类型加不同 class
      if (shapeType === "TEXT_BOX") {
        shapeEl.classList.add("shape-text");
      } else if (
        shapeType === "PICTURE" ||
        shapeType === "MEDIA"
      ) {
        shapeEl.classList.add("shape-picture");
      } else if (shapeType === "LINE") {
        shapeEl.classList.add("shape-line");
      }

      shapeEl.style.left = leftPct + "%";
      shapeEl.style.top = topPct + "%";
      shapeEl.style.width = widthPct + "%";
      shapeEl.style.height = heightPct + "%";

      // 文本内容
      if (shape.has_text_frame && shape.text) {
        const text = shape.text;
        shapeEl.textContent = text;

        // 简单 heuristics：短文本 + 上半部分 → 认为是标题
        const yCenter = (top + height / 2) / slideHeightEmu;
        const len = text.trim().length;
        if (yCenter < 0.3 && len > 0 && len <= 40) {
          shapeEl.classList.add("title-like");
        }

        // 提示类文字弱化
        const lower = text.trim().toLowerCase();
        if (
          lower.includes("< delete me") ||
          lower.includes("break lines need to be adjusted")
        ) {
          shapeEl.classList.add("hint");
        }
      }

      slideEl.appendChild(shapeEl);
    });

    wrapper.appendChild(slideEl);
  });
}

/**
 * 显示第 index 页
 */
function showSlide(index) {
  const wrapper = document.querySelector(".slide-wrapper");
  if (!wrapper) return;

  const slides = wrapper.querySelectorAll(".slide");
  if (slides.length === 0) return;

  if (index < 0) index = 0;
  if (index >= slides.length) index = slides.length - 1;
  currentIndex = index;

  slides.forEach((slide, idx) => {
    slide.classList.toggle("active", idx === currentIndex);
  });

  const pageInfo = document.getElementById("page-info");
  pageInfo.textContent = `${currentIndex + 1} / ${slides.length}`;
}

/**
 * 绑定按钮 & 键盘事件
 */
function bindControls() {
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const btnFullscreen = document.getElementById("btn-fullscreen");
  const app = document.getElementById("app");

  btnPrev.addEventListener("click", () => showSlide(currentIndex - 1));
  btnNext.addEventListener("click", () => showSlide(currentIndex + 1));

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      showSlide(currentIndex - 1);
    } else if (e.key === "ArrowRight") {
      showSlide(currentIndex + 1);
    } else if (e.key === "f" || e.key === "F") {
      toggleFullscreen(app);
    }
  });

  btnFullscreen.addEventListener("click", () => toggleFullscreen(app));
}

/**
 * 切换全屏
 */
function toggleFullscreen(element) {
  if (!document.fullscreenElement) {
    if (element.requestFullscreen) {
      element.requestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

/**
 * 初始化：先加载主题，再加载模板，再渲染
 */
async function init() {
  try {
    await loadTheme(); // 应用 MAI 主题

    templateData = await loadTemplateJson();
    slidesData = getSlidesArray(templateData);

    if (!slidesData.length) {
      alert("template_structure.json 中未找到 slides 或 sample_slides 数组");
      return;
    }

    createSlideElements(templateData.meta, slidesData);
    bindControls();
    showSlide(0);
  } catch (err) {
    console.error(err);
    alert("初始化失败：" + err.message);
  }
}

window.addEventListener("DOMContentLoaded", init);
