#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const taskId = process.argv[2];
if (!taskId) {
  console.error('taskId required');
  process.exit(2);
}

const ROOT = process.env.TASK_PULSE_ROOT || '/home/ubuntu/task-pulse';
const DATA_DIR = path.join(ROOT, '.task-pulse-data');
const FILE = path.join(DATA_DIR, `${taskId}.json`);
const HERMES_BIN = process.env.HERMES_BIN || 'hermes';
const HERMES_ENV_FILE = path.join('/home/ubuntu', '.hermes', '.env');

function loadHermesEnvFile() {
  try {
    const raw = fs.readFileSync(HERMES_ENV_FILE, 'utf8');
    const out = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

// --- Snapshot helpers (same as opencode runner) ---
function readSnapshot() { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
function writeSnapshot(snapshot) {
  snapshot.version = (snapshot.version || 0) + 1;
  snapshot.task.updatedAt = new Date().toISOString();
  if (snapshot.task.startedAt) snapshot.task.durationMs = Date.now() - new Date(snapshot.task.startedAt).getTime();
  snapshot.task.eventCount = snapshot.events.length;
  snapshot.task.logCount = snapshot.logs.length;
  snapshot.task.notificationCount = snapshot.notifications.length;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2));
  fs.renameSync(tmp, FILE);
}
function nextId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function addEvent(snapshot, type, level, message, payload = {}) {
  snapshot.events.unshift({ id: nextId('evt'), taskId, type, level, message, payload, createdAt: new Date().toISOString() });
}
function addLog(snapshot, stream, level, content) {
  snapshot.logs.push({ id: nextId('log'), taskId, stream, level, content, createdAt: new Date().toISOString() });
}
function addNotification(snapshot, eventType, status) {
  snapshot.notifications.unshift({
    id: nextId('ntf'), taskId, channel: '微信', eventType, target: 'weixin:o9cq8070Ill3Nq2HQBoDp8qBgPts@im.wechat', status,
    payload: { taskUrl: `/tasks/${taskId}` }, createdAt: new Date().toISOString(),
  });
}
function addArtifact(snapshot, name, kind, refPath) {
  snapshot.artifacts.unshift({ id: nextId('artifact'), taskId, name, kind, path: refPath, createdAt: new Date().toISOString() });
}
function setStatus(snapshot, status, phase, progressPercent, progressText, summary) {
  snapshot.task.status = status;
  snapshot.task.phase = phase;
  snapshot.task.progressPercent = progressPercent;
  snapshot.task.progressText = progressText;
  if (summary) snapshot.task.summary = summary;
  snapshot.task.needsHuman = status === 'blocked';
  if (['done', 'failed', 'stopped'].includes(status)) snapshot.task.endedAt = new Date().toISOString();
}
function persist(mutator) {
  const snapshot = readSnapshot();
  mutator(snapshot);
  writeSnapshot(snapshot);
}

// --- Boot phase ---
persist((snapshot) => {
  setStatus(snapshot, 'running', 'booting_runner', 5, '启动 Hermes Agent', '正在启动 Hermes Agent。');
  addEvent(snapshot, 'runner.preparing', 'info', '准备启动 Hermes Agent', { workerPid: process.pid, category: snapshot.task.category });
  addLog(snapshot, 'system', 'info', `Hermes worker ${process.pid} 已启动`);
  snapshot.task.metadata = { ...(snapshot.task.metadata || {}), workerPid: process.pid, dataFile: FILE, runnerMode: 'live' };
});

const bootSnapshot = readSnapshot();
const cwd = typeof bootSnapshot.task.metadata?.cwd === 'string' ? bootSnapshot.task.metadata.cwd : ROOT;
const model = bootSnapshot.task.model || 'deepseek/deepseek-chat';
const prompt = bootSnapshot.task.prompt;
const category = bootSnapshot.task.category || 'coding';

// Map category to relevant skills/toolsets for Hermes
const categoryToolsetMap = {
  chat: 'terminal,web',
  ppt: 'terminal,file,web',
  paper: 'terminal,file,web',
  coding: 'terminal,file,web',
};
const toolsets = categoryToolsetMap[category] || 'terminal,file,web';

// Build env with API keys
const fileEnv = loadHermesEnvFile();
const env = { ...process.env };
for (const [k, v] of Object.entries(fileEnv)) {
  if (!env[k]) env[k] = v;
}
env.HOME ||= '/home/ubuntu';
env.PATH ||= '/usr/local/bin:/usr/bin:/bin';

// Spawn Hermes in single-query mode
const args = [
  'chat',
  '-q', prompt,
  '--model', model,
  '--yolo',
  '--quiet',
  '-t', toolsets,
  '--source', 'task-pulse',
  '--ignore-rules',
  '--max-turns', '30',
];
const child = spawn(HERMES_BIN, args, {
  cwd,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

persist((snapshot) => {
  snapshot.task.metadata = { ...(snapshot.task.metadata || {}), pid: child.pid, cwd, model, workerPid: process.pid, runner: 'hermes', toolsets };
  addEvent(snapshot, 'runner.started', 'info', 'Hermes Agent 已启动', { pid: child.pid, cwd, model, toolsets });
  addLog(snapshot, 'system', 'info', `执行: ${HERMES_BIN} chat -q "${prompt.slice(0, 80)}..." --model ${model}`);
});

let lastOutputAt = Date.now();
let blockedNotified = false;
const BLOCKED_MS = 5 * 60 * 1000; // Hermes may take longer

const watchdog = setInterval(() => {
  const idle = Date.now() - lastOutputAt;
  if (idle <= BLOCKED_MS || blockedNotified) return;
  blockedNotified = true;
  persist((snapshot) => {
    setStatus(snapshot, 'blocked', snapshot.task.phase, Math.max(snapshot.task.progressPercent, 65), 'Hermes 超过 5 分钟无输出', 'Hermes 可能卡住了，需要人工关注。');
    addEvent(snapshot, 'task.blocked', 'warning', 'Hermes 超过 5 分钟无输出', { idleMs: idle });
    addNotification(snapshot, 'task.blocked', 'sent');
  });
}, 30000);

function markOutput() {
  lastOutputAt = Date.now();
  if (!blockedNotified) return;
  blockedNotified = false;
  persist((snapshot) => {
    setStatus(snapshot, 'running', snapshot.task.phase, Math.max(snapshot.task.progressPercent, 72), 'Hermes 输出已恢复', 'Hermes 输出已恢复。');
    addEvent(snapshot, 'task.unblocked', 'success', 'Hermes 输出已恢复');
  });
}

// --- Output parsing ---
let stdoutBuffer = '';
child.stdout.on('data', (chunk) => {
  markOutput();
  stdoutBuffer += chunk.toString();
  const lines = stdoutBuffer.split(/\r?\n/);
  stdoutBuffer = lines.pop() || '';
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    persist((snapshot) => {
      const lower = line.toLowerCase();

      // Detect phase transitions from output
      if (line.includes('正在读取') || line.includes('read_file') || line.includes('search_files') || /analyzing|reading|inspecting|理解|分析/i.test(line)) {
        setStatus(snapshot, 'running', 'triaging', 15, line.slice(0, 100), line.slice(0, 100));
        addEvent(snapshot, 'hermes.phase.changed', 'info', line.slice(0, 120), { phase: 'triaging' });
      } else if (line.includes('正在创建') || line.includes('write_file') || line.includes('patch') || /creating|writing|implementing|building|生成|创建|编写/i.test(line)) {
        setStatus(snapshot, 'running', 'coding', 45, line.slice(0, 100), line.slice(0, 100));
        addEvent(snapshot, 'hermes.phase.changed', 'info', line.slice(0, 120), { phase: 'coding' });
      } else if (line.includes('test') || line.includes('测试') || line.includes('运行') || line.includes('check') || /testing|validating|lint/i.test(line)) {
        setStatus(snapshot, 'running', 'testing', 78, line.slice(0, 100), line.slice(0, 100));
        addEvent(snapshot, 'hermes.phase.changed', 'info', line.slice(0, 120), { phase: 'testing' });
      } else if (line.includes('完成') || line.includes('done') || line.includes('汇总') || line.includes('总结') || /completed|finished|summary|结果/i.test(line)) {
        setStatus(snapshot, 'running', 'summarizing', 92, line.slice(0, 100), line.slice(0, 100));
        addEvent(snapshot, 'hermes.phase.changed', 'success', line.slice(0, 120), { phase: 'summarizing' });
      }

      const level = /error|失败|错误|异常/i.test(line) ? 'warning' : 'info';
      addLog(snapshot, 'stdout', level, line.slice(0, 200));
    });
  }
});

child.stderr.on('data', (chunk) => {
  markOutput();
  const line = chunk.toString().trim();
  if (!line) return;
  persist((snapshot) => {
    addLog(snapshot, 'stderr', /error|failed/i.test(line) ? 'error' : 'warning', line.slice(0, 200));
  });
});

// --- Cleanup ---
function stopChildAndMark(reason) {
  try { child.kill('SIGTERM'); } catch {}
  persist((snapshot) => {
    setStatus(snapshot, 'stopped', snapshot.task.phase, snapshot.task.progressPercent, reason, reason);
    addEvent(snapshot, 'task.stopped', 'warning', reason);
    addNotification(snapshot, 'task.stopped', 'sent');
  });
}

process.on('SIGTERM', () => { clearInterval(watchdog); stopChildAndMark('操作者已停止'); setTimeout(() => process.exit(0), 200); });
process.on('SIGINT', () => { clearInterval(watchdog); stopChildAndMark('操作者已停止'); setTimeout(() => process.exit(0), 200); });

child.on('error', (error) => {
  clearInterval(watchdog);
  persist((snapshot) => {
    setStatus(snapshot, 'failed', 'failed', Math.max(snapshot.task.progressPercent, 10), `Hermes 启动失败: ${error.message}`, `Hermes 启动失败: ${error.message}`);
    addEvent(snapshot, 'runner.exited', 'error', 'Hermes 进程启动失败', { error: error.message });
    addNotification(snapshot, 'task.failed', 'sent');
  });
  process.exit(1);
});

child.on('close', (code, signal) => {
  clearInterval(watchdog);
  if (stdoutBuffer.trim()) {
    persist((snapshot) => {
      addLog(snapshot, 'stdout', 'info', stdoutBuffer.trim().slice(0, 200));
    });
  }
  const snapshot = readSnapshot();
  if (snapshot.task.status === 'done' || snapshot.task.status === 'stopped') {
    process.exit(0);
    return;
  }
  if (code === 0) {
    persist((fresh) => {
      setStatus(fresh, 'done', 'completed', 100, 'Hermes 任务已完成', fresh.task.summary || 'Hermes 任务已完成。');
      addEvent(fresh, 'runner.exited', 'success', 'Hermes 进程已正常退出', { code });
      addNotification(fresh, 'task.completed', 'sent');
    });
    process.exit(0);
    return;
  }
  persist((fresh) => {
    setStatus(fresh, 'failed', 'failed', Math.max(fresh.task.progressPercent, 10), `Hermes 退出码: ${code ?? 'unknown'}`, `Hermes 以代码 ${code ?? 'unknown'} 退出${signal ? ` (${signal})` : ''}。`);
    addEvent(fresh, 'runner.exited', 'error', 'Hermes 进程异常退出', { code, signal });
    addNotification(fresh, 'task.failed', 'sent');
  });
  process.exit(code || 1);
});
