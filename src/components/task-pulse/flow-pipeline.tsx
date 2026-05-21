"use client";

import { TaskCategory, TaskSnapshot } from "@/lib/task-pulse/types";
import { cn, taskFlows } from "@/lib/task-pulse/utils";

function getFlowProgress(snapshot: TaskSnapshot) {
  const { status, phase, progressPercent } = snapshot.task;
  const flow = taskFlows[snapshot.task.category as TaskCategory] ?? taskFlows.coding;
  const steps = flow.steps;

  // Map task progress to flow step completion
  // Each step represents ~25% of the flow
  const stepProgress = Math.min(Math.floor(progressPercent / 25), steps.length);
  const isTerminal = status === "done" || status === "failed";

  return steps.map((step, i) => {
    if (status === "failed" && i === steps.length - 1) return "failed" as const;
    if (isTerminal && status === "done") return "completed" as const;
    if (i < stepProgress) return "completed" as const;
    if (i === stepProgress || (status === "running" && phase !== "completed")) return "current" as const;
    return "pending" as const;
  });
}

export function TaskFlowPipeline({ snapshot }: { snapshot: TaskSnapshot }) {
  const flow = taskFlows[snapshot.task.category as TaskCategory] ?? taskFlows.coding;
  const stepStatuses = getFlowProgress(snapshot);

  return (
    <div className="rounded-[26px] border border-white/10 bg-white/5 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{flow.name}</h2>
        <p className="mt-1 text-sm text-slate-400">任务执行管线 — 类似 n8n 工作流视图</p>
      </div>

      {/* Pipeline visualization */}
      <div className="flex items-center gap-0 overflow-x-auto py-4">
        {flow.steps.map((step, i) => {
          const status = stepStatuses[i];
          const isLast = i === flow.steps.length - 1;

          return (
            <div key={step.key} className="flex items-center">
              {/* Node */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-2xl border-2 text-2xl shadow-lg transition-all",
                    status === "completed" && "border-emerald-400/50 bg-emerald-400/15 shadow-emerald-400/20",
                    status === "current" && "animate-pulse border-cyan-400/50 bg-cyan-400/20 shadow-cyan-400/30",
                    status === "failed" && "border-rose-400/50 bg-rose-400/15 shadow-rose-400/20",
                    status === "pending" && "border-slate-600/30 bg-slate-800/10 opacity-50"
                  )}
                >
                  <span className={cn(
                    status === "pending" && "grayscale opacity-60"
                  )}>{step.icon}</span>
                </div>
                <div className="text-center">
                  <div
                    className={cn(
                      "text-sm font-medium",
                      status === "completed" && "text-emerald-200",
                      status === "current" && "text-cyan-200",
                      status === "failed" && "text-rose-200",
                      status === "pending" && "text-slate-500"
                    )}
                  >
                    {step.label}
                  </div>
                  <div
                    className={cn(
                      "mt-1 h-2 w-2 rounded-full mx-auto",
                      status === "completed" && "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
                      status === "current" && "bg-cyan-400 animate-pulse shadow-[0_0_12px_rgba(61,217,197,0.8)]",
                      status === "failed" && "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]",
                      status === "pending" && "bg-slate-600"
                    )}
                  />
                </div>
              </div>

              {/* Connector */}
              {!isLast && (
                <div className="mx-2 flex flex-col items-center gap-1">
                  {/* Arrow line with status color */}
                  <div className="flex items-center">
                    <div
                      className={cn(
                        "h-[3px] w-12 rounded-full",
                        status === "completed" && "bg-gradient-to-r from-emerald-400 to-emerald-500",
                        status === "current" && "bg-gradient-to-r from-cyan-400 to-slate-600",
                        status === "failed" && "bg-gradient-to-r from-rose-400 to-slate-600",
                        status === "pending" && "bg-slate-700"
                      )}
                    />
                    <div
                      className={cn(
                        "ml-0 h-0 w-0 border-l-[8px] border-y-[5px] border-y-transparent",
                        status === "completed" && "border-l-emerald-400",
                        status === "current" && "border-l-cyan-400",
                        status === "failed" && "border-l-rose-400",
                        status === "pending" && "border-l-slate-600"
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-white/10 pt-4">
        <LegendItem color="bg-emerald-400" label="已完成" />
        <LegendItem color="bg-cyan-400 animate-pulse" label="进行中" />
        <LegendItem color="bg-slate-600" label="未完成" />
        <LegendItem color="bg-rose-400" label="失败" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span className={cn("h-2.5 w-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.4)]", color)} />
      {label}
    </div>
  );
}
