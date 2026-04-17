# DFF·SIM

**Physics-accurate digital logic simulation in the browser.**

[中文版本 →](#中文)

---

![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![WebGPU](https://img.shields.io/badge/WebGPU-enabled-ff6b35)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Overview

DFF·SIM is a browser-based simulation that models digital logic circuits at the **analog voltage level** rather than as ideal binary transitions. Every signal is a continuous voltage that rises and falls with realistic physics — including Gaussian noise, RC slew, second-order ringing, Schmitt-trigger hysteresis, and metastability resolution.

The oscilloscope renders at 60+ FPS on a dedicated WebGPU thread. The UI is a React instrument panel styled with Catppuccin Macchiato.

---

## Features

### Analog physics engine

| Effect | Implementation |
|--------|----------------|
| Gaussian white noise | Marsaglia Polar Method |
| 1/f flicker noise | Voss-McCartney octave accumulator |
| Voltage slew / RC delay | Damped second-order oscillator (ζ, ω) |
| Schmitt-trigger hysteresis | Separate HIGH/LOW threshold bands |
| Metastability | Random collapse when D is in the undefined zone on a clock edge |
| Frame-rate independence | All physics stepped by explicit `dt` |

### Circuits

| Circuit | Description |
|---------|-------------|
| **D Flip-Flop** | Single DFF showing edge-triggered capture, clock jitter, noise, and metastability |
| **4-Bit Accumulator** | Ripple-carry adder feeding four DFFs; demonstrates combinational + sequential interaction |

### Rendering

- **WebGPU** oscilloscope rendered entirely on a dedicated worker thread via `OffscreenCanvas` — the main thread never blocks waveform drawing
- Three shader styles: **Clean**, **Glow** (bloom), **Phosphor** (CRT scanline)
- Direct physics→render `MessagePort` channel: frame data bypasses the main thread entirely

### UI

- Per-circuit parameter controls (sliders, toggles, momentary buttons)
- Probe selector — choose which signals appear on the oscilloscope
- Circuit selector — switch between loaded circuit definitions at runtime
- Settings sheet and localisation toggle (English / 中文)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI framework | React 19 |
| Language | TypeScript 6 (strict) |
| Build | Vite 8 + Bun |
| State | Jotai 2 (atomic) |
| Worker RPC | Comlink 4 |
| GPU | WebGPU (`@webgpu/types`) |
| Styling | Tailwind CSS v4 + Catppuccin Macchiato |
| Components | Radix UI primitives |
| Animation | Motion (Framer Motion) |
| i18n | Lingui 5 (en / zh-CN) |
| Lint + format | Biome 2 |
| Tests | Vitest 4 + Testing Library |

---

## Quick Start

### Requirements

- [Bun](https://bun.sh/) v1.0+
- Chrome 113+ or another browser with WebGPU support (falls back to WebGL)

### Install and run

```bash
git clone https://github.com/romeoahmed/dff-sim.git
cd dff-sim
bun install
bun run dev
```

Open `http://localhost:5173`.

### Other commands

```bash
bun run build        # Production build → dist/
bun run preview      # Serve production build
bun run typecheck    # Type-check without emitting
bun run check        # Biome lint + format check
bun run test         # Run all tests
bun run test:watch   # Watch mode
```

---

## Architecture

```
┌─────────────────────────────────────┐
│          Main Thread (React)        │
│  Jotai atoms · hooks · components   │
│         Comlink RPC ↕               │
└──────────┬──────────────────────────┘
           │
┌──────────▼──────────┐   MessagePort   ┌─────────────────────┐
│   Physics Worker    │ ─────────────▶  │   Render Worker     │
│  SimulationEngine   │  Float32 frames │  WebGPU pipelines   │
│  CircuitGraph       │                 │  WGSL shaders       │
│  Component tick     │                 │  OffscreenCanvas    │
└─────────────────────┘                 └─────────────────────┘
```

**Physics worker** runs the simulation loop: `seq.update → propagate → seq.clock → propagate → evaluateCombinational → propagate → buffer.push`. It owns the `CircuitGraph`, which levelizes combinational components (Kahn topological sort) so carry chains evaluate in the correct order.

**Render worker** receives `Float32Array` frames over a direct `MessagePort` and draws waveforms via custom WGSL shaders. Frame data never passes through the main thread.

---

## Project Structure

```
src/
├── atoms/                   # Jotai atoms (simulation state, UI state)
├── circuits/                # Circuit definitions (DFF, 4-bit accumulator)
├── components/
│   ├── controls/            # ControlPanel, ParamSlider, ParamToggle, ParamMomentary
│   ├── nav/                 # Toolbar, CircuitSelector, SettingsSheet
│   ├── oscilloscope/        # OscilloscopePanel (canvas host)
│   └── schematic/           # CircuitSchematic (SVG)
├── hooks/                   # useSimulation (worker bridge integration)
├── lib/                     # Types, constants, worker bridge, RNG utilities
├── locales/                 # Lingui i18n catalogs (en, zh-CN)
├── styles/                  # Catppuccin theme
├── test/                    # Test setup and component tests
└── workers/
    ├── physics/             # SimulationEngine, CircuitGraph, all components
    └── render/              # WebGPU pipelines, gpu-device, WGSL shaders
```

---

## License

[MIT](LICENSE)

---
---

# 中文

**在浏览器中运行的物理精确数字逻辑仿真。**

[English version ↑](#dffsim)

---

## 概述

DFF·SIM 是一个基于浏览器的仿真项目，它在**模拟电压层面**对数字逻辑电路进行建模，而非理想的二进制跳变。每个信号都是一个连续变化的电压，具有真实的物理特性——包括高斯噪声、RC 压摆、二阶振铃、施密特触发器迟滞效应和亚稳态消解。

示波器在独立的 WebGPU 线程上以 60+ FPS 渲染。UI 是一个以 Catppuccin Macchiato 配色的 React 仪器面板。

---

## 特性

### 模拟物理引擎

| 效果 | 实现方式 |
|------|---------|
| 高斯白噪声 | Marsaglia 极坐标法 |
| 1/f 闪烁噪声 | Voss-McCartney 倍频程累加器 |
| 电压压摆 / RC 延迟 | 有阻尼二阶振荡器（ζ、ω） |
| 施密特触发器迟滞 | 独立的高/低电平阈值带 |
| 亚稳态 | 时钟沿时 D 处于未定义区间，输出随机坍缩 |
| 帧率无关 | 所有物理计算均以显式 `dt` 步进 |

### 电路

| 电路 | 描述 |
|------|------|
| **D 触发器** | 单个 DFF，展示边沿触发捕获、时钟抖动、噪声和亚稳态 |
| **4 位累加器** | 行波进位加法器驱动四个 DFF，演示组合逻辑与时序逻辑的交互 |

### 渲染

- **WebGPU** 示波器完全在独立 Worker 线程通过 `OffscreenCanvas` 渲染——主线程永远不会阻塞波形绘制
- 三种着色器风格：**Clean**（清晰）、**Glow**（发光/泛光）、**Phosphor**（CRT 磷光屏）
- 物理→渲染直通 `MessagePort` 通道：帧数据完全绕过主线程传输

### UI

- 各电路的参数控件（滑块、开关、瞬时按钮）
- 探针选择器——选择哪些信号显示在示波器上
- 电路选择器——运行时在已加载的电路定义之间切换
- 设置面板和语言切换（English / 中文）

---

## 技术栈

| 层次 | 技术 |
|------|------|
| UI 框架 | React 19 |
| 语言 | TypeScript 6（严格模式） |
| 构建 | Vite 8 + Bun |
| 状态管理 | Jotai 2（原子化） |
| Worker RPC | Comlink 4 |
| GPU | WebGPU（`@webgpu/types`） |
| 样式 | Tailwind CSS v4 + Catppuccin Macchiato |
| 组件库 | Radix UI 原语 |
| 动画 | Motion（Framer Motion） |
| 国际化 | Lingui 5（en / zh-CN） |
| 代码检查与格式化 | Biome 2 |
| 测试 | Vitest 4 + Testing Library |

---

## 快速开始

### 环境要求

- [Bun](https://bun.sh/) v1.0+
- Chrome 113+ 或其他支持 WebGPU 的浏览器（自动降级为 WebGL）

### 安装与运行

```bash
git clone https://github.com/romeoahmed/dff-sim.git
cd dff-sim
bun install
bun run dev
```

打开 `http://localhost:5173`。

### 其他命令

```bash
bun run build        # 生产构建 → dist/
bun run preview      # 本地预览生产构建
bun run typecheck    # 仅类型检查，不生成文件
bun run check        # Biome 代码检查 + 格式验证
bun run test         # 运行全部测试
bun run test:watch   # 监视模式
```

---

## 架构

```
┌─────────────────────────────────────┐
│        主线程（React UI）            │
│  Jotai 原子 · Hooks · 组件           │
│         Comlink RPC ↕               │
└──────────┬──────────────────────────┘
           │
┌──────────▼──────────┐   MessagePort   ┌─────────────────────┐
│    物理 Worker       │ ─────────────▶  │   渲染 Worker        │
│  SimulationEngine   │  Float32 帧数据  │  WebGPU 管线         │
│  CircuitGraph       │                 │  WGSL 着色器          │
│  组件 Tick 循环       │                 │  OffscreenCanvas    │
└─────────────────────┘                 └─────────────────────┘
```

**物理 Worker** 运行仿真循环：`seq.update → propagate → seq.clock → propagate → evaluateCombinational → propagate → buffer.push`。它持有 `CircuitGraph`，后者通过 Kahn 拓扑排序对组合逻辑组件分层，确保进位链按正确顺序求值。

**渲染 Worker** 通过直通 `MessagePort` 接收 `Float32Array` 帧数据，并使用自定义 WGSL 着色器绘制波形。帧数据完全不经过主线程。

---

## 项目结构

```
src/
├── atoms/                   # Jotai 原子（仿真状态、UI 状态）
├── circuits/                # 电路定义（DFF、4 位累加器）
├── components/
│   ├── controls/            # ControlPanel, ParamSlider, ParamToggle, ParamMomentary
│   ├── nav/                 # Toolbar, CircuitSelector, SettingsSheet
│   ├── oscilloscope/        # OscilloscopePanel（画布宿主）
│   └── schematic/           # CircuitSchematic（SVG 示意图）
├── hooks/                   # useSimulation（Worker 桥接集成）
├── lib/                     # 类型定义、常量、Worker 桥接、RNG 工具
├── locales/                 # Lingui 国际化目录（en、zh-CN）
├── styles/                  # Catppuccin 主题
├── test/                    # 测试配置和组件测试
└── workers/
    ├── physics/             # SimulationEngine、CircuitGraph、所有组件
    └── render/              # WebGPU 管线、gpu-device、WGSL 着色器
```

---

## 许可证

[MIT](LICENSE)
