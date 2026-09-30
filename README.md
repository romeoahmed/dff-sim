# <img src="public/favicon.svg" width="36" height="36" alt="" /> 一位记忆

面向初学者的 D 触发器交互实验台。改变输入、推进时钟，用逻辑波形理解一位信息如何被采样、保持与清零。

- **六步引导**：先预测 Q，再执行操作，对照结果理解原理。
- **自由探索**：切换 D、单步推进或自动运行时钟，随时启用异步复位。
- **逻辑分析仪**：观察 D、CLK、Q、RST 四路波形，回看最近 64 条操作记录。

## 开始使用

需要 **Node.js 24+** 和 **pnpm**。浏览器需支持 OffscreenCanvas、Popover、CSS `@scope` 等原生能力。

```sh
git clone https://github.com/romeoahmed/dff-sim.git
cd dff-sim
pnpm install --frozen-lockfile
pnpm dev
```

打开终端给出的本地地址，点击「开始引导」。也可以直接操作实验台：将 D 设为 1，产生上升沿，再把 D 改回 0，观察 Q 是否仍保持为 1。

## 实验约定

RST 为 0 时，Q 在 CLK 从 0 变为 1 的上升沿采样 D，其他时刻保持。RST 为 1 时立即清零 Q，优先于时钟；释放复位后，Q 保持为 0，等待下一个上升沿。

波形横轴表示**操作顺序**，每格对应一步操作。回看记录会暂停自动时钟，上方控制区仍显示最新状态。

实验使用理想二值逻辑，按顺序处理操作，并约定所有信号从 0 开始。真实器件的时序要求与上电状态以规格书为准。

## 开发

[TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/)，搭配原生 HTML 和模块化 CSS。波形由 Web Worker 中的 OffscreenCanvas / Canvas2D 绘制；图标使用 [Lucide](https://lucide.dev/)。

| 命令           | 用途                           |
| -------------- | ------------------------------ |
| `pnpm fmt`     | 格式化代码与文档               |
| `pnpm check`   | 检查类型、代码规则、CSS 与格式 |
| `pnpm build`   | 执行完整检查，构建到 `dist/`   |
| `pnpm preview` | 本地预览构建结果               |

修改后运行 `pnpm build`；交互或逻辑变更还需在浏览器中复核引导、复位、历史回看与自动时钟。

## 许可证

[MIT](LICENSE) © 2026 Romeo Ahmed
