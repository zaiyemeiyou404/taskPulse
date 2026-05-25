import { Activity, AlertTriangle, Bot, CheckCircle2, Clock3, Layers3, ShieldQuestion, Sparkles, XCircle } from "lucide-react";
import { TaskFilterableSection } from "@/components/task-pulse/task-filterable-section";
import { TaskLauncher } from "@/components/task-pulse/task-launcher";
import { listGroups, listTasks } from "@/lib/task-pulse/store";
import { cn, formatDuration } from "@/lib/task-pulse/utils";
import type { Task } from "@/lib/task-pulse/types";

const statConfig = {
  running: { label: "运行中", icon: Activity, tone: "from-cyan-400/25 to-blue-500/10 text-cyan-200" },
  blocked: { label: "已阻塞", icon: AlertTriangle, tone: "from-amber-400/25 to-orange-500/10 text-amber-200" },
  approval_required: { label: "待审批", icon: ShieldQuestion, tone: "from-violet-400/25 to-purple-500/10 text-violet-200" },
  done: { label: "已完成", icon: CheckCircle2, tone: "from-emerald-400/25 to-green-500/10 text-emerald-200" },
  failed: { label: "已失败", icon: XCircle, tone: "from-rose-400/25 to-red-500/10 text-rose-200" },
} as const;

export function TaskDashboard() {
  const tasks = listTasks();
  const groups = listGroups();
  const running = tasks.filter((task) => task.status === "running").length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const approvalRequired = tasks.filter((task) => task.status === "approval_required").length;
  const done = tasks.filter((task) => task.status === "done").length;
  const failed = tasks.filter((task) => task.status === "failed").length;
  const avgMs = tasks.reduce((sum, task) => sum + task.durationMs, 0) / Math.max(tasks.length, 1);

  const tasksByGroup = new Map<string, Task[]>();
  for (const task of tasks) {
    const gid = task.groupId || "ungrouped";
    if (!tasksByGroup.has(gid)) tasksByGroup.set(gid, []);
    tasksByGroup.get(gid)!.push(task);
  }

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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard kind="running" value={running} />
        <StatCard kind="blocked" value={blocked} />
        <StatCard kind="approval_required" value={approvalRequired} />
        <StatCard kind="done" value={done} />
        <StatCard kind="failed" value={failed} />
        <div className="rounded-[22px] border border-white/10 bg-white/5 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">任务总数</div>
          <div className="mt-4 text-3xl font-semibold text-white">{tasks.length}</div>
          <p className="mt-3 text-sm text-slate-400">总览、详情页、事件流、日志、产物、通知 — 一站式驾驶舱。</p>
        </div>
      </section>

      <TaskLauncher />

      <TaskFilterableSection tasks={tasks} groups={groups} />
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


