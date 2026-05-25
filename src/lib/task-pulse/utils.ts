import { AUTO_GROUP_MAP, ChatTraceRecord, TaskArtifact, TaskCategory, TaskSnapshot } from "./types";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.max(1, Math.floor(diff / 1000));
  if (sec < 60) return `${sec}秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分钟前`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}小时前`;
  return `${Math.floor(hrs / 24)}天前`;
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

export function phaseLabel(phase: string) {
  const map: Record<string, string> = {
    queued: "排队中",
    triaging: "评估中",
    accepted: "已接受",
    booting_runner: "正在启动执行器",
    coding: "正在改代码",
    testing: "正在跑测试",
    summarizing: "正在整理结果",
    waiting_review: "待审核",
    completed: "已完成",
    failed: "已失败",
  };
  return map[phase] ?? phase;
}

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    queued: "排队",
    running: "执行中",
    blocked: "卡住待处理",
    approval_required: "待命令同意",
    done: "已完成",
    failed: "失败",
    stopped: "已停止",
  };
  return map[status] ?? status;
}

export const categoryInfo: Record<TaskCategory, { label: string; color: string; icon: string }> = {
  chat:     { label: "聊天",    color: "border-violet-300/30 bg-violet-400/15 text-violet-200", icon: "💬" },
  ppt:      { label: "生成PPT", color: "border-orange-300/30 bg-orange-400/15 text-orange-200",  icon: "📊" },
  paper:    { label: "生成论文", color: "border-rose-300/30 bg-rose-400/15 text-rose-200",       icon: "📝" },
  coding:   { label: "写代码",  color: "border-cyan-300/30 bg-cyan-400/15 text-cyan-200",        icon: "💻" },
};

export function inferTitle(prompt: string, category: TaskCategory, runner: string): string {
  const trimmed = prompt.trim();
  const catLabel = categoryInfo[category]?.label ?? "任务";
  if (trimmed.length <= 3) {
    const runnerLabel = runner === "hermes" ? "Hermes" : runner === "opencode" ? "OpenCode" : runner;
    return `${runnerLabel} ${catLabel}任务`;
  }
  const zhPattern = /[\u4e00-\u9fff]/;
  if (zhPattern.test(trimmed)) {
    const firstZhSentence = trimmed.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]{4,50}/);
    if (firstZhSentence) return firstZhSentence[0].length > 30 ? firstZhSentence[0].slice(0, 30) + "…" : firstZhSentence[0];
  }
  const intentKeywords: Record<TaskCategory, string[]> = {
    chat: ["回复", "回答", "讨论", "咨询", "帮忙", "解释", "翻译", "总结"],
    ppt: ["演示", "幻灯片", "PPT", "展示", "演讲"],
    paper: ["论文", "文章", "报告", "文献", "综述", "调研"],
    coding: ["实现", "编写", "创建", "重构", "修复", "优化", "添加", "开发"],
  };
  const keywords = intentKeywords[category] ?? [];
  for (const kw of keywords) {
    if (trimmed.includes(kw)) {
      const prefix = trimmed.slice(0, trimmed.indexOf(kw) + kw.length);
      return prefix.length > 30 ? prefix.slice(0, 30) + "…" : prefix;
    }
  }
  const maxLen = 40;
  const short = trimmed.length > maxLen ? trimmed.slice(0, maxLen) + "…" : trimmed;
  const lines = short.split("\n").filter(Boolean);
  return lines[0] ?? short;
}

export function inferGroupId(category: TaskCategory, customName?: string, repoLink?: string): string {
  const name = customName || AUTO_GROUP_MAP[category] || category;
  const seed = ((name || "") + (repoLink ? `::${repoLink}` : ""))
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `group_${seed || category}`;
}

export function inferGroupName(category: TaskCategory, customName?: string): string {
  return customName ?? AUTO_GROUP_MAP[category] ?? "其他任务";
}

export function inferRepoLink(prompt: string): string | undefined {
  const repoMatch = prompt.match(/(?:https?:\/\/)?(?:www\.)?(?:github\.com|gitlab\.com|gitee\.com)\/[\w.-]+\/[\w.-]+/);
  return repoMatch ? repoMatch[0] : undefined;
}

export function extractChatTrace(snapshot: TaskSnapshot): ChatTraceRecord[] {
  const { task, events, logs } = snapshot;
  if (task.category !== "chat") return [];
  const trace: ChatTraceRecord[] = [];

  const userEvent = events.find((e) => e.type === "task.created");
  if (userEvent) {
    trace.push({
      step: "用户请求",
      type: "user_request",
      message: task.prompt,
      detail: userEvent.message,
      timestamp: userEvent.createdAt,
    });
  }

  const analysisEvents = events.filter((e) =>
    ["triage.completed", "human.review.required", "task.blocked"].includes(e.type)
  );
  for (const ae of analysisEvents) {
    trace.push({
      step: ae.type === "triage.completed" ? "意图分析" : ae.type === "human.review.required" ? "人工审核" : "阻塞检测",
      type: "analysis_decision",
      message: ae.message,
      detail: Object.keys(ae.payload).length > 0 ? JSON.stringify(ae.payload) : undefined,
      timestamp: ae.createdAt,
    });
  }

  const resultEvents = events.filter((e) =>
    ["task.completed", "files.changed", "tests.passed", "runner.started"].includes(e.type)
  );
  if (resultEvents.length > 0) {
    const re = resultEvents[resultEvents.length - 1];
    trace.push({
      step: re.type === "task.completed" ? "执行完成" : "执行结果",
      type: "execution_result",
      message: re.message,
      detail: task.summary.length > 4 ? task.summary : undefined,
      timestamp: re.createdAt,
    });
  }

  if (logs.length > 0) {
    const lastLog = logs[logs.length - 1];
    trace.push({
      step: "日志记录",
      type: "execution_result",
      message: lastLog.content,
      timestamp: lastLog.createdAt,
    });
  }

  return trace;
}

export function generateCodingReleaseNotes(snapshot: TaskSnapshot): string {
  const { task, events, logs, artifacts } = snapshot;
  if (task.category !== "coding") return "";
  const parts: string[] = [];

  parts.push(`## ${task.title}`);

  const changedEvents = events.filter((e) => e.type === "files.changed");
  if (changedEvents.length > 0) {
    const fileNames = changedEvents.flatMap((e) => {
      const files = e.payload?.files;
      return Array.isArray(files) ? files.map(String) : [];
    });
    if (fileNames.length > 0) {
      parts.push(`### 文件变更`);
      for (const f of fileNames) parts.push(`- \`${f}\``);
    }
  }

  const successMsgs = events
    .filter((e) => e.level === "success" && e.message.length > 4 && !["task.created", "runner.started"].includes(e.type))
    .map((e) => e.message.replace(/[。！？]$/, ""));
  if (successMsgs.length > 0) {
    parts.push(`### 变更内容`);
    for (const m of successMsgs.slice(0, 5)) parts.push(`- ${m}`);
  }

  if (task.summary && task.summary.length > 4) {
    parts.push(`### 总结`);
    parts.push(task.summary.replace(/[。！？]$/, "") + "。");
  }

  if (artifacts.length > 0) {
    parts.push(`### 产出物`);
    for (const a of artifacts) parts.push(`- **${a.name}** (${a.kind})`);
  }

  const toolEvents = events.filter((e) => e.type === "opencode.tool");
  if (toolEvents.length > 0) {
    const tools = Array.from(new Set(toolEvents.map((e) => String(e.payload?.tool ?? "")))).filter(Boolean);
    if (tools.length > 0) {
      parts.push(`### 使用工具`);
      parts.push(tools.map((t) => `- \`${t}\``).join("\n"));
    }
  }

  const lastLog = logs.filter((l) => l.stream === "system" && l.level === "success").pop();
  if (lastLog) {
    parts.push(`### 运行摘要`);
    parts.push(lastLog.content.replace(/[。！？]$/, "") + "。");
  }

  return parts.join("\n\n");
}

