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
const OPENCODE_BIN = process.env.OPENCODE_BIN || '/home/ubuntu/.hermes/node/bin/opencode';
const HERMES_ENV_FILE = path.join('/home/ubuntu', '.hermes', '.env');
const OPENCODE_ENV_KEYS = [
  'HOME',
  'PATH',
  'USER',
  'LOGNAME',
  'LANG',
  'LC_ALL',
  'SHELL',
  'TMPDIR',
  'TERM',
  'COLORTERM',
  'DEEPSEEK_API_KEY',
  'OPENAI_API_KEY',
  'OPENROUTER_API_KEY',
  'ANTHROPIC_API_KEY',
  'XAI_API_KEY',
  'GOOGLE_API_KEY',
  'GEMINI_API_KEY',
];

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

function buildOpencodeEnv() {
  const fileEnv = loadHermesEnvFile();
  const env = {};
  for (const key of OPENCODE_ENV_KEYS) {
    if (process.env[key]) env[key] = process.env[key];
    else if (fileEnv[key]) env[key] = fileEnv[key];
  }
  env.HOME ||= '/home/ubuntu';
  env.PATH ||= '/usr/local/bin:/usr/bin:/bin';
  env.LANG ||= 'C.UTF-8';
  return env;
}


function readSnapshot() {
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}
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
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}
function addEvent(snapshot, type, level, message, payload={}) {
  snapshot.events.unshift({ id: nextId('evt'), taskId, type, level, message, payload, createdAt: new Date().toISOString() });
}
function addLog(snapshot, stream, level, content) {
  snapshot.logs.push({ id: nextId('log'), taskId, stream, level, content, createdAt: new Date().toISOString() });
}
function addNotification(snapshot, eventType, status) {
  snapshot.notifications.unshift({ id: nextId('ntf'), taskId, channel: 'weixin', eventType, target: 'weixin:o9cq8070Ill3Nq2HQBoDp8qBgPts@im.wechat', status, payload: { taskUrl: `/tasks/${taskId}` }, createdAt: new Date().toISOString() });
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
  if (['done','failed','stopped'].includes(status)) snapshot.task.endedAt = new Date().toISOString();
}
function persist(mutator) {
  const snapshot = readSnapshot();
  mutator(snapshot);
  writeSnapshot(snapshot);
}

persist((snapshot) => {
  setStatus(snapshot, 'running', 'booting_runner', 6, 'Booting OpenCode runner', 'Booting OpenCode runner.');
  addEvent(snapshot, 'runner.preparing', 'info', 'Preparing detached OpenCode worker', { workerPid: process.pid });
  addLog(snapshot, 'system', 'info', `Detached worker ${process.pid} booted`);
  snapshot.task.metadata = { ...(snapshot.task.metadata || {}), workerPid: process.pid, dataFile: FILE, runnerMode: 'live' };
});

const bootSnapshot = readSnapshot();
const cwd = typeof bootSnapshot.task.metadata?.cwd === 'string' ? bootSnapshot.task.metadata.cwd : ROOT;
const model = bootSnapshot.task.model || 'deepseek/deepseek-chat';
const prompt = bootSnapshot.task.prompt;

const child = spawn(OPENCODE_BIN, ['run', '--model', model, '--format', 'json', prompt], {
  cwd,
  env: buildOpencodeEnv(),
  stdio: ['ignore', 'pipe', 'pipe'],
});

persist((snapshot) => {
  snapshot.task.metadata = { ...(snapshot.task.metadata || {}), pid: child.pid, cwd, model, workerPid: process.pid };
  addEvent(snapshot, 'runner.started', 'info', 'OpenCode process spawned', { pid: child.pid, cwd, workerPid: process.pid });
  addLog(snapshot, 'system', 'info', `Launching ${OPENCODE_BIN} in ${cwd}`);
});

