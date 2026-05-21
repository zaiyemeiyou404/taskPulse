# Task Pulse

Task Pulse 是一个面向 AI Agent / coding runner 的实时任务看板，基于 Next.js App Router 构建。

它的目标不是单纯“提交任务”，而是把任务执行过程拆成可观察的事件流、日志流、状态时间线和产物面板，方便在浏览器里盯执行过程，尤其适合接 OpenCode / Hermes 这类执行器。

## 现在能做什么

- 实时查看任务列表与状态变化
- 查看单个任务详情页
- 通过 SSE 持续推送任务快照
- 展示阶段时间线、事件流、日志、通知、产物
- 为 coding 任务自动生成类似 GitHub Release Notes 的“功能更新”摘要
- 支持删除、停止、重试任务
- 支持自动从 prompt 推导更容易辨认的标题
- 支持 demo / live 两种任务模式

## 页面说明

### `/`
- 自动跳转到 `/tasks`

### `/tasks`
- 任务总览页
- 包含任务列表、启动入口、删除入口
- 当前通过客户端定时 `router.refresh()` 保持列表刷新

### `/tasks/[taskId]`
- 单任务详情页
- 展示：
  - 顶部状态卡
  - 任务摘要
  - 功能更新（Markdown 渲染）
  - 执行摘要
  - 阶段时间线
  - 实时事件流
  - 实时日志
  - 产物 / 文件 / 通知 / 原始 JSON

## API 说明

### `GET /api/tasks`
返回任务列表。

### `POST /api/tasks`
创建任务。

示例：

```bash
curl -X POST http://127.0.0.1:3000/api/tasks \
  -H 'Content-Type: application/json' \
  --data '{
    "prompt": "验证 Task Pulse 的详情页、事件流和日志面板",
    "category": "coding",
    "runner": "opencode",
    "model": "deepseek/deepseek-chat",
    "source": "weixin",
    "mode": "demo"
  }'
```

请求体字段：

- `title`: 可选，任务标题
- `prompt`: 可选，任务描述
- `category`: `chat | ppt | paper | coding`
- `runner`: 例如 `opencode` / `hermes`
- `model`: 模型名
- `source`: 任务来源
- `mode`: `demo | live`
- `cwd`: 执行工作目录

### `GET /api/tasks/[taskId]`
返回单个任务的完整快照。

### `GET /api/tasks/[taskId]/stream`
任务详情页使用的 SSE 流。

### `POST /api/tasks/[taskId]/stop`
停止任务。

### `POST /api/tasks/[taskId]/retry`
重试任务。

### `POST /api/tasks/[taskId]/delete`
删除任务。

## 启动方式

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式

```bash
npm run dev
```

### 3. 生产模式

```bash
npm run build
npm run start
```

默认地址：

- 本地：`http://127.0.0.1:3000`
- 浏览器访问：`http://localhost:3000`

## 如何创建测试任务

### 方式一：页面里直接创建

打开 `/tasks`，填写标题 / prompt，选择 runner 和 category，直接启动。

### 方式二：用 API 创建 demo 任务

```bash
curl -X POST http://127.0.0.1:3000/api/tasks \
  -H 'Content-Type: application/json' \
  --data '{
    "prompt": "在任务详情页验证 release notes 摘要、删除任务按钮和更好的自动标题",
    "category": "coding",
    "runner": "opencode",
    "model": "deepseek/deepseek-chat",
    "source": "manual",
    "mode": "demo"
  }'
```

返回 JSON 里的 `task.id` 可以直接拼成详情页地址：

```text
/tasks/<taskId>
```

例如：

```text
/tasks/task_1779333359923_1
```

## 目录结构

```text
src/
  app/
    page.tsx                       # 根路由，跳转到 /tasks
    layout.tsx                     # 全局布局
    tasks/
      page.tsx                     # 任务总览页
      [taskId]/page.tsx            # 任务详情页
    api/tasks/
      route.ts                     # 任务列表 / 创建任务
      [taskId]/route.ts            # 单任务快照
      [taskId]/stream/route.ts     # SSE 推送
      [taskId]/stop/route.ts       # 停止任务
      [taskId]/retry/route.ts      # 重试任务
      [taskId]/delete/route.ts     # 删除任务
  components/task-pulse/
    dashboard.tsx                  # 总览页主体
    dashboard-client.tsx           # 总览页轮询刷新 / 删除按钮
    task-launcher.tsx              # 任务创建表单
    task-detail-client.tsx         # 详情页客户端 UI
    flow-pipeline.tsx              # 流程可视化
  lib/task-pulse/
    store.ts                       # 内存态 + 持久化快照 + runner 编排
    mock-data.ts                   # 初始化 demo 数据
    types.ts                       # 类型定义
    utils.ts                       # 标题推导、摘要生成等工具函数
scripts/
  task-pulse-live-runner.js        # live runner 脚本
  task-pulse-hermes-runner.js      # Hermes runner 脚本
.task-pulse-data/                  # 持久化任务快照 / 日志
```

## 数据与运行机制

- 任务快照保存在 `.task-pulse-data/`
- 详情页优先读取快照文件，再回退到内存态
- SSE 基于任务快照版本变化推送更新
- demo 任务使用本地模拟脚本推进状态
- live 任务可以由外部 runner 持续写回快照

## Markdown 渲染说明

`coding` 类型任务的“功能更新”区域现在会对 Markdown 做真正渲染，而不是把 `##`、`-`、`` `code` `` 当普通文本显示。

当前已处理的常见元素：

- 标题
- 段落
- 无序 / 有序列表
- 行内代码
- 代码块
- 加粗

## 已知限制

- 当前任务列表刷新依赖前端轮询，不是纯 SSE
- 任务存储仍然是本地文件快照，不是数据库
- 删除任务目前是本地文件级删除 / 重命名，不是软删除系统
- demo 任务的执行内容是模拟出来的，不代表真实 runner 输出
- live runner 与外部平台（如微信 / n8n / 本地电脑）之间的完整生产级编排还没完全收口
- `npm install` 后可能会看到依赖审计告警，需要后续单独评估

## 推荐测试顺序

1. 启动服务
2. 打开 `/tasks`
3. 创建一个 `coding + demo` 任务
4. 打开任务详情页确认不再 404
5. 检查“功能更新”是否按 Markdown 显示标题 / 列表 / 代码
6. 测试停止 / 重试 / 删除按钮
7. 观察任务列表是否自动刷新

## 后续可以继续补的方向

- 用数据库替代文件快照
- 让任务总览页也切到 SSE / websocket
- 接入真正的 OpenCode / Hermes / Codex 执行反馈
- 增加任务筛选、搜索、归档
- 补认证、权限和审计日志
