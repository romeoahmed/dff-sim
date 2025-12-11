/**
 * 主入口：初始化样式与应用
 */

import "@fortawesome/fontawesome-free/css/all.min.css";
import "./styles/main.scss";

import { SimulationApp } from "./simulator";
import { initSettingsSidebar } from "./settings";
import { initAboutSidebar } from "./about";

// 全局声明 window.simulationApp
declare global {
  interface Window {
    simulationApp: SimulationApp;
  }
}

// DOM 加载完成后启动
document.addEventListener("DOMContentLoaded", () => {
  try {
    window.simulationApp = new SimulationApp();
    initSettingsSidebar();
    initAboutSidebar();
  } catch (e) {
    console.error("Critical System Failure:", e);
  }
});
