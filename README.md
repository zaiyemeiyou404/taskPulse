# Task Pulse

> 给 Hermes / OpenCode / DeepSeek 任务流做的实时驾驶舱。看见每个任务的状态、阶段、日志、通知与最终产物。

![dashboard](https://raw.githubusercontent.com/zaiyemeiyou404/task-Pluse/main/public/screenshots/dashboard-home-v2.png)

## 项目简介

Task Pulse 是一个面向 AI Agent 和 Coding Runner 的实时任务看板，基于 **Next.js 16 + React 19 + Tailwind 4 + TypeScript** 构建。

它的核心目标不是单纯提交任务，而是把任务执行过程拆成**可观察的事件流、日志流、状态时间线和产物面板**，方便在浏览器里盯执行过程。

适合配合 OpenCode、Hermes Agent、Codex 等执行器使用。

## 近期更新

- 公开站点已切换为**只读模式**，网页端不再暴露任务启动入口，仅保留任务状态、日志、通知与产物监控。
- 新增**小说创作**分类与筛选标签，便于把长篇写作任务从普通聊天任务中单独观察。
- 修正总览页 `Task Pulse 完善` 分组的仓库链接为：`https://github.com/zaiyemeiyou404/task-Pluse`

---

## 页面一览

### 总览看板 `/`

![dashboard-expanded](https://raw.githubusercontent.com/zaiyemeiyou404/task-Pluse/main/public/screenshots/dashboard-expanded.png)

- 统计卡片：运行中、已阻塞、待命令同意、已完成、失败、总数
- 只读安全提示：网页端任务启动入口已关闭，仅保留状态、日志、通知与产物监控
- 按大任务分组的实时任务列表，支持：
  - 搜索 / 状态筛选 / 类别筛选
  - 点击展开查看子任务及修改时间
  - **整行可点击**跳转详情页（优化移动端触摸体验）

### 任务详情 `/tasks/[taskId]`

![detail](https://raw.githubusercontent.com/zaiyemeiyou404/task-Pluse/main/public/screenshots/detail.png)

- 实时状态卡：阶段、耗时、最近更新时间、事件数、日志数、通知数
- 快速入口：产物链接、通知链接
- 任务摘要：通俗易懂的中文说明
- 阶段时间线：生命周期可视化（排队 → 评估 → 启动 → 编码 → 测试 → 汇总 → 完成）
- 操作按钮：批准命令 / 停止 / 重试 / 删除 / 复制 ID

![detail-events](https://raw.githubusercontent.com/zaiyemeiyou404/task-Pluse/main/public/screenshots/detail-events.png)

- **事件流**：Agent 正在执行的语义化时间线（SSE 实时推送）
- **实时日志**：原始 stdout / stderr / system 流，支持自动滚动
- 标签页：概览 / 产物 / 文件 / 通知 / 原始 JSON
- coding 任务自动生成**功能更新摘要**（类似 GitHub Release Notes）
- chat 任务展示**聊天处理记录**（请求 → 分析 → 回复链路）

---

## 主要功能

| 功能 | 说明 |
|------|------|
| ✅ 实时仪表盘 | 统计卡片 + 搜索 + 筛选 + 分组折叠 |
| ✅ SSE 实时推送 | 基于版本变化的 Server-Sent Events，1 秒心跳保活 |
| ✅ 任务详情页 | 阶段时间线、事件流、日志、产物 |
| ✅ 命令审批 | 支持 `approval_required` 状态，页面批准按钮 |
| ✅ 产物展示 | 链接跳转 / 文件下载 / 内联展示 |
| ✅ 操作支持 | 停止、重试、删除、复制 ID |
| ✅ 任务分组 | 按项目/大任务自动分组，支持仓库链接 |
| ✅ 中文界面 | 全中文 UI，状态/阶段/摘要均为中文 |
| ✅ 运行截图 | 见上方预览图 |
| ✅ 移动端适配 | 整行可点击，触摸友好 |
| ✅ 只读模式 | 下线网页端 AI/任务创建入口，仅保留监控能力 |
| ✅ 新状态标签 | `approval_required` 在界面显示为“待命令同意” |

---

## 快速开始

### 环境要求

- Node.js >= 18
- npm

### 安装与启动

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产模式
npm run build
npm run start
```

默认地址：`http://localhost:3000`

### 创建测试任务

当前公开站点已切换为**只读模式**：
- 网页端不再提供 AI / Agent 任务启动入口
- `POST /api/tasks` 也已禁用，避免公网直接下发执行任务

如需创建新任务，请通过内部 CLI、自动化工作流（如 n8n）或微信侧接入提交。

本地开发若要恢复创建能力，可在你自己的分支中重新启用 `TaskLauncher` 与 `createTask()` 路径。

---

## API 文档

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/tasks` | GET | 获取任务列表 |
| `/api/tasks` | POST | 已禁用（公开站点返回 403，只保留只读监控） |
| `/api/tasks/[taskId]` | GET | 获取单个任务快照 |
| `/api/tasks/[taskId]/stream` | GET | SSE 实时流 |
| `/api/tasks/[taskId]/approve` | POST | 批准命令/权限请求 |
| `/api/tasks/[taskId]/stop` | POST | 停止任务 |
| `/api/tasks/[taskId]/retry` | POST | 重试任务 |
| `/api/tasks/[taskId]/delete` | POST | 删除任务 |
| `/api/tasks/[taskId]/artifact/[artifactId]` | GET | 下载产物文件 |

---

## 架构说明

### 数据流

```
浏览器 ──HTTP/SSE──▶ Next.js 服务端 ──读写──▶ .task-pulse-data/*.json
                                                    │
                                              spawn ▼
                                        runner 脚本 (OpenCode / Hermes)
```

### 核心目录结构

```text
src/
├── app/
│   ├── api/tasks/             # API 路由（CRUD + SSE + 操作）
│   ├── tasks/                 # 页面路由（总览 + 详情）
│   ├── layout.tsx             # 全局布局
│   └── page.tsx               # 根路由
├── components/task-pulse/     # UI 组件
│   ├── dashboard.tsx          # 总览页
│   ├── dashboard-client.tsx   # 客户端交互（按钮）
│   ├── task-detail-client.tsx # 详情页
│   ├── task-filterable-section.tsx  # 任务列表（搜索/筛选/分组）
│   ├── task-launcher.tsx      # 任务创建面板
│   └── flow-pipeline.tsx      # 流程可视化
├── lib/task-pulse/
│   ├── store.ts               # 状态管理 + runner 编排
│   ├── types.ts               # 类型定义
│   ├── utils.ts               # 工具函数
│   ├── mock-data.ts           # Demo 数据
│   └── __tests__/             # 单元测试
scripts/
├── task-pulse-live-runner.js       # OpenCode runner 脚本
└── task-pulse-hermes-runner.js     # Hermes runner 脚本
.task-pulse-data/                   # 持久化任务快照
```

### 实时更新机制

- 任务快照以 JSON 文件持久化在 `.task-pulse-data/`
- 每次状态变更增加版本号（`version++`）
- SSE 端点每秒轮询版本号，变化时推送完整快照
- Runner 脚本通过写文件 → SSE 自动推送到浏览器

---

## 技术栈

- **Next.js 16** (App Router, React Server Components)
- **React 19** (Server Actions, Hooks)
- **Tailwind CSS 4** (暗色主题)
- **TypeScript**
- **SSE** (Server-Sent Events)
- **Lucide React** (图标)
- **Framer Motion** (动画)
- **React Markdown** (Markdown 渲染)

---

## LICENSE

MIT


