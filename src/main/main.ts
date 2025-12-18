/**
 * 主入口：初始化样式与应用
 */

import "@fortawesome/fontawesome-free/css/all.min.css";
import "../styles/main.scss";

import { SimulationApp } from "./app";
import { initSettingsSidebar } from "./ui/settings";
import { initAboutSidebar } from "./ui/about";

// DOM 加载完成后启动
document.addEventListener("DOMContentLoaded", () => {
  try {
    const app = new SimulationApp();
    initSettingsSidebar(app);
    initAboutSidebar();
  } catch (e) {
    console.error("Critical System Failure:", e);
  }
});
