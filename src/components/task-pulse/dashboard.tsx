import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, Bot, CheckCircle2, Clock3, Layers3, Sparkles, XCircle, Trash2 } from "lucide-react";
import { TaskLauncher } from "@/components/task-pulse/task-launcher";
import { DashboardDeleteButton } from "@/components/task-pulse/dashboard-client";
import { listTasks } from "@/lib/task-pulse/store";
import { categoryInfo, cn, formatDuration, formatRelative, phaseLabel, statusLabel } from "@/lib/task-pulse/utils";
import { Task, TaskCategory } from "@/lib/task-pulse/types";

const statConfig = {
  running: { label: "运行中", icon: Activity, tone: "from-cyan-400/25 to-blue-500/10 text-cyan-200" },
  blocked: { label: "已阻塞", icon: AlertTriangle, tone: "from-amber-400/25 to-orange-500/10 text-amber-200" },
  done: { label: "已完成", icon: CheckCircle2, tone: "from-emerald-400/25 to-green-500/10 text-emerald-200" },
  failed: { label: "已失败", icon: XCircle, tone: "from-rose-400/25 to-red-500/10 text-rose-200" },
} as const;

export function TaskDashboard() {
  const tasks = listTasks();
  const running = tasks.filter((task) => task.status === "running").length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const done = tasks.filter((task) => task.status === "done").length;
  const failed = tasks.filter((task) => task.status === "failed").length;
  const avgMs = tasks.reduce((sum, task) => sum + task.durationMs, 0) / Math.max(tasks.length, 1);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10">
      <header className="flex flex-col gap-5 rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(124,140,255,0.14),rgba(10,12,18,0.95),rgba(61,217,197,0.08))] p-8 shadow-[0_20px_80px_rgba(5,8,15,0.55)] backdrop-blur-xl">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_20px_rgba(61,217,197,0.9)]" />
              实时控制台
            </div>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Task Pulse</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                给 Hermes / OpenCode / DeepSeek 任务流做的实时驾驶舱。看见每个任务的状态、阶段、日志、通知与最终产物。
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm text-slate-300 sm:grid-cols-4">
            <Metric label="平均耗时" value={formatDuration(avgMs)} icon={Clock3} />
            <Metric label="模型" value="DeepSeek" icon={Bot} />
            <Metric label="来源" value="微信 + n8n" icon={Layers3} />
            <Metric label="传输" value="SSE 实时" icon={Sparkles} />
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard kind="running" value={running} />
        <StatCard kind="blocked" value={blocked} />
        <StatCard kind="done" value={done} />
        <StatCard kind="failed" value={failed} />
        <div className="rounded-[22px] border border-white/10 bg-white/5 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">任务总数</div>
          <div className="mt-4 text-3xl font-semibold text-white">{tasks.length}</div>
          <p className="mt-3 text-sm text-slate-400">总览、详情页、事件流、日志、产物、通知 — 一站式驾驶舱。</p>
        </div>
      </section>

      <TaskLauncher />

      <section className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl md:p-5">
        <div className="mb-4 flex items-center justify-between gap-4 px-2">
          <div>
            <h2 className="text-xl font-semibold text-white">实时任务</h2>
            <p className="mt-1 text-sm text-slate-400">运行中、已阻塞、已完成 — 全部在一个高级队列视图中呈现。</p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">服务端状态自动刷新</div>
        </div>

        {/* ---- 列表视图 ---- */}
        <div className="mb-6 overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
          <p className="px-4 pt-3 pb-1 text-xs text-slate-500">按最近更新时间倒序</p>
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 font-medium">排名</th>
                <th className="px-4 py-3 font-medium">任务名</th>
                <th className="px-4 py-3 font-medium">当前状态</th>
                <th className="px-4 py-3 font-medium">当前步骤</th>
                <th className="px-4 py-3 font-medium">最近更新时间</th>
                <th className="px-4 py-3 font-medium">耗时</th>
                <th className="px-4 py-3 font-medium">需要人工</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, i) => {
                const statusStyles: Record<string, string> = {
                  queued: "text-slate-400",
                  running: "text-cyan-200",
                  blocked: "text-amber-200",
                  done: "text-emerald-200",
                  failed: "text-rose-200",
                  stopped: "text-slate-400",
                };
                return (
                  <tr
                    key={task.id}
                    className="border-b border-white/5 transition hover:bg-white/5 last:border-b-0"
                  >
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-white">
                      <Link href={`/tasks/${task.id}`} className="text-cyan-200 hover:text-cyan-100 underline underline-offset-2 decoration-white/20">{task.title}</Link>
                    </td>
                    <td className="px-4 py-3"><span className={statusStyles[task.status] ?? "text-slate-300"}>{statusLabel(task.status)}</span></td>
                    <td className="px-4 py-3 text-slate-300">{phaseLabel(task.phase)}</td>
                    <td className="px-4 py-3 text-slate-400">{formatRelative(task.updatedAt)}</td>
                    <td className="px-4 py-3 text-slate-300">{formatDuration(task.durationMs)}</td>
                    <td className="px-4 py-3 text-slate-300">{task.needsHuman ? "是" : "否"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/tasks/${task.id}`} className="inline-flex items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-400/20 transition">查看详情</Link>
                        <DashboardDeleteButton taskId={task.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ---- 卡片视图 ---- */}
        <div className="grid gap-4">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
      <div className="flex items-center gap-2 text-slate-400"><Icon className="h-4 w-4" />{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function StatCard({ kind, value }: { kind: keyof typeof statConfig; value: number }) {
  const config = statConfig[kind];
  const Icon = config.icon;
  return (
    <div className={cn("rounded-[22px] border border-white/10 bg-gradient-to-br p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl", config.tone)}>
      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>{config.label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-5 text-3xl font-semibold text-white">{value}</div>
      <p className="mt-2 text-sm text-slate-400">精细事件流与实时日志详情可见。</p>
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const statusLabels: Record<Task["status"], string> = {
    queued: "排队中",
    running: "运行中",
    blocked: "已阻塞",
    done: "已完成",
    failed: "已失败",
    stopped: "已停止",
  };
  const statusStyles: Record<Task["status"], string> = {
    queued: "bg-slate-500/15 text-slate-200 border-slate-300/10",
    running: "bg-cyan-400/15 text-cyan-200 border-cyan-300/10",
    blocked: "bg-amber-400/15 text-amber-200 border-amber-300/10",
    done: "bg-emerald-400/15 text-emerald-200 border-emerald-300/10",
    failed: "bg-rose-400/15 text-rose-200 border-rose-300/10",
    stopped: "bg-slate-500/15 text-slate-200 border-slate-300/10",
  };
  const cat = categoryInfo[task.category as TaskCategory] ?? categoryInfo.coding;
  const runnerBadgeStyle: Record<string, string> = {
    opencode: "border-purple-300/30 bg-purple-400/15 text-purple-200",
    hermes: "border-amber-300/30 bg-amber-400/15 text-amber-200",
    codex: "border-blue-300/30 bg-blue-400/15 text-blue-200",
  };

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="group grid gap-5 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/20 hover:bg-[linear-gradient(180deg,rgba(124,140,255,0.08),rgba(255,255,255,0.03))]"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-semibold text-white">{task.title}</h3>
            <span className={cn("rounded-full border px-3 py-1 text-xs font-medium", statusStyles[task.status])}>{statusLabels[task.status]}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{phaseLabel(task.phase)}</span>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-slate-400">{task.summary}</p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            <Chip>{task.id}</Chip>
            <Chip>{task.model}</Chip>
            <Chip>{task.source}</Chip>
          </div>
        </div>

        {/* Top-right badges: runner + category */}
        <div className="flex flex-col items-end gap-2">
          {/* Runner badge */}
          <span className={cn("rounded-full border px-3 py-1 text-xs font-medium capitalize", runnerBadgeStyle[task.runner] ?? "border-slate-300/20 bg-slate-400/10 text-slate-300")}>
            {task.runner}
          </span>
          {/* Category badge */}
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", cat.color)}>
            <span>{cat.icon}</span>
            {cat.label}
          </span>
          {/* Mini stats */}
          <div className="grid grid-cols-2 gap-2 text-sm mt-1">
            <Mini label="耗时" value={formatDuration(task.durationMs)} />
            <Mini label="进度" value={`${task.progressPercent}%`} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>最后事件: {formatRelative(task.updatedAt)}</span>
          <span>需人工: {task.needsHuman ? "是" : "否"}</span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/15 px-4 py-3 text-sm text-slate-300">
        <span>{task.progressText}</span>
        <span className="inline-flex items-center gap-2 text-cyan-200">查看详情 <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
      </div>
    </Link>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{children}</span>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-white">{value}</div>
    </div>
  );
}
