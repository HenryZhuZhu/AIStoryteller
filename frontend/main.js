// ================================
// AIStoryteller main.js
// 适配你当前 index.html 的 ID
// ================================

console.log("[AIStoryteller] main.js loaded");

// 1. 获取真实 DOM 元素（基于你的 index.html）
const fileInput = document.getElementById("ppt-file-input");
const uploadLabel = document.getElementById("upload-label");
const slideContainer = document.getElementById("slide-container");

// 这里手动创建一个状态提示框（因为 HTML 没有）
let statusEl = document.createElement("div");
statusEl.id = "status";
statusEl.className = "status";
statusEl.style.margin = "10px";
statusEl.style.fontSize = "14px";
statusEl.style.color = "#fff8";
document.getElementById("main").prepend(statusEl);

// 检查 DOM 是否存在
if (!fileInput || !uploadLabel || !slideContainer) {
  console.error("[AIStoryteller] HTML 结构缺失！请检查以下 ID：");
  console.error("ppt-file-input, upload-label, slide-container");
}

// 2. 绑定上传事件
uploadLabel.addEventListener("click", () => {
  console.log("[AIStoryteller] 点击上传按钮");
  fileInput.click();
});

// 3. 当用户选择 PPT 文件时自动上传
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;

  console.log("[AIStoryteller] 用户选择了文件：", file.name);

  statusEl.textContent = "正在上传并解析 PPT...";
  statusEl.style.color = "#ffaa00";

  // 构建 form data
  const form = new FormData();
  form.append("file", file);

  try {
    const API = "https://aistorystory.onrender.com/api/parse_ppt"; // ← 你的云端后端地址

    console.log("[AIStoryteller] 发送请求到：", API);

    const res = await fetch(API, {
      method: "POST",
      body: form
    });

    if (!res.ok) {
      throw new Error("上传失败: " + res.status);
    }

    const data = await res.json();
    console.log("[AIStoryteller] 收到解析结果：", data);

    statusEl.textContent = "解析成功！构建页面中...";
    statusEl.style.color = "#66ff99";

    renderSlides(data.slides);

  } catch (e) {
    console.error("[AIStoryteller] 上传失败：", e);
    statusEl.textContent = "解析失败，请检查后端服务是否在线";
    statusEl.style.color = "#ff6666";
  }
});

// 4. 渲染解析结果
function renderSlides(slides) {
  slideContainer.innerHTML = ""; // 清空老内容

  if (!slides || slides.length === 0) {
    slideContainer.innerHTML = "<p style='color:#fff'>未解析到任何页面</p>";
    return;
  }

  slides.forEach((s, idx) => {
    const div = document.createElement("div");
    div.className = "slide-card";

    div.innerHTML = `
      <div class="slide-type-badge">${s.slide_type || "UNKNOWN"}</div>
      <h3>第 ${idx + 1} 页</h3>
      <pre>${JSON.stringify(s, null, 2)}</pre>
    `;

    slideContainer.appendChild(div);
  });

  console.log("[AIStoryteller] 页面渲染完成，共", slides.length, "页");
}
