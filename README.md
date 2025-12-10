# D-FlipFlop Simulation (D触发器物理仿真)

这是一个基于 Web 的 D 触发器 (D Flip-Flop) 物理行为仿真项目。

与传统的逻辑门模拟器不同，本项目**模拟了数字电路背后的模拟特性**，包括电压波动、高斯白噪声、RC 延迟（压摆率）以及亚稳态（Metastability）现象。通过内置的虚拟示波器，你可以直观地观察到时钟沿触发、建立/保持时间违例以及噪声对数字逻辑的影响。

## ✨ 核心特性

### 1. 硬核物理模拟引擎 (`src/physics.ts`)
不仅仅是 0 和 1 的逻辑变换，而是基于电压的连续模拟：
- **真实噪声模拟**：使用 **Box-Muller 变换** 生成符合正态分布的高斯白噪声，模拟真实电路中的热噪声。
- **RC 延迟与压摆率**：模拟导线和晶体管电容带来的充放电效应，信号变化呈现指数平滑曲线而非瞬间跳变。
- **亚稳态 (Metastability)**：当输入信号 D 在时钟上升沿的建立/保持时间窗口内发生变化时，模拟触发器输出的不确定性（随机坍缩到 0 或 1）。

### 2. 实时虚拟示波器 (`src/renderer.ts`)
- 基于 HTML5 Canvas 的高性能波形渲染。
- 支持高分屏 (Retina/HiDPI) 自动适配。
- 实时绘制 **D (输入)**、**CLK (时钟)** 和 **Q (输出)** 三路信号。
- 动态阈值线显示，辅助观察逻辑电平判定。

### 3. 交互式控制
- **Input D 控制**：手动切换输入信号的高低电平。
- **噪声注入**：动态调节信号中的噪声强度，观察高噪声下的逻辑错误。
- **仿真速度**：调节时钟频率，慢放观察信号跳变细节。

## 🛠️ 技术栈

- **语言**：[TypeScript](https://www.typescriptlang.org/) (全类型覆盖，严格模式)
- **构建工具**：[Vite](https://vitejs.dev/)
- **代码规范**：ESLint + Prettier (配置了针对 TypeScript 的严格检查)
- **样式**：CSS Variables + FontAwesome

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

```
src/
├── constants.ts    # 常量定义：电压标准、颜色配置、仿真参数
├── main.ts         # 主控制器：负责 UI 交互、物理循环调度与数据绑定
├── physics.ts      # 物理引擎：Signal 类与 DFlipFlop 逻辑实现
├── renderer.ts     # 渲染器：基于 Canvas 的示波器波形绘制
├── types.ts        # TypeScript 类型定义
└── styles/
    └── main.css    # 全局样式文件
```

## 📝 许可证

本项目采用 [MIT License](LICENSE) 许可证。