let lastOutputAt = Date.now();
let blockedNotified = false;
const BLOCKED_MS = 2 * 60 * 1000;
const watchdog = setInterval(() => {
  const idle = Date.now() - lastOutputAt;
  if (idle <= BLOCKED_MS || blockedNotified) return;
  blockedNotified = true;
  persist((snapshot) => {
    setStatus(snapshot, 'blocked', snapshot.task.phase, Math.max(snapshot.task.progressPercent, 65), 'No fresh runner output for 2m', 'Runner appears idle and may need attention.');
    addEvent(snapshot, 'task.blocked', 'warning', 'Runner produced no output for over 2 minutes', { idleMs: idle });
    addNotification(snapshot, 'task.blocked', 'sent');
  });
}, 15000);

function markOutput() {
  lastOutputAt = Date.now();
  if (!blockedNotified) return;
  blockedNotified = false;
  persist((snapshot) => {
    setStatus(snapshot, 'running', snapshot.task.phase === 'failed' ? 'coding' : snapshot.task.phase, Math.max(snapshot.task.progressPercent, 72), 'Runner activity resumed', 'Runner output resumed.');
    addEvent(snapshot, 'task.unblocked', 'success', 'Runner output resumed');
  });
}

function handleEvent(event) {
  const type = event.type || event.part?.type;
  persist((snapshot) => {
    if (event.sessionID) snapshot.task.metadata = { ...(snapshot.task.metadata || {}), sessionID: event.sessionID };
    if (type === 'step_start' || type === 'step-start') {
      setStatus(snapshot, 'running', 'coding', 18, 'OpenCode session started', 'OpenCode session started.');
      addEvent(snapshot, 'opencode.started', 'info', 'OpenCode session started', { sessionID: event.sessionID, runner: OPENCODE_BIN });
      addNotification(snapshot, 'task.started', 'sent');
      return;
    }
    if (type === 'tool_use' && event.part?.tool) {
      const tool = event.part.tool;
      const toolStatus = event.part.state?.status || 'started';
      addLog(snapshot, 'system', tool === 'invalid' ? 'warning' : 'info', `tool:${tool} status=${toolStatus}`);
      addEvent(snapshot, 'opencode.tool', tool === 'invalid' ? 'warning' : 'info', `OpenCode used ${tool}`, { tool, status: toolStatus, callID: event.part.callID });
      const progress = tool === 'write' ? 88 : tool === 'read' ? 34 : 62;
      const phase = tool === 'write' ? 'coding' : snapshot.task.phase === 'queued' ? 'triaging' : snapshot.task.phase;
      setStatus(snapshot, 'running', phase, Math.max(snapshot.task.progressPercent, progress), `OpenCode using ${tool}`, `OpenCode using ${tool}`);
      return;
    }
    if (type === 'text' && event.part?.text) {
      const text = event.part.text;
      const lower = text.toLowerCase();
      addLog(snapshot, 'stdout', /error/.test(lower) ? 'warning' : 'info', text);
      if (/test|pytest|vitest|npm test|pnpm test|cargo test/.test(lower)) {
        setStatus(snapshot, 'running', 'testing', 82, text, text);
        addEvent(snapshot, 'tests.started', 'info', text, { source: 'opencode-text' });
      } else if (/patch|write|implement|refactor|create|edit|modify/.test(lower)) {
        setStatus(snapshot, 'running', 'coding', 48, text, text);
        addEvent(snapshot, 'opencode.phase.changed', 'info', text, { phase: 'coding' });
      } else if (/done|completed|finished|summary/.test(lower)) {
        setStatus(snapshot, 'running', 'summarizing', 92, text, text);
        addEvent(snapshot, 'opencode.phase.changed', 'success', text, { phase: 'summarizing' });
      }
      return;
    }
    if (type === 'step_finish' || type === 'step-finish') {
      if ((event.part?.reason || 'stop') !== 'stop') return;
      const tokens = event.part?.tokens || {};
      const cost = event.part?.cost || 0;
      setStatus(snapshot, 'done', 'completed', 100, 'Task completed successfully', snapshot.task.summary || 'Task completed successfully.');
      addEvent(snapshot, 'task.completed', 'success', 'OpenCode run completed', { cost, tokens, reason: event.part?.reason || 'stop' });
      addLog(snapshot, 'system', 'success', `OpenCode finished. tokens=${tokens.total || 0} cost=${cost}`);
      addArtifact(snapshot, `${taskId}-summary.json`, 'json', `/api/tasks/${taskId}`);
      addNotification(snapshot, 'task.completed', 'sent');
    }
  });
}

