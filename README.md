# D-FlipFlop Simulation (D触发器物理仿真)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Vite](https://img.shields.io/badge/Vite-8.0.0--beta.1-646cff)

这是一个基于 Web 的 D 触发器 (D Flip-Flop) 物理行为仿真项目。

与传统的逻辑门模拟器不同，本项目**模拟了数字电路背后的模拟特性**，包括电压波动、高斯白噪声、RC 延迟（压摆率）以及亚稳态（Metastability）现象。

为了实现极致的性能和鲁棒性，项目采用了 **Web Workers + OffscreenCanvas** 的多线程架构，将繁重的物理计算与渲染逻辑与 UI 主线程完全隔离。

## ✨ 核心特性

### 1. 极致性能的多线程架构

- **UI/渲染隔离**：采用 **Actor 模型**，主线程仅负责 DOM 交互和状态同步。
- **Web Workers**：物理引擎和渲染循环在独立线程中运行，**即使主线程因复杂 DOM 操作卡顿，示波器波形依然保持丝滑 60FPS**。
- **OffscreenCanvas**：利用离屏画布技术，直接在 Worker 线程中对接 GPU 进行渲染。

### 2. 硬核物理模拟引擎 (`src/physics.ts`)

不仅仅是 0 和 1 的逻辑变换，而是基于电压的连续模拟：

- **真实噪声模拟**：使用 **Marsaglia Polar Method** 生成符合正态分布的高斯白噪声。
- **RC 延迟与压摆率**：实现**帧率无关 (Frame-Rate Independent)** 的指数衰减模型，无论帧率如何波动，电压充放电速度始终符合物理时间。
- **亚稳态 (Metastability)**：精确模拟时钟沿触发时的建立/保持时间违例。

### 3. 实时虚拟示波器 (`src/renderer.ts`)

- 基于 HTML5 Canvas 的高性能波形渲染。
- 支持高分屏 (Retina/HiDPI) 自动适配。
- 实时绘制 **D (输入)**、**CLK (时钟)** 和 **Q (输出)** 三路信号。
- 动态阈值线显示，辅助观察逻辑电平判定。
- **Ring Buffer 优化**：使用位运算 (`&`) 代替取模运算，配合 `Float32Array` 实现 O(1) 复杂度的实时数据写入。
- **双循环遍历**：直接操作内存指针，避免了数组拷贝和迭代器开销。

### 4. 交互式控制

- **Input D 控制**：手动切换输入信号的高低电平。
- **噪声注入**：动态调节信号中的噪声强度，观察高噪声下的逻辑错误。
- **仿真速度**：调节时钟频率，慢放观察信号跳变细节。
- **动态参数**：实时调节输入噪声、时钟频率和电压阈值。
- **工程鲁棒性**：包含完整的输入校验和错误边界处理。

## 🛠️ 技术栈

- **语言**：[TypeScript](https://www.typescriptlang.org/) (全类型覆盖，严格模式)
- **构建工具**：[Vite](https://vitejs.dev/)
- **图形核心**：Canvas API + OffscreenCanvas
- **多线程**：Web Workers
- **代码规范**：ESLint + Prettier (配置了针对 TypeScript 的严格检查)
- **样式**：[Sass](https://sass-lang.com/) (Dart Sass) + Catppuccin 主题 + FontAwesome

## 🚀 快速开始

### 环境要求

- Node.js (推荐 v18+)
- pnpm (推荐) 或 npm/yarn

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
pnpm dev
```

打开浏览器访问 `http://localhost:5173` 即可看到仿真界面。

### 构建生产版本

```bash
pnpm build
```

## 📂 项目结构

```plain
src/
├── main.ts                 # 主入口：初始化样式与应用
├── constants.ts            # 常量定义：电压标准、颜色配置、仿真参数
├── physics.ts              # 物理模拟引擎：处理电压、噪声与逻辑门行为
├── renderer.ts             # 渲染器：基于 Canvas 的示波器波形绘制
├── simulator.ts            # 仿真控制器：主线程与 Worker 通信
├── simulation.worker.ts    # 仿真 Worker：运行物理模拟循环
├── about.ts                # 关于页面逻辑
├── settings.ts             # 设置页面逻辑
├── types.ts                # TypeScript 类型定义
└── styles/
    ├── main.scss           # 样式主入口文件
    ├── _variables.scss     # 变量定义（颜色、阴影、字体、动画时长）
    ├── _reset.scss         # 基础重置和滚动条样式
    ├── _layout.scss        # 容器、header、main 布局
    ├── _sidebar.scss       # 侧边栏样式
    ├── _oscilloscope.scss  # 示波器面板和图例
    ├── _chip.scss          # 芯片可视化、引脚、发光效果（含 @mixin glow）
    ├── _controls.scss      # 控制面板、滑块、按钮、信息框
    └── _responsive.scss    # 响应式媒体查询
```

## 📝 许可证

本项目采用 [MIT License](LICENSE) 许可证。
