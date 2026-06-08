"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Globe, Search } from "lucide-react";
import { categoryInfo, cn, phaseLabel, statusLabel } from "@/lib/task-pulse/utils";
import { Task, TaskCategory, TaskStatus } from "@/lib/task-pulse/types";

export function TaskFilterableSection({ tasks, groups }: { tasks: Task[]; groups: { id: string; name: string; category: TaskCategory; summary: string; childTaskIds: string[]; repoLink?: string }[] }) {
  const allStatuses: TaskStatus[] = ["queued", "running", "blocked", "approval_required", "done", "failed", "stopped"];
  const allCategories: TaskCategory[] = ["chat", "ppt", "paper", "coding", "skill", "novel"];

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | "all">("all");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (categoryFilter !== "all" && task.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = task.id.toLowerCase().includes(q);
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesSummary = task.summary.toLowerCase().includes(q);
        const matchesPrompt = task.prompt.toLowerCase().includes(q);
        if (!matchesId && !matchesTitle && !matchesSummary && !matchesPrompt) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, categoryFilter, searchQuery]);

  const tasksByGroup = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of filteredTasks) {
      const gid = task.groupId || "ungrouped";
      if (!map.has(gid)) map.set(gid, []);
      map.get(gid)!.push(task);
    }
    return map;
  }, [filteredTasks]);

  const filteredGroups = groups.filter((g) => tasksByGroup.has(g.id));

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl md:p-5">
      <div className="mb-4 flex items-center justify-between gap-4 px-2">
        <div>
          <h2 className="text-xl font-semibold text-white">实时任务 — 按大任务分组</h2>
          <p className="mt-1 text-sm text-slate-400">运行中、已阻塞、已完成 — 按项目/大任务分组展示。</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">服务端状态自动刷新</div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3 px-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索任务 ID、标题、摘要…"
            className="w-full rounded-full border border-white/10 bg-black/15 pl-10 pr-4 py-2 text-sm text-white outline-none transition focus:border-cyan-300/25 placeholder:text-slate-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>全部</FilterChip>
          {allStatuses.map((s) => (
            <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{statusLabel(s)}</FilterChip>
          ))}
        </div>
        <div className="h-6 w-px bg-white/10" />
        <div className="flex flex-wrap gap-2">
          <FilterChip active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>全类别</FilterChip>
          {allCategories.map((c) => (
            <FilterChip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)}>{categoryInfo[c].label}</FilterChip>
          ))}
        </div>
        {filteredTasks.length < tasks.length && (
          <span className="text-xs text-slate-500">筛选出 {filteredTasks.length} / {tasks.length} 个任务</span>
        )}
      </div>

      <ol className="space-y-3">
        {filteredGroups.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-slate-500">
            {searchQuery || statusFilter !== "all" || categoryFilter !== "all" ? "没有匹配的任务" : "暂无任务"}
          </li>
        ) : (
          filteredGroups.map((group, idx) => {
            const groupTasks = tasksByGroup.get(group.id) ?? [];
            const cat = categoryInfo[group.category] ?? categoryInfo.coding;
            const isExpanded = expandedGroups[group.id];
            return (
              <li key={group.id} className="rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(124,140,255,0.06),rgba(10,12,18,0.5),rgba(61,217,197,0.04))] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-slate-300">
                      {idx + 1}
                    </span>
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium shrink-0", cat.color)}>
                      <span>{cat.icon}</span>
                      {cat.label}
                    </span>
                    <h3 className="truncate text-lg font-semibold text-white">{group.name}</h3>
                    {group.repoLink && (
                      <a href={group.repoLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-purple-300/20 bg-purple-400/10 px-3 py-1 text-xs text-purple-200 hover:bg-purple-400/20 transition shrink-0">
                        <Globe className="h-3 w-3" />
                        仓库
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">{groupTasks.length} 个子任务</span>
                    <button type="button" onClick={() => toggleGroup(group.id)} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10 transition">
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      {isExpanded ? "收起小任务" : "展开小任务"}
                    </button>
                  </div>
                </div>

                {isExpanded && groupTasks.length > 0 && (
                  <div className="mt-3 space-y-1.5 pl-11">
                    {groupTasks.map((task) => (
                      <SubTaskRow key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </li>
            );
          })
        )}

        {(() => {
          const ungrouped = filteredTasks.filter((t) => !t.groupId || !groups.some((g) => g.id === t.groupId));
          if (ungrouped.length === 0) return null;
          return (
            <li className="rounded-[26px] border border-white/10 bg-white/5 p-4">
              <h3 className="mb-3 text-lg font-semibold text-white">其他任务</h3>
              <div className="space-y-1.5">
                {ungrouped.map((task) => (
                  <SubTaskRow key={task.id} task={task} />
                ))}
              </div>
            </li>
          );
        })()}
      </ol>
    </section>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition",
        active
          ? "bg-white text-slate-950 border-white"
          : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
      )}
    >
      {children}
    </button>
  );
}

const statusLabels: Record<string, string> = {
  queued: "排队中",
  running: "运行中",
  blocked: "已阻塞",
  approval_required: "待命令同意",
  done: "已完成",
  failed: "已失败",
  stopped: "已停止",
};

const statusStyles: Record<Task["status"], string> = {
  queued: "bg-slate-500/15 text-slate-200 border-slate-300/10",
  running: "bg-cyan-400/15 text-cyan-200 border-cyan-300/10",
  blocked: "bg-amber-400/15 text-amber-200 border-amber-300/10",
  approval_required: "bg-violet-400/15 text-violet-200 border-violet-300/10",
  done: "bg-emerald-400/15 text-emerald-200 border-emerald-300/10",
  failed: "bg-rose-400/15 text-rose-200 border-rose-300/10",
  stopped: "bg-slate-500/15 text-slate-200 border-slate-300/10",
};

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hours}:${mins}`;
}

function SubTaskRow({ task }: { task: Task }) {
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-sm transition hover:bg-white/[0.06] active:bg-white/[0.08]"
    >
      <span className={cn("inline-flex items-center gap-1.5 shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium", categoryInfo[task.category]?.color)}>
        <span>{categoryInfo[task.category]?.icon}</span>
        {categoryInfo[task.category]?.label}
      </span>
      <span className="truncate text-slate-200 group-hover:text-cyan-200 transition-colors">{task.title}</span>
      <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium", statusStyles[task.status])}>{statusLabels[task.status]}</span>
      <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">{phaseLabel(task.phase)}</span>
      <span className="shrink-0 text-[11px] text-slate-500 ml-auto">{formatDate(task.updatedAt)}</span>
    </Link>
  );
}
