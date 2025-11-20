// ========= 全局状态 =========
let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let beautifiedPdfBlob = null;

const API_BASE = "https://aistoryteller-backend.onrender.com";
// 本地测试: const API_BASE = "http://127.0.0.1:8001";

// 设置PDF.js worker
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

// ========= PDF 渲染（单页模式）=========

async function loadPDF(pdfData) {
  try {
    console.log("[PDF] 开始加载PDF文档...");
    
    const loadingTask = pdfjsLib.getDocument(pdfData);
    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;
    
    console.log(`[PDF] 加载成功，共 ${totalPages} 页`);
    
    // 渲染第一页
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
    
    // 获取页面
    const page = await pdfDoc.getPage(pageNum);
    
    // 获取容器尺寸
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // 计算缩放比例，让PDF填满容器
    const viewport = page.getViewport({ scale: 1.0 });
    const scaleX = containerWidth / viewport.width;
    const scaleY = containerHeight / viewport.height;
    const scale = Math.min(scaleX, scaleY);
    
    const scaledViewport = page.getViewport({ scale: scale });
    
    // 设置canvas尺寸
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    
    // 设置canvas样式，使其居中显示，并保持原有slide样式
    canvas.style.display = 'block';
    canvas.style.position = 'absolute';
    canvas.style.top = '50%';
    canvas.style.left = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
    canvas.style.borderRadius = '24px';
    canvas.style.boxShadow = '0 24px 60px rgba(0, 0, 0, 0.12)';
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    
    // 渲染页面
    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport
    };
    
    await page.render(renderContext).promise;
    
    // 隐藏loading
    document.getElementById('pdf-loading').style.display = 'none';
    
    console.log(`[PDF] 第 ${pageNum} 页渲染完成`);
    
  } catch (error) {
    console.error(`[PDF] 渲染第 ${pageNum} 页失败:`, error);
  }
}

// ========= 页面导航 =========

function showSlide(index) {
  if (!pdfDoc) return;
  
  // 限制范围
  if (index < 1) index = 1;
  if (index > totalPages) index = totalPages;
  
  currentPage = index;
  
  // 更新页面信息
  const pageInfo = document.getElementById("page-info");
  pageInfo.textContent = `${currentPage} / ${totalPages}`;
  
  // 渲染当前页
  renderPage(currentPage);
}

// ========= 加载固定模板PDF =========

async function loadFixedTemplatePDF() {
  try {
    console.log("[API] 请求固定模板PDF...");
    
    // 显示loading
    const loading = document.getElementById('pdf-loading');
    loading.style.display = 'block';
    loading.innerHTML = '<div style="font-size: 18px;">正在加载PDF...</div>';
    
    const response = await fetch(`${API_BASE}/api/fixed_template_pdf`);
    
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    
    const blob = await response.blob();
    beautifiedPdfBlob = blob;
    
    console.log("[API] PDF下载完成，大小:", blob.size, "bytes");
    
    // 将blob转换为ArrayBuffer用于PDF.js
    const arrayBuffer = await blob.arrayBuffer();
    
    // 加载并渲染PDF
    await loadPDF(arrayBuffer);
    
    // 显示下载按钮
    const downloadBtn = document.getElementById("btn-download");
    downloadBtn.style.display = "inline-block";
    downloadBtn.disabled = false;
    
    return blob;
  } catch (error) {
    console.error("[API] 加载固定模板PDF失败:", error);
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

  // 翻页按钮
  btnPrev.addEventListener("click", () => showSlide(currentPage - 1));
  btnNext.addEventListener("click", () => showSlide(currentPage + 1));
  
  btnFullscreen.addEventListener("click", () => toggleFullscreen(app));
  btnDownload.addEventListener("click", downloadBeautifiedPpt);

  // 键盘快捷键
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      showSlide(currentPage - 1);
    } else if (e.key === "ArrowRight") {
      showSlide(currentPage + 1);
    } else if (e.key === "f" || e.key === "F") {
      toggleFullscreen(app);
    }
  });

  // 文件上传处理
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      console.log("[上传] 用户上传了文件:", file.name);
      
      document.getElementById("page-info").textContent = "加载中...";
      
      // 加载固定模板PDF
      await loadFixedTemplatePDF();
      
      // 更新页面信息
      document.getElementById("page-info").textContent = `1 / ${totalPages}`;
      
      console.log("[完成] 固定模板PDF加载完成");
      
    } catch (err) {
      console.error("[错误]", err);
      alert("加载失败: " + err.message);
      document.getElementById("page-info").textContent = "0 / 0";
      
      // 隐藏loading
      document.getElementById('pdf-loading').style.display = 'none';
    } finally {
      fileInput.value = "";
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
    
    // 初始时不加载任何内容，等待用户上传
    document.getElementById("page-info").textContent = "0 / 0";
    
    console.log("[初始化] 完成，等待用户上传PPT");
    
  } catch (err) {
    console.error("[初始化] 失败:", err);
    document.getElementById("page-info").textContent = "初始化失败";
  }
}

document.addEventListener("DOMContentLoaded", init);