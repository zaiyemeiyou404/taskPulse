import { AUTO_GROUP_MAP, TaskArtifact, TaskCategory, TaskEvent, TaskLog, TaskNotification, TaskSnapshot } from "./types";

const now = Date.now();

function mockGroupId(category: TaskCategory, repoLink?: string): string {
  const name = AUTO_GROUP_MAP[category];
  const seed = ((name || category) + (repoLink ? `::${repoLink}` : ""))
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `group_${seed || category}`;
}

export const INITIAL_TASKS: TaskSnapshot[] = [
  {
    task: {
      id: "task_demo_live",
      title: "实时监控面板与 SSE 事件流",
      prompt: "构建一个带有 SSE 实时事件流和日志面板的暗色主题任务监控仪表盘。",
      status: "running",
      phase: "coding",
      category: "coding",
      runner: "opencode",
      model: "deepseek/deepseek-chat",
      source: "微信",
      summary: "正在生成详情页视觉层与实时事件流。",
      progressText: "正在构建 /tasks/[taskId] 暗色 UI 界面",
      needsHuman: false,
      startedAt: new Date(now - 1000 * 60 * 11).toISOString(),
      updatedAt: new Date(now - 1000 * 18).toISOString(),
      endedAt: null,
      durationMs: 1000 * 60 * 11,
      eventCount: 5,
      logCount: 6,
      notificationCount: 1,
      progressPercent: 46,
      metadata: { branch: "task-pulse/live-demo", host: "hermes-server", groupName: "Task Pulse 完善", repoLink: "https://github.com/zaiyemeiyou404/task-pulse" },
      groupId: "group_task-pluse-完善-https-github-com-zaiyemeiyou404-ta",
      repoLink: "https://github.com/zaiyemeiyou404/task-pulse",
    },
    events: [
      evt("task_demo_live", "task.created", "info", "任务已从微信请求创建", { source: "微信" }, now - 1000 * 60 * 11),
      evt("task_demo_live", "triage.completed", "success", "评估完成，已接受由服务端执行", { runner: "opencode" }, now - 1000 * 60 * 10),
      evt("task_demo_live", "runner.started", "info", "OpenCode 进程已启动，使用 DeepSeek 模型", { model: "deepseek/deepseek-chat" }, now - 1000 * 60 * 9),
      evt("task_demo_live", "opencode.phase.changed", "info", "Agent 进入编码阶段", { phase: "coding" }, now - 1000 * 60 * 5),
      evt("task_demo_live", "files.changed", "success", "已创建仪表盘框架、时间线和事件流组件", { files: 4 }, now - 1000 * 18),
    ],
    logs: [
      log("task_demo_live", "system", "info", "Hermes 已接受任务。" , now - 1000 * 60 * 10),
      log("task_demo_live", "stdout", "info", "正在搭建 /tasks 和 /tasks/[taskId] 路由段", now - 1000 * 60 * 8),
      log("task_demo_live", "stdout", "info", "设计暗色面板样式与排版令牌", now - 1000 * 60 * 6),
      log("task_demo_live", "stdout", "success", "事件流卡片布局已完成", now - 1000 * 60 * 3),
      log("task_demo_live", "stdout", "info", "正在将 SSE 客户端接入详情页", now - 1000 * 40),
      log("task_demo_live", "stdout", "info", "准备进入测试阶段", now - 1000 * 18),
    ],
    artifacts: [
      artifact("task_demo_live", "Live UI 规格说明", "report", now - 1000 * 60 * 4, "/api/tasks/task_demo_live"),
    ],
    notifications: [
      notification("task_demo_live", "task.started", "sent", now - 1000 * 60 * 9),
    ],
    version: 1,
  },
  {
    task: {
      id: "task_blocked_approval",
      title: "接入真实微信通知器",
      prompt: "集成生产级微信消息发送器，含重试策略和送达回执。",
      status: "blocked",
      phase: "waiting_review",
      category: "chat",
      runner: "hermes",
      model: "deepseek/deepseek-chat",
      source: "n8n",
      summary: "等待人工确认回调目标与凭据。",
      progressText: "等待 webhook 密钥确认",
      needsHuman: true,
      startedAt: new Date(now - 1000 * 60 * 38).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 2).toISOString(),
      endedAt: null,
      durationMs: 1000 * 60 * 38,
      eventCount: 4,
      logCount: 3,
      notificationCount: 2,
      progressPercent: 74,
      metadata: { owner: "Hermes", environment: "prod", groupName: AUTO_GROUP_MAP.chat },
      groupId: mockGroupId("chat"),
      chatTrace: [
        { step: "用户请求", type: "user_request", message: "集成生产级微信消息发送器，含重试策略和送达回执。", detail: "任务已从 n8n webhook 创建", timestamp: new Date(now - 1000 * 60 * 38).toISOString() },
        { step: "意图分析", type: "analysis_decision", message: "Hermes 工作流已启动，准备处理微信通知器集成", detail: '{"runner":"hermes","confidence":0.85}', timestamp: new Date(now - 1000 * 60 * 37).toISOString() },
        { step: "人工审核", type: "analysis_decision", message: "需要人工确认回调目标", detail: '{"target":"微信","reason":"缺少生产环境回调目标"}', timestamp: new Date(now - 1000 * 60 * 4).toISOString() },
        { step: "阻塞检测", type: "analysis_decision", message: "等待审核超时，任务已标记为阻塞", timestamp: new Date(now - 1000 * 60 * 2).toISOString() },
        { step: "执行结果", type: "execution_result", message: "等待人工确认回调目标与凭据。", detail: "任务暂停，需要操作员介入", timestamp: new Date(now - 1000 * 60 * 1).toISOString() },
      ],
    },
    events: [
      evt("task_blocked_approval", "task.created", "info", "任务已从 n8n webhook 创建", {}, now - 1000 * 60 * 38),
      evt("task_blocked_approval", "runner.started", "info", "Hermes 工作流已启动", {}, now - 1000 * 60 * 37),
      evt("task_blocked_approval", "human.review.required", "warning", "需要人工确认回调目标", { target: "微信" }, now - 1000 * 60 * 4),
      evt("task_blocked_approval", "task.blocked", "warning", "等待审核超时，任务已标记为阻塞", {}, now - 1000 * 60 * 2),
    ],
    logs: [
      log("task_blocked_approval", "stdout", "info", "正在读取当前 webhook 订阅配置", now - 1000 * 60 * 30),
      log("task_blocked_approval", "stdout", "warning", "缺少生产环境回调目标", now - 1000 * 60 * 4),
      log("task_blocked_approval", "system", "warning", "已暂停等待人工审核", now - 1000 * 60 * 2),
    ],
    artifacts: [],
    notifications: [
      notification("task_blocked_approval", "task.started", "sent", now - 1000 * 60 * 37),
      notification("task_blocked_approval", "task.blocked", "sent", now - 1000 * 60 * 2),
    ],
    version: 1,
  },
  {
    task: {
      id: "task_done_metrics",
      title: "任务执行指标总览卡片",
      prompt: "在 /tasks 总览页添加 KPI 摘要卡片和动画计数器。",
      status: "done",
      phase: "completed",
      category: "coding",
      runner: "opencode",
      model: "deepseek/deepseek-chat",
      source: "手动",
      summary: "指标卡片已完成，动画与响应式布局已交付。",
      progressText: "已成功完成",
      needsHuman: false,
      startedAt: new Date(now - 1000 * 60 * 93).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 67).toISOString(),
      endedAt: new Date(now - 1000 * 60 * 67).toISOString(),
      durationMs: 1000 * 60 * 26,
      eventCount: 5,
      logCount: 4,
      notificationCount: 2,
      progressPercent: 100,
      metadata: { commit: "feat/kpi-cards", groupName: "Task Pulse 完善", repoLink: "https://github.com/zaiyemeiyou404/task-pulse" },
      groupId: "group_task-pluse-完善-https-github-com-zaiyemeiyou404-ta",
      repoLink: "https://github.com/zaiyemeiyou404/task-pulse",
    },
    events: [
      evt("task_done_metrics", "task.created", "info", "手动创建任务", {}, now - 1000 * 60 * 93),
      evt("task_done_metrics", "runner.started", "info", "OpenCode 已启动", {}, now - 1000 * 60 * 92),
      evt("task_done_metrics", "files.changed", "success", "已更新总览布局和统计卡片", { files: 3 }, now - 1000 * 60 * 75),
      evt("task_done_metrics", "tests.passed", "success", "Lint 和 UI 冒烟测试通过", { checks: 2 }, now - 1000 * 60 * 68),
      evt("task_done_metrics", "task.completed", "success", "任务已完成", {}, now - 1000 * 60 * 67),
    ],
    logs: [
      log("task_done_metrics", "stdout", "info", "正在生成 KPI 卡片组件", now - 1000 * 60 * 90),
      log("task_done_metrics", "stdout", "success", "卡片已接入动画计数器", now - 1000 * 60 * 74),
      log("task_done_metrics", "stdout", "info", "运行 lint 检查", now - 1000 * 60 * 69),
      log("task_done_metrics", "stdout", "success", "所有检查已通过", now - 1000 * 60 * 68),
    ],
    artifacts: [artifact("task_done_metrics", "界面截图", "link", now - 1000 * 60 * 67, undefined, "https://example.com/capture")],
    notifications: [
      notification("task_done_metrics", "task.started", "sent", now - 1000 * 60 * 92),
      notification("task_done_metrics", "task.completed", "sent", now - 1000 * 60 * 67),
    ],
    version: 1,
  },
  {
    task: {
      id: "task_approval_cmd",
      title: "审批测试：Git push 到远程仓库",
      prompt: "帮我将本地代码 push 到远程仓库。",
      status: "approval_required",
      phase: "waiting_review",
      category: "coding",
      runner: "opencode",
      model: "deepseek/deepseek-chat",
      source: "手动",
      summary: "等待人工同意 git push 命令",
      progressText: "等待命令同意/权限批准",
      needsHuman: true,
      startedAt: new Date(now - 1000 * 60 * 5).toISOString(),
      updatedAt: new Date(now - 1000 * 30).toISOString(),
      endedAt: null,
      durationMs: 1000 * 60 * 5,
      eventCount: 4,
      logCount: 3,
      notificationCount: 2,
      progressPercent: 62,
      metadata: { groupName: "Agent 仓库完善", repoLink: "https://github.com/zaiyemeiyou404/agent" },
      groupId: "group_agent-仓库完善-https-github-com-zaiyemeiyou404-agent",
      repoLink: "https://github.com/zaiyemeiyou404/agent",
    },
    events: [
      evt("task_approval_cmd", "task.created", "info", "手动创建任务", {}, now - 1000 * 60 * 5),
      evt("task_approval_cmd", "runner.started", "info", "OpenCode 已启动", {}, now - 1000 * 60 * 4),
      evt("task_approval_cmd", "opencode.phase.changed", "info", "Agent 进入编码阶段", { phase: "coding" }, now - 1000 * 60 * 2),
      evt("task_approval_cmd", "human.approval.required", "warning", "需要人工审批：命令/权限请求", { text: "Command required approval: git push origin main" }, now - 1000 * 30),
    ],
    logs: [
      log("task_approval_cmd", "stdout", "info", "正在分析仓库状态", now - 1000 * 60 * 4),
      log("task_approval_cmd", "stdout", "info", "git add 已完成，准备提交", now - 1000 * 60 * 2),
      log("task_approval_cmd", "stdout", "warning", "Command required approval: git push origin main", now - 1000 * 30),
    ],
    artifacts: [],
    notifications: [
      notification("task_approval_cmd", "task.started", "sent", now - 1000 * 60 * 4),
      notification("task_approval_cmd", "human.approval.required", "sent", now - 1000 * 30),
    ],
    version: 1,
  },
];

