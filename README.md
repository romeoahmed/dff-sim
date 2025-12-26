# D-FlipFlop Simulation (D触发器物理仿真)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Vite](https://img.shields.io/badge/Vite-8.0.0--beta.5-646cff)
![PixiJS](<https://img.shields.io/badge/PixiJS_(WebGPU)-e72264>)

这是一个基于 Web 的 D 触发器 (D Flip-Flop) 物理行为仿真项目。

与传统的逻辑门模拟器不同，本项目**模拟了数字电路背后的模拟特性**，包括电压波动、高斯白噪声、RC 延迟（压摆率）以及亚稳态（Metastability）现象。

在渲染层，项目已全面升级至 **PixiJS**，优先使用 **WebGPU** 后端，并配合 **Web Workers + OffscreenCanvas** 多线程架构，实现了逻辑计算与图形渲染的完全隔离。

## ✨ 核心特性

### 1. 下一代图形渲染架构 (PixiJS)

- **WebGPU 优先**：渲染核心采用 PixiJS，优先调用 WebGPU API，在不支持的环境下自动回退至 WebGL。
- **Web Worker 渲染**：利用 `OffscreenCanvas` 将 PixiJS 实例完全运行在 Worker 线程中。**主线程的 DOM 操作（如侧边栏动画、复杂的 CSS 重排）完全不会阻塞示波器的 60FPS/144FPS 渲染循环**。
- **批处理优化**：采用 PixiJS 的 `Graphics` 与 `MeshRope` 配合 WebGPU 的批处理能力，在同时绘制上千个数据点时，依旧维持极低的 CPU/GPU 开销。
- **动静分离**：将网格、标签等静态元素与波形动态元素分层管理，大幅减少每帧的 Draw Call。

### 2. 硬核物理模拟引擎 (`src/physics.ts`)

不仅仅是 0 和 1 的逻辑变换，而是基于电压的连续模拟：

- **真实噪声模拟**：使用 **Marsaglia Polar Method** 生成符合正态分布的高斯白噪声。
- **帧率无关的 RC 滤波**：实现了**基于时间步进 (Delta Time) 的指数衰减模型**。无论浏览器帧率波动还是卡顿，电压充放电的物理速度始终恒定，不会出现“波形变短”或“动画变慢”的现象。
- **亚稳态 (Metastability)**：精确模拟时钟沿触发时，输入信号处于未定义电压区间（0.6V~1.0V）时的随机坍缩行为。

### 3. 高鲁棒性的工程实践

- **Actor 模型架构**：主线程与 Worker 线程通过严格定义的消息协议（Message Passing）通信，解耦了 UI 逻辑与仿真核心。
- **手动渲染循环**：在 Worker 中接管了渲染主循环，**关闭 PixiJS 默认 Ticker**，确保物理计算与图形绘制的严格同步，消除画面撕裂。
- **Ring Buffer 优化**：使用位运算 (`&`) 代替取模运算，配合 `Float32Array` 实现 O(1) 复杂度的实时数据写入与回绕。

### 4. 交互式控制与配置

- **Input D 控制**：手动切换输入信号的高低电平。
- **参数动态调节**：实时调节输入噪声强度、时钟频率。
- **设置侧边栏**：支持动态修改物理电压规范（如逻辑高/低阈值），修改后 Worker 会自动重置缓冲区并重新校准基准线，实现无缝切换。

## 🛠️ 技术栈

- **语言**：[TypeScript](https://www.typescriptlang.org/) (全类型覆盖，严格模式)
- **渲染引擎**：[PixiJS](https://pixijs.com/) (WebGPU / WebGL)
- **多线程**：Web Workers + OffscreenCanvas
- **构建工具**：[Vite](https://vitejs.dev/)
- **样式**：[Sass](https://sass-lang.com/) (Dart Sass) + Catppuccin 主题
- **图标**：FontAwesome

## 🚀 快速开始

### 环境要求

- [Bun](https://bun.sh/) v1.0+ (推荐，用于快速部署)
- [Node.js](https://nodejs.org/) v18+ (可选，替代 Bun)
- 支持 WebGPU 或 WebGL 的现代浏览器 (Chrome 113+ 体验最佳)

### 安装依赖

```bash
bun install
```

### 启动开发服务器

```bash
bun run dev
```

打开浏览器访问 `http://localhost:5173` 即可看到仿真界面。

### 构建生产版本

```bash
bun run build
```

## 📂 项目结构

```bash
src/
├── archive/                        # 归档的旧版本代码
│   └── renderer-old.ts
├── common
│   ├── constants.ts                # 公共常量定义
│   └── types.ts                    # 公共类型定义
├── main
│   ├── app.ts                      # 主线程仿真应用类
│   ├── main.ts                     # 主入口文件
│   └── ui
│       ├── about.ts                # 关于侧边栏逻辑
│       └── settings.ts             # 设置侧边栏逻辑
├── styles/                         # 全局样式文件
└── worker
    ├── entry.ts                    # Worker 线程入口文件
    ├── physics
    │   ├── buffer.ts               # 波形数据缓冲区
    │   └── engine.ts               # 物理引擎实现
    └── render
        ├── backends
        │   ├── base.ts             # 渲染器基类定义
        │   ├── experimental.ts     # 实验性 MeshRope 渲染器
        │   └── standard.ts         # 标准 Graphics 渲染器
        └── host.ts                 # PixiJS Host 管理类

```

## 📝 许可证

本项目采用 [MIT License](LICENSE) 许可证。
