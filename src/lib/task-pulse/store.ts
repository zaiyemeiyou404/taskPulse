import { spawn, type ChildProcessByStdio } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { type Readable } from "node:stream";
import { INITIAL_TASKS } from "./mock-data";
import { TaskArtifact, TaskCategory, TaskEvent, TaskLog, TaskNotification, TaskPhase, TaskSnapshot, TaskStatus } from "./types";
import { inferTitle } from "./utils";

const TASKS = new Map<string, TaskSnapshot>();
const versions = new Map<string, number>();
const ACTIVE_RUNNERS = new Map<string, RunnerHandle>();
const SIMULATION_TIMERS = new Map<string, NodeJS.Timeout[]>();
let booted = false;
let counter = 0;

const OPENCODE_BIN = process.env.OPENCODE_BIN || "/home/ubuntu/.hermes/node/bin/opencode";
const DEFAULT_MODEL = "deepseek/deepseek-chat";
const DEFAULT_CWD = "/home/ubuntu/task-pulse";
const DATA_DIR = path.join(DEFAULT_CWD, ".task-pulse-data");
const LIVE_RUNNER_SCRIPT = path.join(DEFAULT_CWD, "scripts/task-pulse-live-runner.js");
const HERMES_RUNNER_SCRIPT = path.join(DEFAULT_CWD, "scripts/task-pulse-hermes-runner.js");
const BLOCKED_MS = 2 * 60 * 1000;

type RunnerMode = "demo" | "live";

type DemoStep = {
  delayMs: number;
  phase: TaskPhase;
  status: TaskStatus;
  progress: number;
  event: [string, TaskEvent["level"], string];
  log: [TaskLog["stream"], TaskLog["level"], string];
  notification?: [string, TaskNotification["status"]];
  artifact?: [string, TaskArtifact["kind"]];
};

type OpenCodeChild = ChildProcessByStdio<null, Readable, Readable>;

type RunnerHandle = {
  process: OpenCodeChild;
  startedAt: number;
  lastOutputAt: number;
  watchdog: NodeJS.Timeout;
  blockedNotified: boolean;
};

type CreateTaskInput = {
  title: string;
  prompt: string;
  category?: TaskCategory;
  runner?: string;
  model?: string;
  source?: string;
  mode?: RunnerMode;
  cwd?: string;
};

type OpenCodeJsonEvent = {
  type?: string;
  sessionID?: string;
  timestamp?: number;
  part?: {
    type?: string;
    text?: string;
    tool?: string;
    callID?: string;
    state?: {
      status?: string;
      input?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    };
    cost?: number;
    tokens?: {
      total?: number;
      input?: number;
      output?: number;
      reasoning?: number;
      cache?: { write?: number; read?: number };
    };
    reason?: string;
    snapshot?: string;
  };
};

