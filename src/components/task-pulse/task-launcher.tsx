"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bot, Code2, Loader2, MessageSquare, PenLine, Play, Presentation, WandSparkles } from "lucide-react";
import { categoryInfo } from "@/lib/task-pulse/utils";
import { TaskCategory } from "@/lib/task-pulse/types";

const runners = [
  { key: "opencode", label: "OpenCode", desc: "代码生成专用", icon: Code2 },
  { key: "hermes", label: "Hermes", desc: "通用 Agent", icon: Bot },
] as const;

export function TaskLauncher() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [runner, setRunner] = useState<string>("opencode");
  const [category, setCategory] = useState<TaskCategory>("coding");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function launchTask() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          prompt: prompt || "执行新任务。",
          runner,
          category,
          model: "deepseek/deepseek-chat",
          source: "控制台",
          mode: "live",
          cwd: "/home/ubuntu/task-pulse",
        }),
      });
      if (!response.ok) {
        throw new Error(`启动失败: ${response.status}`);
      }
      const snapshot = await response.json() as { task: { id: string } };
      router.push(`/tasks/${snapshot.task.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "启动失败");
    } finally {
      setSubmitting(false);
    }
  }

  const categories: TaskCategory[] = ["chat", "ppt", "paper", "coding"];
  const catIcons: Record<TaskCategory, string> = {
    chat: "💬", ppt: "📊", paper: "📝", coding: "💻",
  };

  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(61,217,197,0.08),rgba(255,255,255,0.03),rgba(124,140,255,0.10))] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">启动 AI Agent 任务</h2>
          <p className="mt-1 text-sm text-slate-400">选择 Agent、任务类型，填写描述，直接在详情页看实时事件流与日志。</p>
        </div>
        <div className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">在线执行器</div>
      </div>

      {/* Runner selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {runners.map((r) => (
          <button
            key={r.key}
            onClick={() => setRunner(r.key)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
              runner === r.key
                ? "bg-white text-slate-950 border-white"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            <r.icon className="h-4 w-4" />
            {r.label}
          </button>
        ))}
      </div>

      {/* Category selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
              category === cat
                ? categoryInfo[cat].color + " border-current"
                : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <span>{catIcons[cat]}</span>
            {categoryInfo[cat].label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <label className="grid gap-2 text-sm text-slate-300">
          <span>任务标题</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white outline-none transition focus:border-cyan-300/25"
            placeholder={`输入${categoryInfo[category].label}任务标题`}
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-300">
          <span>任务描述</span>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="min-h-[120px] rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white outline-none transition focus:border-cyan-300/25"
            placeholder={`描述 ${runner === "hermes" ? "Hermes" : "OpenCode"} 需要执行的内容`}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={launchTask}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {submitting ? "启动中..." : `启动 ${runner === "hermes" ? "Hermes" : "OpenCode"} 任务`}
        </button>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
          <WandSparkles className="h-4 w-4 text-cyan-200" />
          模型: deepseek/deepseek-chat
        </div>
        {error ? <div className="text-sm text-rose-300">{error}</div> : null}
      </div>
    </section>
  );
}
