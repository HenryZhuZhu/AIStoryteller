// ========= 全局状态 =========
let pdfDoc = null;
let currentScale = 1.5;
let totalPages = 0;
let beautifiedPdfBlob = null;

const API_BASE = "https://aistoryteller-backend.onrender.com";
// 本地测试: const API_BASE = "http://127.0.0.1:8001";

// 设置PDF.js worker（如果PDF.js库已加载）
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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

async function loadAndRenderPDF(pdfData) {
  try {
    // 清空容器
    const viewer = document.getElementById("pdf-viewer");
    viewer.innerHTML = '<div id="loading-indicator"><div class="spinner"></div><div>加载中...</div></div>';

    // 加载PDF文档
    const loadingTask = pdfjsLib.getDocument(pdfData);
    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;

    // 更新页面信息
    document.getElementById("page-info").textContent = `${totalPages} 页`;

    // 清空loading提示
    viewer.innerHTML = '';

    // 渲染所有页面
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      await renderPage(pageNum, viewer);
    }

    console.log(`PDF加载完成，共 ${totalPages} 页`);
  } catch (error) {
    console.error("加载PDF失败:", error);
    const viewer = document.getElementById("pdf-viewer");
    viewer.innerHTML = `
      <div id="loading-indicator">
        <div style="color: #c46a2b;">❌ 加载失败</div>
        <div style="font-size: 14px; margin-top: 10px;">${error.message}</div>
      </div>
    `;
  }
}

async function renderPage(pageNum, container) {
  try {
    const page = await pdfDoc.getPage(pageNum);
    
    // 创建页面容器
    const pageContainer = document.createElement('div');
    pageContainer.className = 'pdf-page-container';
    
    // 创建canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // 计算viewport
    const viewport = page.getViewport({ scale: currentScale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // 渲染页面
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    
    await page.render(renderContext).promise;
    
    // 添加到容器
    pageContainer.appendChild(canvas);
    container.appendChild(pageContainer);
    
  } catch (error) {
    console.error(`渲染第 ${pageNum} 页失败:`, error);
  }
}

// ========= 缩放功能 =========

async function zoomIn() {
  currentScale += 0.2;
  if (pdfDoc) {
    await reRenderAllPages();
  }
}

async function zoomOut() {
  if (currentScale > 0.5) {
    currentScale -= 0.2;
    if (pdfDoc) {
      await reRenderAllPages();
    }
  }
}

async function reRenderAllPages() {
  const viewer = document.getElementById("pdf-viewer");
  viewer.innerHTML = '<div id="loading-indicator"><div class="spinner"></div><div>重新渲染中...</div></div>';
  
  viewer.innerHTML = '';
  
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    await renderPage(pageNum, viewer);
  }
}

// ========= 加载固定模板PDF =========

async function loadFixedTemplatePDF() {
  try {
    const response = await fetch(`${API_BASE}/api/fixed_template_pdf`);
    
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    
    const blob = await response.blob();
    beautifiedPdfBlob = blob;
    
    // 将blob转换为ArrayBuffer用于PDF.js
    const arrayBuffer = await blob.arrayBuffer();
    
    // 加载并渲染PDF
    await loadAndRenderPDF(arrayBuffer);
    
    // 显示下载按钮
    const downloadBtn = document.getElementById("btn-download");
    downloadBtn.style.display = "inline-block";
    downloadBtn.disabled = false;
    
    return blob;
  } catch (error) {
    console.error("加载固定模板PDF失败:", error);
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
  const btnZoomIn = document.getElementById("btn-zoom-in");
  const btnZoomOut = document.getElementById("btn-zoom-out");
  const btnFullscreen = document.getElementById("btn-fullscreen");
  const btnDownload = document.getElementById("btn-download");
  const app = document.getElementById("app");
  const fileInput = document.getElementById("ppt-file-input");

  // 绑定缩放按钮
  if (btnZoomIn) {
    btnZoomIn.addEventListener("click", zoomIn);
  }
  if (btnZoomOut) {
    btnZoomOut.addEventListener("click", zoomOut);
  }
  
  btnFullscreen.addEventListener("click", () => toggleFullscreen(app));
  btnDownload.addEventListener("click", downloadBeautifiedPpt);

  // 键盘快捷键
  document.addEventListener("keydown", (e) => {
    if (e.key === "+" || e.key === "=") {
      zoomIn();
    } else if (e.key === "-" || e.key === "_") {
      zoomOut();
    } else if (e.key === "f" || e.key === "F") {
      toggleFullscreen(app);
    }
  });

  // 文件上传处理
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      document.getElementById("page-info").textContent = "处理中...";
      
      const viewer = document.getElementById("pdf-viewer");
      viewer.innerHTML = '<div id="loading-indicator"><div class="spinner"></div><div>正在处理您的PPT...</div></div>';
      
      // 用户上传文件后，显示固定模板PDF
      console.log("用户上传了文件:", file.name, "现在加载并显示固定模板PDF");
      
      // 加载固定模板PDF
      await loadFixedTemplatePDF();
      
      console.log("固定模板PDF加载完成");
      
    } catch (err) {
      console.error(err);
      alert("加载失败: " + err.message);
      document.getElementById("page-info").textContent = "0 页";
      
      const viewer = document.getElementById("pdf-viewer");
      viewer.innerHTML = '<div id="loading-indicator"><div>加载失败，请重试</div></div>';
    } finally {
      fileInput.value = "";
    }
  });
}

// ========= 初始化 =========

async function init() {
  try {
    await loadTheme();
    bindControls();
    
    // 初始时不加载任何内容，等待用户上传
    document.getElementById("page-info").textContent = "0 / 0";
    
    console.log("初始化完成，等待用户上传PPT");
    
  } catch (err) {
    console.error("初始化失败:", err);
    document.getElementById("page-info").textContent = "初始化失败";
  }
}

document.addEventListener("DOMContentLoaded", init);