const demoScript: DemoStep[] = [
  {
    delayMs: 4000,
    phase: "coding",
    status: "running",
    progress: 54,
    event: ["files.changed", "success", "Refined dashboard shell, KPI strip, and task hero"],
    log: ["stdout", "success", "Premium shell and overview cards updated"],
  },
  {
    delayMs: 8000,
    phase: "testing",
    status: "running",
    progress: 78,
    event: ["tests.started", "info", "UI validation and lint checks started"],
    log: ["stdout", "info", "Running lint and smoke route checks"],
  },
  {
    delayMs: 12000,
    phase: "summarizing",
    status: "running",
    progress: 91,
    event: ["tests.passed", "success", "Lint and route checks passed"],
    log: ["stdout", "success", "Checks passed. Preparing summary and artifacts"],
  },
  {
    delayMs: 16000,
    phase: "completed",
    status: "done",
    progress: 100,
    event: ["task.completed", "success", "Task completed with live SSE demo and polished visuals"],
    log: ["system", "success", "Task finished successfully"],
    notification: ["task.completed", "sent"],
    artifact: ["task-pulse-demo.json", "json"],
  },
];

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nextId(prefix: string) {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}`;
}


function ensureDataDir() {
  mkdirSync(DATA_DIR, { recursive: true });
}

function getTaskFile(taskId: string) {
  return path.join(DATA_DIR, `${taskId}.json`);
}

function shouldPersistSnapshot(snapshot: TaskSnapshot | null | undefined) {
  return Boolean(snapshot?.task.id);
}

function writeSnapshotFile(snapshot: TaskSnapshot) {
  ensureDataDir();
  const file = getTaskFile(snapshot.task.id);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(snapshot, null, 2));
  renameSync(tmp, file);
}

function readSnapshotFile(taskId: string) {
  const file = getTaskFile(taskId);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as TaskSnapshot;
}

function listLiveSnapshots() {
  ensureDataDir();
  return readdirSync(DATA_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      try {
        return JSON.parse(readFileSync(path.join(DATA_DIR, name), 'utf8')) as TaskSnapshot;
      } catch {
        return null;
      }
    })
    .filter((value): value is TaskSnapshot => Boolean(value));
}

function getMode(taskId: string): RunnerMode {
  const snapshot = TASKS.get(taskId);
  const mode = snapshot?.task.metadata.mode;
  return mode === "live" ? "live" : "demo";
}

function mark(taskId: string) {
  const snapshot = TASKS.get(taskId);
  if (!snapshot) return;
  snapshot.task.updatedAt = new Date().toISOString();
  if (snapshot.task.startedAt) {
    snapshot.task.durationMs = Date.now() - new Date(snapshot.task.startedAt).getTime();
  }
  snapshot.task.eventCount = snapshot.events.length;
  snapshot.task.logCount = snapshot.logs.length;
  snapshot.task.notificationCount = snapshot.notifications.length;
  const current = (versions.get(taskId) ?? 0) + 1;
  versions.set(taskId, current);
  snapshot.version = current;
  if (shouldPersistSnapshot(snapshot)) writeSnapshotFile(snapshot);
}

function addEvent(taskId: string, type: string, level: TaskEvent["level"], message: string, payload: Record<string, unknown> = {}) {
  const snapshot = TASKS.get(taskId);
  if (!snapshot) return;
  snapshot.events.unshift({
    id: nextId("evt"),
    taskId,
    type,
    level,
    message,
    payload,
    createdAt: new Date().toISOString(),
  });
  mark(taskId);
}

function addLog(taskId: string, stream: TaskLog["stream"], level: TaskLog["level"], content: string) {
  const snapshot = TASKS.get(taskId);
  if (!snapshot) return;
  snapshot.logs.push({
    id: nextId("log"),
    taskId,
    stream,
    level,
    content,
    createdAt: new Date().toISOString(),
  });
  if (stream !== "system") {
    const runner = ACTIVE_RUNNERS.get(taskId);
    if (runner) runner.lastOutputAt = Date.now();
  }
  mark(taskId);
}

function addNotification(taskId: string, eventType: string, status: TaskNotification["status"]) {
  const snapshot = TASKS.get(taskId);
  if (!snapshot) return;
  snapshot.notifications.unshift({
    id: nextId("ntf"),
    taskId,
    channel: "weixin",
    eventType,
    target: "weixin:o9cq8070Ill3Nq2HQBoDp8qBgPts@im.wechat",
    status,
    payload: { taskUrl: `/tasks/${taskId}` },
    createdAt: new Date().toISOString(),
  });
  mark(taskId);
}

function addArtifact(taskId: string, name: string, kind: TaskArtifact["kind"], path?: string) {
  const snapshot = TASKS.get(taskId);
  if (!snapshot) return;
  snapshot.artifacts.unshift({
    id: nextId("artifact"),
    taskId,
    name,
    kind,
    path: path ?? `/api/tasks/${taskId}`,
    createdAt: new Date().toISOString(),
  });
  mark(taskId);
}

function setStatus(taskId: string, status: TaskStatus, phase: TaskPhase, progressPercent: number, progressText: string, summary?: string) {
  const snapshot = TASKS.get(taskId);
  if (!snapshot) return;
  snapshot.task.status = status;
  snapshot.task.phase = phase;
  snapshot.task.progressPercent = progressPercent;
  snapshot.task.progressText = progressText;
  if (summary) snapshot.task.summary = summary;
  if (["done", "failed", "stopped"].includes(status)) {
    snapshot.task.endedAt = new Date().toISOString();
  }
  mark(taskId);
}

function clearSimulation(taskId: string) {
  const timers = SIMULATION_TIMERS.get(taskId);
  if (timers) {
    timers.forEach((timer) => clearTimeout(timer));
    SIMULATION_TIMERS.delete(taskId);
  }
}

function startSimulation(taskId: string) {
  clearSimulation(taskId);
  const timers = demoScript.map((step) => setTimeout(() => {
    const snapshot = TASKS.get(taskId);
    if (!snapshot || snapshot.task.status === "stopped") return;
    setStatus(taskId, step.status, step.phase, step.progress, step.event[2], step.event[2]);
    addEvent(taskId, step.event[0], step.event[1], step.event[2], { phase: step.phase, progress: step.progress });
    addLog(taskId, step.log[0], step.log[1], step.log[2]);
    if (step.notification) addNotification(taskId, step.notification[0], step.notification[1]);
    if (step.artifact) addArtifact(taskId, step.artifact[0], step.artifact[1]);
  }, step.delayMs));
  SIMULATION_TIMERS.set(taskId, timers);
}

function setMetadata(taskId: string, patch: Record<string, unknown>) {
  const snapshot = TASKS.get(taskId);
  if (!snapshot) return;
  snapshot.task.metadata = { ...snapshot.task.metadata, ...patch };
  mark(taskId);
}

function ensureTask(taskId: string) {
  const snapshot = TASKS.get(taskId);
  if (!snapshot) throw new Error(`Unknown task: ${taskId}`);
  return snapshot;
}

function scheduleBlockedWatch(taskId: string, child: OpenCodeChild) {
  const watchdog = setInterval(() => {
    const snapshot = TASKS.get(taskId);
    const handle = ACTIVE_RUNNERS.get(taskId);
    if (!snapshot || !handle) return;
    if (snapshot.task.status === "stopped" || snapshot.task.status === "done" || snapshot.task.status === "failed") return;
    const idle = Date.now() - handle.lastOutputAt;
    if (idle > BLOCKED_MS && !handle.blockedNotified) {
      handle.blockedNotified = true;
      snapshot.task.needsHuman = true;
      setStatus(taskId, "blocked", snapshot.task.phase, Math.max(snapshot.task.progressPercent, 65), "No fresh runner output for 2m", "Runner appears idle and may need attention.");
      addEvent(taskId, "task.blocked", "warning", "Runner produced no output for over 2 minutes", { idleMs: idle });
      addNotification(taskId, "task.blocked", "sent");
    }
  }, 15000);

  ACTIVE_RUNNERS.set(taskId, {
    process: child,
    startedAt: Date.now(),
    lastOutputAt: Date.now(),
    watchdog,
    blockedNotified: false,
  });
}

function clearRunner(taskId: string) {
  const handle = ACTIVE_RUNNERS.get(taskId);
  if (!handle) return;
  clearInterval(handle.watchdog);
  ACTIVE_RUNNERS.delete(taskId);
}

function markRunnerActivity(taskId: string) {
  const snapshot = TASKS.get(taskId);
  const handle = ACTIVE_RUNNERS.get(taskId);
  if (!snapshot || !handle) return;
  handle.lastOutputAt = Date.now();
  if (handle.blockedNotified && snapshot.task.status === "blocked") {
    handle.blockedNotified = false;
    snapshot.task.needsHuman = false;
    setStatus(taskId, "running", snapshot.task.phase, Math.max(snapshot.task.progressPercent, 72), "Runner activity resumed", "Runner output resumed.");
    addEvent(taskId, "task.unblocked", "success", "Runner output resumed", { resumedAt: new Date().toISOString() });
  }
}

function mapTextToSignals(taskId: string, text: string) {
  const normalized = text.toLowerCase();
  markRunnerActivity(taskId);
  addLog(taskId, "stdout", normalized.includes("error") ? "warning" : "info", text);

  if (/test|pytest|vitest|npm test|pnpm test|cargo test/.test(normalized)) {
    setStatus(taskId, "running", "testing", 82, text, text);
    addEvent(taskId, "tests.started", "info", text, { source: "opencode-text" });
    return;
  }

  if (/patch|write|implement|refactor|create|edit|modify/.test(normalized)) {
    setStatus(taskId, "running", "coding", 48, text, text);
    addEvent(taskId, "opencode.phase.changed", "info", text, { phase: "coding" });
    return;
  }

  if (/done|completed|finished|summary/.test(normalized)) {
    setStatus(taskId, "running", "summarizing", 92, text, text);
    addEvent(taskId, "opencode.phase.changed", "success", text, { phase: "summarizing" });
  }
}

function handleOpenCodeJsonEvent(taskId: string, event: OpenCodeJsonEvent) {
  const type = event.type ?? event.part?.type;
  const snapshot = ensureTask(taskId);
  setMetadata(taskId, event.sessionID ? { sessionID: event.sessionID } : {});

  if (type === "step_start" || type === "step-start") {
    setStatus(taskId, "running", "coding", 18, "OpenCode session started", "OpenCode session started.");
    addEvent(taskId, "opencode.started", "info", "OpenCode session started", { sessionID: event.sessionID, runner: OPENCODE_BIN });
    addNotification(taskId, "task.started", "sent");
    return;
  }

  if (type === "text" && event.part?.text) {
    mapTextToSignals(taskId, event.part.text);
    return;
  }

  if (type === "tool_use" && event.part?.tool) {
    const tool = event.part.tool;
    const toolStatus = event.part.state?.status ?? "started";
    const level: TaskLog["level"] = tool === "invalid" ? "warning" : "info";
    addLog(taskId, "system", level, `tool:${tool} status=${toolStatus}`);
    addEvent(taskId, "opencode.tool", tool === "invalid" ? "warning" : "info", `OpenCode used ${tool}`, {
      tool,
      status: toolStatus,
      callID: event.part.callID,
    });
    const progress = tool === "write" ? 88 : tool === "read" ? 34 : 62;
    const phase: TaskPhase = tool === "write" ? "coding" : snapshot.task.phase === "queued" ? "triaging" : snapshot.task.phase;
    setStatus(taskId, "running", phase, Math.max(snapshot.task.progressPercent, progress), `OpenCode using ${tool}`, `OpenCode using ${tool}`);
    return;
  }

  if (type === "step_finish" || type === "step-finish") {
    const tokens = event.part?.tokens ?? {};
    const cost = event.part?.cost ?? 0;
    setStatus(taskId, "done", "completed", 100, "Task completed successfully", snapshot.task.summary || "Task completed successfully.");
    addEvent(taskId, "task.completed", "success", "OpenCode run completed", { cost, tokens, reason: event.part?.reason ?? "stop" });
    addLog(taskId, "system", "success", `OpenCode finished. tokens=${tokens.total ?? 0} cost=${cost}`);
    addArtifact(taskId, `${taskId}-summary.json`, "json", `/api/tasks/${taskId}`);
    addNotification(taskId, "task.completed", "sent");
  }
}

function connectLineBuffer(taskId: string, stream: "stdout" | "stderr", onLine: (line: string) => void) {
  let buffer = "";

  const pushLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (stream === "stderr") {
      markRunnerActivity(taskId);
      addLog(taskId, "stderr", /error|failed/i.test(trimmed) ? "error" : "warning", trimmed);
    }
    onLine(trimmed);
  };

  return {
    onData(chunk: Buffer | string) {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const raw of lines) pushLine(raw);
    },
    flush() {
      if (buffer.trim()) pushLine(buffer);
      buffer = "";
    },
  };
}

function startLiveRunner(taskId: string) {
  const snapshot = ensureTask(taskId);
  const cwd = typeof snapshot.task.metadata.cwd === "string" ? snapshot.task.metadata.cwd : DEFAULT_CWD;
  const runner = snapshot.task.runner ?? "opencode";
  const isHermes = runner === "hermes";
  const script = isHermes ? HERMES_RUNNER_SCRIPT : LIVE_RUNNER_SCRIPT;
  const runnerLabel = isHermes ? "Hermes" : "OpenCode";

  clearSimulation(taskId);
  setStatus(taskId, "running", "booting_runner", 6, `正在启动 ${runnerLabel}`, `正在启动 ${runnerLabel}。`);
  addEvent(taskId, "runner.preparing", "info", `准备启动 ${runnerLabel} worker`, { cwd, script, runner });
  addLog(taskId, "system", "info", `正在排队启动 ${runnerLabel} 于 ${cwd}`);
  writeSnapshotFile(snapshot);

  const workerLog = path.join(DATA_DIR, `${taskId}.worker.log`);
  const binVar = isHermes ? "HERMES_BIN" : "OPENCODE_BIN";
  const binPath = isHermes ? "hermes" : OPENCODE_BIN;
  const command = `nohup env TASK_PULSE_ROOT=${DEFAULT_CWD} ${binVar}=${binPath} ${process.execPath} ${script} ${taskId} >> ${workerLog} 2>&1 < /dev/null &`;
  const worker = spawn("bash", ["-lc", command], {
    cwd: DEFAULT_CWD,
    env: process.env,
    stdio: "ignore",
    detached: true,
  });
  worker.unref();
  setMetadata(taskId, { launcherPid: worker.pid, cwd, runnerMode: "live", dataFile: getTaskFile(taskId), workerLog, runner });
  addEvent(taskId, "runner.started", "info", `${runnerLabel} worker 已启动`, { launcherPid: worker.pid, cwd, workerLog, runner });
}

function startTaskExecution(taskId: string) {
  if (getMode(taskId) === "live") {
    startLiveRunner(taskId);
    return;
  }

  addNotification(taskId, "task.started", "queued");
  setTimeout(() => setStatus(taskId, "running", "booting_runner", 8, "Booting runner", "Booting runner"), 500);
  setTimeout(() => addEvent(taskId, "runner.started", "info", "Runner started", { runner: ensureTask(taskId).task.runner }), 800);
  setTimeout(() => addLog(taskId, "system", "info", "Runner connected to SSE demo pipeline"), 1200);
  startSimulation(taskId);
}

function resetTaskState(taskId: string, summary: string, progressText: string) {
  clearSimulation(taskId);
  const existing = TASKS.get(taskId);
  if (!existing) return;
  existing.events = [];
  existing.logs = [];
  existing.artifacts = [];
  existing.notifications = [];
  existing.task.status = "queued";
  existing.task.phase = "queued";
  existing.task.progressPercent = 0;
  existing.task.needsHuman = false;
  existing.task.endedAt = null;
  existing.task.startedAt = new Date().toISOString();
  existing.task.summary = summary;
  existing.task.progressText = progressText;
  mark(taskId);
}

export function ensureStoreBooted() {
  if (booted) return;
  booted = true;
  INITIAL_TASKS.forEach((snapshot) => {
    const copy = deepClone(snapshot);
    TASKS.set(copy.task.id, copy);
    versions.set(copy.task.id, copy.version);
  });
  startSimulation("task_demo_live");
}

export function listTasks() {
  ensureStoreBooted();
  const liveById = new Map(listLiveSnapshots().map((snapshot) => [snapshot.task.id, snapshot]));
  const inMemory = Array.from(TASKS.values())
    .filter((snapshot) => !liveById.has(snapshot.task.id))
    .map((snapshot) => deepClone(snapshot.task));
  const live = Array.from(liveById.values()).map((snapshot) => deepClone(snapshot.task));
  return [...live, ...inMemory].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export function getTaskSnapshot(taskId: string) {
  ensureStoreBooted();
  const fileSnapshot = readSnapshotFile(taskId);
  if (fileSnapshot) return deepClone(fileSnapshot);
  const snapshot = TASKS.get(taskId);
  return snapshot ? deepClone(snapshot) : null;
}

export function getTaskVersion(taskId: string) {
  ensureStoreBooted();
  const fileSnapshot = readSnapshotFile(taskId);
  if (fileSnapshot) return fileSnapshot.version;
  return versions.get(taskId) ?? 0;
}

export function createTask(input: CreateTaskInput) {
  ensureStoreBooted();
  const id = nextId("task");
  const now = new Date().toISOString();
  const mode = input.mode ?? (input.runner === "opencode" ? "live" : "demo");
  const title = input.title || inferTitle(input.prompt, input.category ?? "coding", input.runner ?? "opencode");
  const snapshot: TaskSnapshot = {
    task: {
      id,
      title,
      prompt: input.prompt,
      status: "queued",
      phase: "queued",
      category: input.category ?? "coding",
      runner: input.runner ?? "opencode",
      model: input.model ?? DEFAULT_MODEL,
      source: input.source ?? "manual",
      summary: mode === "live" ? "任务已排队，等待真实 OpenCode 执行。" : "任务已创建，等待启动。",
      progressText: "排队等待执行",
      needsHuman: false,
      startedAt: now,
      updatedAt: now,
      endedAt: null,
      durationMs: 0,
      eventCount: 0,
      logCount: 0,
      notificationCount: 0,
      progressPercent: 0,
      metadata: { mode, cwd: input.cwd ?? DEFAULT_CWD, runnerMode: mode },
    },
    events: [],
    logs: [],
    artifacts: [],
    notifications: [],
    version: 0,
  };
  TASKS.set(id, snapshot);
  versions.set(id, 0);
  addEvent(id, "task.created", "info", "Task created", { source: snapshot.task.source, mode });
  writeSnapshotFile(snapshot);
  startTaskExecution(id);
  return getTaskSnapshot(id);
}

export function stopTask(taskId: string) {
  ensureStoreBooted();
  clearSimulation(taskId);
  const liveSnapshot = readSnapshotFile(taskId);
  if (liveSnapshot) {
    const workerPid = typeof liveSnapshot.task.metadata.workerPid === "number" ? liveSnapshot.task.metadata.workerPid : null;
    if (workerPid) {
      try { process.kill(workerPid, "SIGTERM"); } catch {}
    }
    liveSnapshot.task.needsHuman = false;
    liveSnapshot.task.status = "stopped";
    liveSnapshot.task.phase = liveSnapshot.task.phase;
    liveSnapshot.task.progressText = "Stopped by operator";
    liveSnapshot.task.summary = "Stopped by operator";
    liveSnapshot.task.endedAt = new Date().toISOString();
    liveSnapshot.events.unshift({ id: nextId("evt"), taskId, type: "task.stopped", level: "warning", message: "Task stopped by operator", payload: {}, createdAt: new Date().toISOString() });
    liveSnapshot.notifications.unshift({ id: nextId("ntf"), taskId, channel: "weixin", eventType: "task.stopped", target: "weixin:o9cq8070Ill3Nq2HQBoDp8qBgPts@im.wechat", status: "sent", payload: { taskUrl: `/tasks/${taskId}` }, createdAt: new Date().toISOString() });
    mark(taskId);
    writeSnapshotFile(liveSnapshot);
    return deepClone(liveSnapshot);
  }
  const runner = ACTIVE_RUNNERS.get(taskId);
  if (runner) {
    runner.process.kill("SIGTERM");
    clearRunner(taskId);
  }
  const snapshot = TASKS.get(taskId);
  if (!snapshot) return null;
  snapshot.task.needsHuman = false;
  setStatus(taskId, "stopped", snapshot.task.phase, snapshot.task.progressPercent, "Stopped by operator", "Stopped by operator");
  addEvent(taskId, "task.stopped", "warning", "Task stopped by operator");
  addNotification(taskId, "task.stopped", "sent");
  return getTaskSnapshot(taskId);
}

export function deleteTask(taskId: string): boolean {
  ensureStoreBooted();
  clearSimulation(taskId);
  clearRunner(taskId);

  const liveFile = getTaskFile(taskId);
  try {
    if (existsSync(liveFile)) {
      const data = JSON.parse(readFileSync(liveFile, "utf8")) as TaskSnapshot;
      const workerPid = typeof data.task.metadata.workerPid === "number" ? data.task.metadata.workerPid : null;
      if (workerPid) {
        try { process.kill(workerPid, "SIGTERM"); } catch {}
      }
    }
  } catch {}

  const exists = TASKS.has(taskId) || existsSync(liveFile);
  if (!exists) return false;

  TASKS.delete(taskId);
  versions.delete(taskId);
  ACTIVE_RUNNERS.delete(taskId);

  try {
    if (existsSync(liveFile)) {
      const workerLog = path.join(DATA_DIR, `${taskId}.worker.log`);
      if (existsSync(workerLog)) {
        try { renameSync(workerLog, `${workerLog}.deleted`); } catch {}
        try { renameSync(workerLog, `/tmp/${taskId}.worker.log`); } catch {}
      }
    }
    if (existsSync(liveFile)) renameSync(liveFile, `${liveFile}.deleted`);
    try { renameSync(liveFile, `/tmp/${taskId}.json`); } catch {}
  } catch {}

  return true;
}

export function retryTask(taskId: string) {
  ensureStoreBooted();
  const liveSnapshot = readSnapshotFile(taskId);
  if (liveSnapshot) {
    const workerPid = typeof liveSnapshot.task.metadata.workerPid === "number" ? liveSnapshot.task.metadata.workerPid : null;
    if (workerPid) {
      try { process.kill(workerPid, "SIGTERM"); } catch {}
    }
    liveSnapshot.events = [];
    liveSnapshot.logs = [];
    liveSnapshot.artifacts = [];
    liveSnapshot.notifications = [];
    liveSnapshot.task.status = "queued";
    liveSnapshot.task.phase = "queued";
    liveSnapshot.task.progressPercent = 0;
    liveSnapshot.task.needsHuman = false;
    liveSnapshot.task.endedAt = null;
    liveSnapshot.task.startedAt = new Date().toISOString();
    liveSnapshot.task.summary = "Task retried and queued again.";
    liveSnapshot.task.progressText = "Queued for retry";
    liveSnapshot.version += 1;
    writeSnapshotFile(liveSnapshot);
    TASKS.set(taskId, liveSnapshot);
    versions.set(taskId, liveSnapshot.version);
    addEvent(taskId, "task.retried", "info", "Task retried");
    writeSnapshotFile(ensureTask(taskId));
    startTaskExecution(taskId);
    return getTaskSnapshot(taskId);
  }
  const snapshot = TASKS.get(taskId);
  if (!snapshot) return null;
  if (ACTIVE_RUNNERS.has(taskId)) {
    const runner = ACTIVE_RUNNERS.get(taskId);
    runner?.process.kill("SIGTERM");
    clearRunner(taskId);
  }
  resetTaskState(taskId, "Task retried and queued again.", "Queued for retry");
  addEvent(taskId, "task.retried", "info", "Task retried");
  startTaskExecution(taskId);
  return getTaskSnapshot(taskId);
}