export function summarizeTaskActions(snapshot: TaskSnapshot): string {
  const { task, events, logs, artifacts, notifications } = snapshot;
  const parts: string[] = [];
  const successEvents = events.filter((e) => e.level === "success");
  const errorEvents = events.filter((e) => e.level === "error");
  const warnEvents = events.filter((e) => e.level === "warning");
  const changedEvents = events.filter((e) => e.type === "files.changed");

  if (task.status === "queued") {
    parts.push("任务已创建，正在排队等待执行。");
    return parts.join(" ");
  }

  if (changedEvents.length > 0) {
    const totalFiles = changedEvents.reduce((sum, e) => {
      const files = e.payload?.files;
      return sum + (Array.isArray(files) ? files.length : (typeof files === "number" ? files : 0));
    }, 0);
    parts.push(`修改了 ${totalFiles} 个文件`);
  }

  const filteredEvents = events.filter((e) => !["task.created", "runner.started", "task.blocked", "task.completed"].includes(e.type));
  const nonTrivialEvents = filteredEvents.slice(-3);
  if (nonTrivialEvents.length > 0) {
    for (const ev of nonTrivialEvents) {
      if (ev.message && ev.message.length > 2) {
        parts.push(ev.message.replace(/[。！？]$/, ""));
      }
    }
  }

  const latestLogs = logs.slice(-3);
  if (latestLogs.length > 0) {
    const logMsgs = latestLogs
      .map((l) => l.content.replace(/[。！？]$/, ""))
      .filter((m) => m.length > 4);
    if (logMsgs.length > 0) {
      parts.push("日志记录：" + logMsgs.join("；"));
    }
  }

  if (artifacts.length > 0) {
    const names = artifacts.map((a) => a.name).join("、");
    parts.push(`已产出「${names}」等 ${artifacts.length} 项产物`);
  }

  if (notifications.length > 0) {
    const sent = notifications.filter((n) => n.status === "sent").length;
    if (sent > 0) parts.push(`已发送 ${sent} 条通知`);
  }

  if (successEvents.length > 0) {
    parts.push(`${successEvents.length} 个步骤成功完成`);
  }

  if (errorEvents.length > 0) {
    parts.push(`遇到 ${errorEvents.length} 个错误`);
  }

  if (warnEvents.length > 0) {
    parts.push(`有 ${warnEvents.length} 个警告`);
  }

  return parts.length > 0 ? parts.join("，") + "。" : "暂无详细记录。";
}