function evt(taskId: string, type: string, level: TaskEvent["level"], message: string, payload: Record<string, unknown>, ts: number): TaskEvent {
  return {
    id: `${taskId}_${type}_${ts}`,
    taskId,
    type,
    level,
    message,
    payload,
    createdAt: new Date(ts).toISOString(),
  };
}

function log(taskId: string, stream: TaskLog["stream"], level: TaskLog["level"], content: string, ts: number): TaskLog {
  return {
    id: `${taskId}_${stream}_${ts}`,
    taskId,
    stream,
    level,
    content,
    createdAt: new Date(ts).toISOString(),
  };
}

function artifact(taskId: string, name: string, kind: TaskArtifact["kind"], ts: number, path?: string, url?: string): TaskArtifact {
  return {
    id: `${taskId}_${name}_${ts}`,
    taskId,
    name,
    kind,
    path,
    url,
    createdAt: new Date(ts).toISOString(),
  };
}

function notification(taskId: string, eventType: string, status: TaskNotification["status"], ts: number): TaskNotification {
  return {
    id: `${taskId}_${eventType}_${ts}`,
    taskId,
    eventType,
    channel: "微信",
    target: "weixin:o9cq8070Ill3Nq2HQBoDp8qBgPts@im.wechat",
    status,
    payload: { taskUrl: `/tasks/${taskId}`, mode: "proactive" },
    createdAt: new Date(ts).toISOString(),
  };
}