function wireStream(stream, streamName) {
  let buffer = '';
  stream.on('data', (chunk) => {
    markOutput();
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const raw of lines) handleLine(raw, streamName);
  });
  stream.on('end', () => {
    if (buffer.trim()) handleLine(buffer, streamName);
    buffer = '';
  });
}

function handleLine(raw, streamName) {
  const line = String(raw).trim();
  if (!line) return;
  if (streamName === 'stderr') {
    persist((snapshot) => {
      addLog(snapshot, 'stderr', /error|failed/i.test(line) ? 'error' : 'warning', line);
      if (/auth|api key|credential/i.test(line)) addEvent(snapshot, 'opencode.error', 'error', line, { channel: 'stderr' });
    });
    return;
  }
  try {
    handleEvent(JSON.parse(line));
  } catch {
    persist((snapshot) => {
      addLog(snapshot, 'stdout', 'info', line);
    });
  }
}

wireStream(child.stdout, 'stdout');
wireStream(child.stderr, 'stderr');

function stopChildAndMark(reason) {
  try { child.kill('SIGTERM'); } catch {}
  persist((snapshot) => {
    setStatus(snapshot, 'stopped', snapshot.task.phase, snapshot.task.progressPercent, reason, reason);
    addEvent(snapshot, 'task.stopped', 'warning', reason);
    addNotification(snapshot, 'task.stopped', 'sent');
  });
}

process.on('SIGTERM', () => {
  clearInterval(watchdog);
  stopChildAndMark('Stopped by operator');
  setTimeout(() => process.exit(0), 200);
});
process.on('SIGINT', () => {
  clearInterval(watchdog);
  stopChildAndMark('Stopped by operator');
  setTimeout(() => process.exit(0), 200);
});

child.on('error', (error) => {
  clearInterval(watchdog);
  persist((snapshot) => {
    setStatus(snapshot, 'failed', 'failed', Math.max(snapshot.task.progressPercent, 12), error.message, error.message);
    addEvent(snapshot, 'runner.exited', 'error', 'OpenCode process failed to start', { error: error.message });
    addNotification(snapshot, 'task.failed', 'sent');
  });
  process.exit(1);
});

child.on('close', (code, signal) => {
  clearInterval(watchdog);
  const snapshot = readSnapshot();
  if (snapshot.task.status === 'done' || snapshot.task.status === 'stopped') {
    process.exit(0);
    return;
  }
  if (code === 0) {
    if (snapshot.task.status !== 'done') {
      persist((fresh) => {
        setStatus(fresh, 'done', 'completed', 100, 'Task completed successfully', fresh.task.summary || 'Task completed successfully.');
        addEvent(fresh, 'runner.exited', 'success', 'OpenCode process exited cleanly', { code, signal });
        addNotification(fresh, 'task.completed', 'sent');
      });
    }
    process.exit(0);
    return;
  }
  persist((fresh) => {
    setStatus(fresh, 'failed', 'failed', Math.max(fresh.task.progressPercent, 12), `Runner exited with code ${code ?? 'unknown'}`, `OpenCode exited with code ${code ?? 'unknown'}${signal ? ` (${signal})` : ''}.`);
    addEvent(fresh, 'runner.exited', 'error', 'OpenCode process exited with failure', { code, signal });
    addNotification(fresh, 'task.failed', 'sent');
  });
  process.exit(code || 1);
});
