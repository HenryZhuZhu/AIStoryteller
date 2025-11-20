// ========= 全局状态 =========
let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let beautifiedPdfBlob = null;
let currentPptFile = null;

const API_BASE = "https://aistoryteller-backend.onrender.com";
// 本地测试: const API_BASE = "http://127.0.0.1:8001";

// 设置PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ========= PPT解析和预览 =========

async function parsePPT(file) {
  try {
    console.log("[解析] 开始解析PPT:", file.name);
    
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE}/api/parse_ppt`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`解析失败: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("[解析] 解析成功:", data);
    
    return data;
  } catch (error) {
    console.error("[解析] 解析失败:", error);
    throw error;
  }
}

function showPreview(pptData, filename) {
  const panel = document.getElementById('preview-panel');
  const content = document.getElementById('preview-content');
  const filenameEl = document.getElementById('preview-filename');
  const slidecountEl = document.getElementById('preview-slidecount');
  
  // 设置文件信息
  filenameEl.textContent = filename;
  const slideCount = pptData.slides ? pptData.slides.length : 0;
  slidecountEl.textContent = `${slideCount} 页幻灯片`;
  
  // 清空之前的内容
  content.innerHTML = '';
  
  // 生成每页的预览
  const slides = pptData.slides || [];
  slides.forEach((slide, index) => {
    const slideDiv = document.createElement('div');
    slideDiv.className = 'slide-preview';
    
    const title = document.createElement('h3');
    title.textContent = `第 ${index + 1} 页`;
    slideDiv.appendChild(title);
    
    // 提取文字内容
    const textDiv = document.createElement('div');
    textDiv.className = 'slide-text';
    
    let slideText = '';
    if (slide.shapes && slide.shapes.length > 0) {
      slide.shapes.forEach(shape => {
        if (shape.text && shape.text.trim()) {
          slideText += shape.text.trim() + '\n';
        }
      });
    }
    
    if (slideText) {
      textDiv.textContent = slideText;
    } else {
      textDiv.textContent = '(此页无文字内容)';
      textDiv.style.color = 'var(--mai-text-muted)';
      textDiv.style.fontStyle = 'italic';
    }
    
    slideDiv.appendChild(textDiv);
    content.appendChild(slideDiv);
  });
  
  // 显示预览面板
  panel.classList.add('show');
}

function hidePreview() {
  const panel = document.getElementById('preview-panel');
  panel.classList.remove('show');
}

// ========= 处理动画 =========

const PROCESSING_STAGES = [
  { text: "Analyzing", duration: 1500, progress: 25 },
  { text: "Matching", duration: 1500, progress: 50 },
  { text: "Beautifying", duration: 1500, progress: 75 },
  { text: "Generating", duration: 1500, progress: 100 }
];

async function showProcessingAnimation() {
  const animationDiv = document.getElementById('processing-animation');
  const textDiv = document.getElementById('processing-text');
  const progressFill = document.getElementById('progress-fill');
  const canvas = document.getElementById('pdf-canvas');
  const background = document.getElementById('animated-background');
  
  canvas.style.display = 'none';
  animationDiv.style.display = 'block';
  
  for (let i = 0; i < PROCESSING_STAGES.length; i++) {
    const stage = PROCESSING_STAGES[i];
    
    textDiv.innerHTML = `${stage.text}<span class="processing-dots"><span>.</span><span>.</span><span>.</span></span>`;
    textDiv.style.animation = 'none';
    void textDiv.offsetWidth;
    textDiv.style.animation = 'fadeInOut 1.5s ease-in-out';
    
    progressFill.style.width = stage.progress + '%';
    
    await new Promise(resolve => setTimeout(resolve, stage.duration));
  }
  
  animationDiv.style.display = 'none';
  
  // 隐藏流动背景
  if (background) {
    background.style.transition = 'opacity 0.5s ease';
    background.style.opacity = '0';
    setTimeout(() => {
      background.style.display = 'none';
    }, 500);
  }
}

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

// ========= PDF 渲染 =========

async function loadPDF(pdfData) {
  try {
    console.log("[PDF] 开始加载PDF文档...");
    
    const loadingTask = pdfjsLib.getDocument(pdfData);
    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;
    
    console.log(`[PDF] 加载成功，共 ${totalPages} 页`);
    
    currentPage = 1;
    await renderPage(currentPage);
    
  } catch (error) {
    console.error("[PDF] 加载失败:", error);
    alert("PDF加载失败: " + error.message);
  }
}

async function renderPage(pageNum) {
  try {
    console.log(`[PDF] 渲染第 ${pageNum} 页`);
    
    const canvas = document.getElementById('pdf-canvas');
    const container = document.getElementById('slide-container');
    const context = canvas.getContext('2d');
    
    const page = await pdfDoc.getPage(pageNum);
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    const viewport = page.getViewport({ scale: 1.0 });
    const scaleX = containerWidth / viewport.width;
    const scaleY = containerHeight / viewport.height;
    const scale = Math.min(scaleX, scaleY);
    
    const scaledViewport = page.getViewport({ scale: scale });
    
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    
    canvas.style.display = 'block';
    canvas.style.position = 'absolute';
    canvas.style.top = '50%';
    canvas.style.left = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
    canvas.style.borderRadius = '24px';
    canvas.style.boxShadow = '0 24px 60px rgba(0, 0, 0, 0.12)';
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    
    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport
    };
    
    await page.render(renderContext).promise;
    
    console.log(`[PDF] 第 ${pageNum} 页渲染完成`);
    
  } catch (error) {
    console.error(`[PDF] 渲染第 ${pageNum} 页失败:`, error);
  }
}

