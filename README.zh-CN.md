# DFF·SIM

**在浏览器中运行的物理精确数字逻辑仿真。**

[English](./README.md) · 中文

![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![WebGPU](https://img.shields.io/badge/WebGPU-enabled-ff6b35)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 概述

DFF·SIM 是一个在浏览器中运行的数字逻辑电路仿真器，它在**模拟电压层面**对电路进行建模，而不是视作理想的二进制跳变。每一根导线上都流淌着连续变化的电压，具备真实的物理特性——高斯噪声、RC 压摆、二阶振铃、施密特触发器迟滞、逐门传播延迟，以及可以在示波器上看到稳定悬停在中点、最终随机跌入某一条轨道的亚稳态。

它是一块仪器面板，而非 HDL 仿真器。目标是让你在示波器上看到数字逻辑真正的物理形态——教科书里被"高低电平"掩盖的那些不完美。

示波器在独立的 WebGPU 线程上以 60+ FPS 渲染。UI 是一个 React 仪器面板，采用受 Apple 启发的双主题（明亮 + 深色，可在运行时切换），基于 shadcn/ui 原语之上的 Tailwind v4 构建，控制面板与设置面板使用 CSS Subgrid 实现行间对齐。

---

## 物理模型

| 效果 | 实现方式 |
|------|---------|
| 高斯白噪声 | Marsaglia 极坐标法 |
| 1/f 闪烁噪声 | Voss-McCartney 倍频程累加器 |
| 电压压摆与振铃 | 有阻尼二阶振荡器（ζ、ωₙ） |
| 施密特触发器迟滞 | 双阈值带；处于带内的电压会保持上一状态 |
| 传播延迟 | 每个门独立的 `tPD`，由每个模拟输出上的挂起目标计时器实现 |
| 亚稳态 | 指数分布的消解时间；Q 在中点电压处明显悬停；最终结果由时钟沿时 D 电压加高斯抖动决定偏向，而非公平硬币 |
| 帧率无关 | 所有物理计算均以显式 `dt` 步进 |

每个组合逻辑门（`ANDGate`、`ORGate`、`XORGate`、`NOTGate`、`FullAdder`）都持有自己的 `AnalogOutput`——一个 `Signal`、一个 `NoiseGenerator` 加一个 `tPD` 计时器——因此 DFF 具备的动力学也端到端地存在于组合逻辑中。反馈电路（SR 锁存器、环形振荡器、非稳态多谐振荡器）都是合法的电路，拓扑排序不再用于拒绝环路。

---

## 电路

| 电路 | 现象 |
|------|------|
| **D 触发器** | 展示边沿触发捕获、时钟抖动、输出噪声和亚稳态。把 D 输入停在施密特带内，紧接着来一个上升沿，你会看到 Q 在中点明显悬停一段随机时长，然后跳向 HIGH 或 LOW，倾向由 D 实际位置决定。 |
| **4 位累加器** | 行波进位加法器驱动四个 DFF。每个全加器都有独立的 `tPD`，因此每次时钟沿都能看到进位在链路中级联传播——Q0 先稳定，然后 Q1、Q2、Q3 依次跟进——而非四位同时翻转。 |

---

## 渲染

- **WebGPU** 示波器完全在独立 Worker 线程上通过 `OffscreenCanvas` 渲染，主线程永远不会阻塞波形绘制。
- 三种片元着色器风格：**Clean**（清晰）、**Glow**（辉光泛光）、**Phosphor**（带老化衰减的 CRT 荧光屏）。
- **逐通道虚线样式**（实线、长划线、点、点划线），即使不依赖颜色也能区分波形——虚线在模拟波形视图和数字逻辑视图下、三种着色器风格下均有效。
- 物理→渲染直通 `MessagePort` 通道：帧数据完全绕过主线程。

---

## UI 与可访问性

- 每个电路各自的参数控件（滑块、开关、瞬时按钮），基于 shadcn/ui 原语（Radix + Tailwind），统一组合在 CSS Subgrid 中——无论标签字符串长短，每一行的标签列与值列都精确对齐。
- 探针选择器——选择示波器上显示哪些信号。
- 电路选择器——运行时在已加载的电路定义之间切换。
- 设置面板（电压区间可覆盖，同样使用 subgrid 对齐）、关于面板，以及一个居中的键盘快捷键对话框（按 `?` 打开）。
- **双主题**：受 Apple 启发的明亮 / 深色主题，工具栏中的 Sun/Moon 按钮可运行时切换，选择持久化至 `localStorage`。token 分两层——项目语义层（`--color-canvas`、`--color-fg`、`--color-accent` …）加 shadcn 别名层（`--background`、`--primary`、`--ring` …）——使生成的 `components/ui/*.tsx` 文件保持原样不被改动。
- **本地化**：工具栏中的 Globe 按钮可在 English / 中文 之间切换。Chrome 字符串（工具栏、状态栏、各类面板、覆盖层、控件标题、原理图标题）均使用 Lingui 宏包裹，切换即时生效。电路定义中的标签（探针名、控件标签）有意保留英文——属未来工作。
- **可访问性**：画布与 SVG 原理图都带有规范的 `aria-label` / `role="img"` / `<title>` / `<desc>`；原理图描述由 `CircuitDefinition` 自动派生（组件类型计数 + 网表数量 + 定义文本）。一个视觉上隐藏的 live region 只在探针跨越施密特阈值时（HIGH ↔ LOW）宣告逻辑跳变——不会产生 60 Hz 的电压洪流。虚线样式为波形区分提供了与颜色相独立的第二通道。每一个交互元素都有 Apple 蓝色的 focus ring。

---

## 技术栈

| 层次 | 技术 |
|------|------|
| UI 框架 | React 19 |
| 语言 | TypeScript 6（严格模式 — `noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`verbatimModuleSyntax`） |
| 构建 | Vite 8（rolldown） + `@vitejs/plugin-react-swc` + Bun |
| 状态管理 | Jotai 2（原子化 + `atomWithStorage` 用于主题持久化） |
| Worker RPC | Comlink 4 |
| GPU | WebGPU（`@webgpu/types`） |
| 样式 | Tailwind CSS v4（CSS-first 配置）+ Apple 风格双主题 + CSS Subgrid |
| 组件库 | shadcn/ui（button、slider、switch、toggle-group、dialog、sheet）基于 `radix-ui` |
| 动画 | Motion（`motion/react`） |
| 国际化 | Lingui 5 + `@lingui/swc-plugin`（en / zh-CN，运行时通过 `useLocaleSync` 切换语言） |
| 代码检查与格式化 | Biome 2 |
| 测试 | Vitest 4 + Testing Library + happy-dom（宏在 `test/setup.ts` 中以运行时 shim 替代） |

---

## 快速开始

### 环境要求

- [Bun](https://bun.sh/) v1.0+
- Chrome 113+ 或其他支持 WebGPU 的浏览器

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
bun run build            # 生产构建 → dist/
bun run preview          # 本地预览生产构建
bun run typecheck        # 仅类型检查，不生成文件
bun run check            # Biome 代码检查 + 格式验证
bun run check:fix        # Biome 自动修复
bun run test             # 运行全部测试（Vitest）
bun run test:watch       # 监视模式
bun run test:ui          # 浏览器测试界面
bun run lingui:extract   # 扫描源码中的可翻译字符串 → .po
bun run lingui:compile   # 编译 .po → .mjs 目录
```

---

## 架构

三条线程，两跳通信：

```
┌─────────────────────────────────────┐
│         主线程（React UI）          │
│    Jotai 原子 · Hooks · 组件        │
│             Comlink RPC ↕           │
└──────────┬──────────────────────────┘
           │
┌──────────▼──────────┐   MessagePort   ┌─────────────────────┐
│    物理 Worker       │ ─────────────▶  │   渲染 Worker        │
│  SimulationEngine   │  Float32 帧数据  │  WebGPU 管线         │
│  CircuitGraph       │                 │  WGSL 着色器          │
│  组件 Tick 循环       │                 │  OffscreenCanvas    │
└─────────────────────┘                 └─────────────────────┘
```

每一次物理 tick 按以下阶段顺序执行：

```
seq.update(dt)           // DFF Signal 步进，挂起 Q 计时器
propagate                // DFF 输出通过网络扇出
seq.clock(dt)            // DFF 边沿检测，采样 D，排入挂起队列
evaluateCombinational()  // 组合门读取输入，排入挂起输出目标
updateCombinational(dt)  // 组合门 tPD 计时，推进 Signal，写出到输出端口
propagate                // 组合门输出扇出
buffer.push              // 探针电压写入环形缓冲
```

帧数据通过直连 `MessagePort` 由物理 worker 送达渲染 worker——完全不经过主线程。渲染 worker 将帧上传到 GPU 存储缓冲区，并以实例化三角形条带的方式绘制每一条波形。

---

## 项目结构

```
src/
├── atoms/                   # Jotai 原子（电路、电压、参数、主题、语言、面板可见性、电压区间配置）
├── circuits/                # 电路定义（DFF、累加器、环形振荡器）
├── components/
│   ├── ui/                  # shadcn/ui 原语（button、slider、switch、toggle-group、dialog、sheet）
│   ├── controls/            # ControlPanel（subgrid 父容器）、ParamSlider、ParamToggle、ParamMomentary、ProbeSelector
│   ├── nav/                 # Toolbar（主题/语言/着色器/信息切换）、CircuitSelector
│   ├── oscilloscope/        # OscilloscopePanel、WaveformCanvas、DigitalCanvas、InstrumentBezel、LiveVoltageReadouts、Legend、ProbeStateAnnouncer
│   ├── schematic/           # CircuitSchematic（横向 <1440 / 纵向 ≥1440）、SchematicGrid/Node/Wire、describe 辅助函数
│   ├── settings/            # SettingsSheet（电压区间覆盖，subgrid 对齐）
│   ├── about/               # AboutSheet
│   ├── shortcuts/           # ShortcutsOverlay
│   ├── status/              # StatusStrip
│   ├── fallback/            # WebGPUUnavailable
│   └── layout/              # AppLayout（响应式 1/2/3 列网格）
├── hooks/                   # useSimulation、useThemeSync、useLocaleSync、useKeyboardShortcuts、useMediaQuery
├── i18n/                    # Lingui 国际化：index.ts（loader）+ locales/{en,zh-CN}/messages.{po,mjs}
├── lib/                     # 类型定义、常量、Worker 桥接、RNG 工具、Zod 校验、cn() 辅助
├── styles/                  # globals.css —— 双主题 token + shadcn 别名 + Tailwind v4 @theme
├── test/                    # 测试配置（Lingui 宏 shim）+ 组件 / hook / i18n 测试
└── workers/
    ├── physics/             # SimulationEngine、CircuitGraph、Signal、NoiseGenerator、AnalogOutput、gaussian、components/
    └── render/              # WebGPU 管线、gpu-device、WGSL 着色器（vert + clean/glow/phosphor/digital）
```

`docs/superpowers/` 目录下保留了产出当前行为的设计规范和实现计划——如果你想了解某项设计背后的取舍原因，而不仅仅是最终代码，这里是入口。

---

## 许可证

[MIT](LICENSE)