// ───────── Artifact helpers ─────────

export function isAbsoluteHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export function isAppRoute(value: string) {
  return value.startsWith("/");
}

export function artifactActionLabel(artifact: TaskArtifact) {
  const url = artifact.url;
  const path = artifact.path;

  if (url && isAbsoluteHttpUrl(url)) return "打开";
  if (url && isAppRoute(url)) return "查看";
  if (path && isAppRoute(path)) return "查看";
  if (path && !isAppRoute(path)) return "下载";

  if (artifact.kind === "link") return "打开";
  if (artifact.kind === "report") return "查看";
  if (artifact.kind === "json") return "查看";

  return "查看";
}

export function artifactActionHref(artifact: TaskArtifact): string | null {
  const url = artifact.url;
  const path = artifact.path;

  if (url && (isAbsoluteHttpUrl(url) || isAppRoute(url))) return url;
  if (path && isAppRoute(path)) return path;

  return null;
}

export function artifactActionExternal(artifact: TaskArtifact) {
  return Boolean(artifact.url && isAbsoluteHttpUrl(artifact.url));
}

export function artifactDisplayPath(artifact: TaskArtifact): string {
  const url = artifact.url;
  const path = artifact.path;

  if (url) return url;
  if (path) return path;
  return "内联";
}

export function artifactFileDownloadUrl(artifact: TaskArtifact): string | null {
  const path = artifact.path;
  if (!path) return null;
  if (isAppRoute(path) || isAbsoluteHttpUrl(path)) return null;
  return `/api/tasks/${artifact.taskId}/artifact/${encodeURIComponent(artifact.id)}`;
}

// ───────── Notification / Quick-link helpers ─────────

export type QuickLink = {
  label: string;
  href: string;
  external?: boolean;
};

export function getTaskQuickLinks(snapshot: TaskSnapshot): QuickLink[] {
  const links: QuickLink[] = [];

  links.push({ label: "详情页", href: `/tasks/${snapshot.task.id}` });
  links.push({ label: "API 快照", href: `/api/tasks/${snapshot.task.id}` });

  const latestArtifacts = snapshot.artifacts.slice(0, 3);
  for (const a of latestArtifacts) {
    const href = artifactActionHref(a);
    if (href) {
      links.push({
        label: `产物: ${a.name}`,
        href,
        external: artifactActionExternal(a),
      });
    }
  }

  const notificationUrls = new Set<string>();
  for (const n of snapshot.notifications) {
    const taskUrl = n.payload?.taskUrl;
    if (typeof taskUrl === "string" && !notificationUrls.has(taskUrl)) {
      notificationUrls.add(taskUrl);
      links.push({ label: `通知: ${n.eventType}`, href: taskUrl });
    }
  }

  return links;
}

export type FlowStep = { key: string; label: string; icon: string };
export type TaskFlow = { name: string; steps: FlowStep[] };

export const taskFlows: Record<TaskCategory, TaskFlow> = {
  chat: {
    name: "聊天处理流程",
    steps: [
      { key: "receive", label: "接收消息", icon: "📥" },
      { key: "analyze", label: "意图分析", icon: "🧠" },
      { key: "generate", label: "生成回复", icon: "✨" },
      { key: "deliver", label: "发送回复", icon: "📤" },
    ],
  },
  ppt: {
    name: "PPT 生成流程",
    steps: [
      { key: "understand", label: "理解需求", icon: "🎯" },
      { key: "structure", label: "结构设计", icon: "🏗️" },
      { key: "content", label: "内容生成", icon: "📝" },
      { key: "layout", label: "排版输出", icon: "🎨" },
    ],
  },
  paper: {
    name: "论文生成流程",
    steps: [
      { key: "research", label: "选题调研", icon: "🔍" },
      { key: "outline", label: "大纲规划", icon: "📋" },
      { key: "writing", label: "内容撰写", icon: "✍️" },
      { key: "review", label: "审校排版", icon: "✅" },
    ],
  },
  coding: {
    name: "代码生成流程",
    steps: [
      { key: "analyze", label: "需求分析", icon: "📖" },
      { key: "design", label: "架构设计", icon: "🏛️" },
      { key: "implement", label: "编码实现", icon: "⌨️" },
      { key: "test", label: "测试验证", icon: "🧪" },
    ],
  },
};
