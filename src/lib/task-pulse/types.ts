export type TaskStatus = "queued" | "running" | "blocked" | "approval_required" | "done" | "failed" | "stopped";
export const APPROVAL_KEYWORDS = [
  "command required approval",
  "permission requested:",
  "approval requested",
];

export type TaskCategory = "chat" | "ppt" | "paper" | "coding" | "skill" | "novel" | "web" | "design";

export type ChatTraceRecord = {
  step: string;
  type: "user_request" | "analysis_decision" | "execution_result";
  message: string;
  detail?: string;
  timestamp?: string;
};

export type TaskGroupMeta = {
  groupId: string;
  groupName: string;
  repoLink?: string;
  summary?: string;
  childCount?: number;
};

export const AUTO_GROUP_MAP: Record<TaskCategory, string> = {
  chat: "日常聊天",
  ppt: "PPT 生成",
  paper: "论文产出",
  coding: "代码开发",
  skill: "技能提炼",
  novel: "小说创作",
  web: "网站创作",
  design: "设计任务",
};

export type TaskPhase =
  | "queued"
  | "triaging"
  | "accepted"
  | "booting_runner"
  | "coding"
  | "testing"
  | "summarizing"
  | "waiting_review"
  | "completed"
  | "failed";

export type EventLevel = "info" | "success" | "warning" | "error";

export type Task = {
  id: string;
  title: string;
  prompt: string;
  status: TaskStatus;
  phase: TaskPhase;
  category: TaskCategory;
  runner: string;
  model: string;
  source: string;
  summary: string;
  progressText: string;
  needsHuman: boolean;
  startedAt: string;
  updatedAt: string;
  endedAt: string | null;
  durationMs: number;
  eventCount: number;
  logCount: number;
  notificationCount: number;
  progressPercent: number;
  metadata: Record<string, unknown>;
  groupId?: string;
  repoLink?: string;
  chatTrace?: ChatTraceRecord[];
};

export type TaskEvent = {
  id: string;
  taskId: string;
  type: string;
  level: EventLevel;
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type TaskLog = {
  id: string;
  taskId: string;
  stream: "stdout" | "stderr" | "system";
  level: EventLevel;
  content: string;
  createdAt: string;
};

export type TaskArtifact = {
  id: string;
  taskId: string;
  name: string;
  kind: "report" | "patch" | "bundle" | "link" | "json";
  path?: string;
  url?: string;
  sizeBytes?: number;
  createdAt: string;
};

export type NotificationPayload = {
  taskUrl?: string;
  mode?: string;
};

export type TaskNotification = {
  id: string;
  taskId: string;
  channel: string;
  eventType: string;
  target: string;
  status: "queued" | "sent" | "failed";
  payload: NotificationPayload;
  createdAt: string;
};

export type TaskSnapshot = {
  task: Task;
  events: TaskEvent[];
  logs: TaskLog[];
  artifacts: TaskArtifact[];
  notifications: TaskNotification[];
  version: number;
};

export type TaskGroup = {
  id: string;
  name: string;
  category: TaskCategory;
  repoLink?: string;
  summary: string;
  childTaskIds: string[];
  createdAt: string;
  updatedAt: string;
};
