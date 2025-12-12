/**
 * 主入口：初始化样式与应用
 */

import "@fortawesome/fontawesome-free/css/all.min.css";
import "./styles/main.scss";

import { SimulationApp } from "./simulator";
import { initSettingsSidebar } from "./settings";
import { initAboutSidebar } from "./about";

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