function showSlide(index) {
  if (!pdfDoc) return;
  
  if (index < 1) index = 1;
  if (index > totalPages) index = totalPages;
  
  currentPage = index;
  
  const pageInfo = document.getElementById("page-info");
  pageInfo.textContent = `${currentPage} / ${totalPages}`;
  
  renderPage(currentPage);
}

// ========= 加载固定模板PDF =========

async function loadFixedTemplatePDF() {
  try {
    console.log("[API] 开始处理流程...");
    
    const animationPromise = showProcessingAnimation();
    
    const loadPromise = (async () => {
      const response = await fetch(`${API_BASE}/api/fixed_template_pdf`);
      
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }
      
      const blob = await response.blob();
      beautifiedPdfBlob = blob;
      
      console.log("[API] PDF下载完成，大小:", blob.size, "bytes");
      
      const arrayBuffer = await blob.arrayBuffer();
      return arrayBuffer;
    })();
    
    const [_, arrayBuffer] = await Promise.all([animationPromise, loadPromise]);
    
    await loadPDF(arrayBuffer);
    
    const downloadBtn = document.getElementById("btn-download");
    downloadBtn.style.display = "inline-block";
    downloadBtn.disabled = false;
    
    console.log("[完成] 处理流程完成");
    
    return beautifiedPdfBlob;
  } catch (error) {
    console.error("[API] 加载固定模板PDF失败:", error);
    document.getElementById('processing-animation').style.display = 'none';
    throw error;
  }
}

// ========= 下载功能 =========

function downloadBeautifiedPpt() {
  if (!beautifiedPdfBlob) {
    alert("没有可下载的文件");
    return;
  }

  const url = URL.createObjectURL(beautifiedPdfBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "beautified_presentation.pdf";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ========= 全屏功能 =========

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

// ========= 控件绑定 =========

function bindControls() {
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const btnFullscreen = document.getElementById("btn-fullscreen");
  const btnDownload = document.getElementById("btn-download");
  const app = document.getElementById("app");
  const fileInput = document.getElementById("ppt-file-input");
  const btnCancelPreview = document.getElementById("btn-cancel-preview");
  const btnStartBeautify = document.getElementById("btn-start-beautify");

  btnPrev.addEventListener("click", () => showSlide(currentPage - 1));
  btnNext.addEventListener("click", () => showSlide(currentPage + 1));
  btnFullscreen.addEventListener("click", () => toggleFullscreen(app));
  btnDownload.addEventListener("click", downloadBeautifiedPpt);

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      showSlide(currentPage - 1);
    } else if (e.key === "ArrowRight") {
      showSlide(currentPage + 1);
    } else if (e.key === "f" || e.key === "F") {
      toggleFullscreen(app);
    }
  });

  // 文件上传 - 显示预览
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      console.log("[上传] 用户上传了文件:", file.name);
      
      currentPptFile = file;
      document.getElementById("page-info").textContent = "解析中...";
      
      // 解析PPT并显示预览
      const pptData = await parsePPT(file);
      showPreview(pptData, file.name);
      
      document.getElementById("page-info").textContent = "0 / 0";
      
    } catch (err) {
      console.error("[错误]", err);
      alert("解析失败: " + err.message);
      document.getElementById("page-info").textContent = "0 / 0";
    } finally {
      fileInput.value = "";
    }
  });

  // 取消预览
  btnCancelPreview.addEventListener("click", () => {
    hidePreview();
    currentPptFile = null;
  });

  // 开始美化
  btnStartBeautify.addEventListener("click", async () => {
    try {
      console.log("[美化] 用户点击开始美化");
      
      // 隐藏预览面板
      hidePreview();
      
      document.getElementById("page-info").textContent = "处理中...";
      
      // 开始美化流程（显示动画和加载PDF）
      await loadFixedTemplatePDF();
      
      document.getElementById("page-info").textContent = `1 / ${totalPages}`;
      
      console.log("[完成] 美化完成");
      
    } catch (err) {
      console.error("[错误]", err);
      alert("美化失败: " + err.message);
      document.getElementById("page-info").textContent = "0 / 0";
    }
  });

  // 窗口大小改变时重新渲染
  window.addEventListener('resize', () => {
    if (pdfDoc && currentPage) {
      renderPage(currentPage);
    }
  });
}

// ========= 初始化 =========

async function init() {
  try {
    await loadTheme();
    bindControls();
    
    document.getElementById("page-info").textContent = "0 / 0";
    
    console.log("[初始化] 完成，等待用户上传PPT");
    
  } catch (err) {
    console.error("[初始化] 失败:", err);
    document.getElementById("page-info").textContent = "初始化失败";
  }
}

document.addEventListener("DOMContentLoaded", init);