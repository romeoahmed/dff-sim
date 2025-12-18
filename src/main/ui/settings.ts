/**
 * 设置侧边栏功能
 */

import { VoltageSpecs } from "../../common/constants";
import type { VoltageSpecConfig } from "../../common/types";
import { SimulationApp } from "../app";

// 可编辑的设置项
const editableKeys: (keyof VoltageSpecConfig)[] = [
  "logicHighMin",
  "logicLowMax",
  "outputHighMin",
  "outputHighMax",
  "outputLowMax",
];

// 保存默认值用于重置 (浅拷贝)
const defaultSpecs = { ...VoltageSpecs };

// 设置侧边栏初始化
export function initSettingsSidebar(app: SimulationApp) {
  const btnSettings = document.getElementById("btn-settings");
  const btnClose = document.getElementById("btn-close-settings");
  const sideBar = document.getElementById("sidebar-settings");
  const overlay = document.getElementById("sidebar-overlay");
  const form = document.getElementById("settings-form");
  const errorMsg = document.getElementById("settings-error");
  const btnSave = document.getElementById("btn-save-settings");
  const btnReset = document.getElementById("btn-reset-settings");

  // --- 类型检查 ---
  if (
    !btnSettings ||
    !btnClose ||
    !sideBar ||
    !overlay ||
    !form ||
    !errorMsg ||
    !btnSave ||
    !btnReset
  ) {
    throw new Error("Settings sidebar elements not found");
  }
  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Settings form is not an HTMLFormElement");
  }
  if (!(btnSave instanceof HTMLButtonElement)) {
    throw new Error("Save button is not an HTMLButtonElement");
  }
  if (!(btnReset instanceof HTMLButtonElement)) {
    throw new Error("Reset button is not an HTMLButtonElement");
  }

  // 打开/关闭逻辑
  const openSidebar = () => {
    sideBar.classList.add("active");
    sideBar.setAttribute("aria-hidden", "false");
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";

    // 初始化表单值
    for (const key of editableKeys) {
      const input = form.elements.namedItem(key);
      if (input instanceof HTMLInputElement) {
        input.value = String(VoltageSpecs[key]);
        input.placeholder = String(defaultSpecs[key]); // 设置淡色默认值
      }
    }

    errorMsg.textContent = "";
    btnSave.disabled = false;
  };

  const closeSidebar = () => {
    sideBar.classList.remove("active");
    sideBar.setAttribute("aria-hidden", "true");
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  };

  btnSettings.addEventListener("pointerdown", openSidebar);
  btnClose.addEventListener("pointerdown", closeSidebar);
  overlay.addEventListener("pointerdown", closeSidebar);

  // ESC 键关闭
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sideBar.classList.contains("active")) {
      closeSidebar();
    }
  });

  // 校验逻辑
  function validate(values: Partial<VoltageSpecConfig>): string | null {
    const {
      logicHighMin,
      logicLowMax,
      outputHighMin,
      outputHighMax,
      outputLowMax,
    } = values;
    const { clampMin, systemMax } = defaultSpecs;

    // 辅助函数：检查数值有效性
    const isInvalid = (v: number | undefined) => v === undefined || isNaN(v);

    if (
      isInvalid(logicHighMin) ||
      isInvalid(logicLowMax) ||
      isInvalid(outputHighMin) ||
      isInvalid(outputHighMax) ||
      isInvalid(outputLowMax)
    ) {
      return "数值不能为空";
    }

    if (
      logicLowMax! < clampMin ||
      outputLowMax! < clampMin ||
      logicHighMin! > systemMax ||
      outputHighMax! > systemMax ||
      outputHighMin! < logicHighMin! ||
      outputHighMax! < outputHighMin! ||
      logicLowMax! >= logicHighMin! ||
      outputLowMax! >= logicLowMax!
    ) {
      return "参数范围冲突，请检查逻辑电平的高低关系";
    }
    return null;
  }

  // 表单输入事件，实时校验
  form.addEventListener("input", () => {
    const values: Partial<VoltageSpecConfig> = {};
    for (const key of editableKeys) {
      const input = form.elements.namedItem(key);
      if (input instanceof HTMLInputElement) {
        values[key] = parseFloat(input.value);
      }
    }

    const err = validate(values);
    errorMsg.textContent = err || "";
    btnSave.disabled = !!err;

    if (err) {
      errorMsg.classList.add("active");
    } else {
      errorMsg.classList.remove("active");
    }
  });

  // 保存设置
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const values: Partial<VoltageSpecConfig> = {};
    for (const key of editableKeys) {
      const input = form.elements.namedItem(key);
      if (input instanceof HTMLInputElement) {
        values[key] = parseFloat(input.value);
      }
    }

    const err = validate(values);
    if (err) return;

    // 应用设置
    Object.assign(VoltageSpecs, values);

    app.updateSettings(values);
  });

  // 恢复默认
  btnReset.addEventListener("click", () => {
    // 恢复默认值到表单
    Object.assign(VoltageSpecs, defaultSpecs);

    for (const key of editableKeys) {
      const input = form.elements.namedItem(key);
      if (input instanceof HTMLInputElement) {
        input.value = String(defaultSpecs[key]);
      }
    }

    errorMsg.textContent = "";
    errorMsg.classList.remove("active");
    btnSave.disabled = false;

    app.updateSettings(defaultSpecs);
  });
}
