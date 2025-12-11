/**
 * 主入口：初始化样式与应用
 */

import "@fortawesome/fontawesome-free/css/all.min.css";
import "./styles/main.scss";

import { SimulationApp } from "./simulator";

// 侧边栏初始化
function initSidebar() {
  const btnAbout = document.getElementById("btn-about");
  const btnClose = document.getElementById("btn-close-sidebar");
  const sideBar = document.getElementById("sidebar-about");
  const overlay = document.getElementById("sidebar-overlay");

  if (!btnAbout || !btnClose || !sideBar || !overlay) {
    throw new Error("Sidebar elements not found");
  }

  const openSidebar = () => {
    sideBar.classList.add("active");
    sideBar.setAttribute("aria-hidden", "false");
    overlay.classList.add("active");
    document.body.style.overflow = "hidden"; // 防止背景滚动
  };

  const closeSidebar = () => {
    sideBar.classList.remove("active");
    sideBar.setAttribute("aria-hidden", "true");
    overlay.classList.remove("active");
    document.body.style.overflow = ""; // 恢复滚动
  };

  btnAbout.addEventListener("click", openSidebar);
  btnClose.addEventListener("click", closeSidebar);
  overlay.addEventListener("click", closeSidebar);

  // ESC 键关闭
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sideBar.classList.contains("active")) {
      closeSidebar();
    }
  });
}

// DOM 加载完成后启动
document.addEventListener("DOMContentLoaded", () => {
  try {
    new SimulationApp();
    initSidebar();
  } catch (e) {
    console.error("Critical System Failure:", e);
  }
});
