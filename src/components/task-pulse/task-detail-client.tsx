"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Bell, Bot, Clock3, Copy, ExternalLink, FileDown, FileJson2, FolderGit2, PauseCircle, PlayCircle, Sparkles, SquareTerminal, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { TaskFlowPipeline } from "@/components/task-pulse/flow-pipeline";
import { TaskSnapshot } from "@/lib/task-pulse/types";
import { artifactActionExternal, artifactActionHref, artifactActionLabel, artifactDisplayPath, artifactFileDownloadUrl, cn, formatDateTime, formatDuration, formatRelative, generateCodingReleaseNotes, getTaskQuickLinks, phaseLabel, summarizeTaskActions } from "@/lib/task-pulse/utils";

const phaseOrder = ["queued", "triaging", "accepted", "booting_runner", "coding", "testing", "summarizing", "waiting_review", "completed", "failed"] as const;
const tabs = ["概览", "产物", "文件", "通知", "原始JSON"] as const;
type TabKey = (typeof tabs)[number];

const statusLabels: Record<string, string> = {
  queued: "排队中",
  running: "运行中",
  blocked: "已阻塞",
  done: "已完成",
  failed: "已失败",
  stopped: "已停止",
};

export function TaskDetailClient({ initialSnapshot }: { initialSnapshot: TaskSnapshot }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [activeTab, setActiveTab] = useState<TabKey>("概览");
  const [autoScroll, setAutoScroll] = useState(true);
  const [statusText, setStatusText] = useState("实时更新已连接");

  useEffect(() => {
    const source = new EventSource(`/api/tasks/${initialSnapshot.task.id}/stream`);
    source.addEventListener("task.snapshot", (event) => {
      setSnapshot(JSON.parse((event as MessageEvent).data));
      setStatusText("实时更新已连接");
    });
    source.addEventListener("task.updated", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as TaskSnapshot;
      setSnapshot(payload);
    });
    source.addEventListener("heartbeat", () => setStatusText("实时更新已连接"));
    source.onerror = () => setStatusText("重连中...");
    return () => source.close();
  }, [initialSnapshot.task.id]);

  const currentPhaseIndex = phaseOrder.indexOf(snapshot.task.phase as (typeof phaseOrder)[number]);
  const rawJson = useMemo(() => JSON.stringify(snapshot, null, 2), [snapshot]);
  const touchedFiles = useMemo(() => {
    const fromEvents = snapshot.events.find((event) => event.type === "files.changed")?.payload?.files;
    return Array.isArray(fromEvents) ? fromEvents : ["src/app/tasks/page.tsx", "src/app/tasks/[taskId]/page.tsx", "src/components/task-pulse/task-detail-client.tsx"];
  }, [snapshot.events]);

  async function postAction(action: "stop" | "retry") {
    const response = await fetch(`/api/tasks/${snapshot.task.id}/${action}`, { method: "POST" });
    const data = (await response.json()) as TaskSnapshot;
    setSnapshot(data);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:px-10">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(124,140,255,0.14),rgba(10,12,18,0.96),rgba(61,217,197,0.08))] p-8 shadow-[0_20px_80px_rgba(5,8,15,0.55)] backdrop-blur-xl">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(61,217,197,0.8)]" />
              {statusText}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{snapshot.task.title}</h1>
                <StatusPill status={snapshot.task.status} />
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">{snapshot.task.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                <Pill>{snapshot.task.id}</Pill>
                <Pill>{snapshot.task.runner}</Pill>
                <Pill>{snapshot.task.model}</Pill>
                <Pill>{snapshot.task.source}</Pill>
              </div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-black/15 p-4 text-sm text-slate-300">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">当前进度</div>
              <div className="mt-2 text-lg font-medium text-white">{snapshot.task.progressText}</div>
              <div className="mt-4 h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-[linear-gradient(90deg,#7C8CFF,#3DD9C5)] shadow-[0_0_20px_rgba(61,217,197,0.4)]" style={{ width: `${snapshot.task.progressPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="grid w-full max-w-xl grid-cols-2 gap-3 lg:grid-cols-3">
            <MetricCard label="阶段" value={phaseLabel(snapshot.task.phase)} icon={Sparkles} />
            <MetricCard label="耗时" value={formatDuration(snapshot.task.durationMs)} icon={Clock3} />
            <MetricCard label="最近更新" value={<>{formatRelative(snapshot.task.updatedAt)}<br /><span className="text-xs font-normal text-slate-500">{formatDateTime(snapshot.task.updatedAt)}</span></>} icon={Activity} />
            <MetricCard label="事件" value={String(snapshot.events.length)} icon={FileJson2} />
            <MetricCard label="日志" value={String(snapshot.logs.length)} icon={SquareTerminal} />
            <MetricCard label="通知" value={String(snapshot.notifications.length)} icon={Bell} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <ActionButton icon={Copy} label="复制ID" onClick={() => navigator.clipboard.writeText(snapshot.task.id)} />
          <ActionButton icon={PauseCircle} label="停止" onClick={() => postAction("stop")} />
          <ActionButton icon={PlayCircle} label="重试" onClick={() => postAction("retry")} />
          <ActionButton icon={Trash2} label="删除任务" onClick={async () => {
            if (!confirm("确定要删除这个任务吗？此操作不可撤销。")) return;
            await fetch(`/api/tasks/${snapshot.task.id}/delete`, { method: "POST" });
            router.push("/tasks");
            router.refresh();
          }} />
        </div>
      </section>

      {/* ---- 快速入口 / Quick links ---- */}
      {(() => {
        const links = getTaskQuickLinks(snapshot);
        if (links.length === 0) return null;
        return (
          <section className="rounded-[26px] border border-white/10 bg-white/5 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">快速入口</h2>
              <span className="text-xs text-slate-500">Quick Links</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {links.map((link, i) => (
                <a
                  key={i}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-cyan-200 transition hover:bg-white/10 hover:text-cyan-100"
                >
                  {link.label}
                  {link.external ? <ExternalLink className="h-3 w-3" /> : null}
                </a>
              ))}
            </div>
          </section>
        );
      })()}

      {/* ---- 通俗易懂的总结 ---- */}
      <section className="rounded-[26px] border border-white/10 bg-white/5 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-white">任务摘要</h2>
        <p className="mt-1 text-sm text-slate-400">一眼看懂这个任务现在在干嘛。</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">这个任务现在在干嘛？</div>
            <p className="mt-2 text-sm text-white">{snapshot.task.progressText}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">是否完成？</div>
            {snapshot.task.status === "done" ? (
              <p className="mt-2 text-sm text-emerald-300">已完成，任务顺利结束。</p>
            ) : snapshot.task.status === "failed" ? (
              <p className="mt-2 text-sm text-rose-300">已失败，执行中遇到了问题。</p>
            ) : snapshot.task.status === "stopped" ? (
              <p className="mt-2 text-sm text-slate-300">已停止，被人为中断。</p>
            ) : snapshot.task.status === "blocked" ? (
              <p className="mt-2 text-sm text-amber-300">卡住了，需要你来处理。</p>
            ) : snapshot.task.status === "running" ? (
              <p className="mt-2 text-sm text-cyan-200">正在执行中，尚未完成。</p>
            ) : (
              <p className="mt-2 text-sm text-slate-300">排队等待执行。</p>
            )}
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">要不要我处理？</div>
            {snapshot.task.needsHuman ? (
              <p className="mt-2 text-sm text-amber-300">需要你关注，请查看日志并决定下一步操作。</p>
            ) : (
              <p className="mt-2 text-sm text-emerald-300">不需要，任务正在自动执行中。</p>
            )}
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">下一步看哪里？</div>
            <p className="mt-2 text-sm text-slate-300">看下方的 <strong className="text-white">阶段时间线</strong> 了解进度，<strong className="text-white">事件流</strong> 了解每步操作，<strong className="text-white">产物</strong> 标签看最终产出。</p>
          </div>
        </div>
      </section>

      {/* ---- 功能更新（coding 任务专属） ---- */}
      {snapshot.task.category === "coding" && (() => {
        const notes = generateCodingReleaseNotes(snapshot);
        if (!notes) return null;
        return (
          <section className="rounded-[26px] border border-emerald-300/15 bg-emerald-400/5 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-emerald-200">功能更新</h2>
            <p className="mt-1 text-sm text-slate-400">这次改了什么 — 类似 GitHub Release Notes 的变更摘要。</p>
            <MarkdownPanel markdown={notes} className="mt-4 border-emerald-300/10 bg-black/20 text-slate-200" />
          </section>
        );
      })()}

      {/* ---- 这个任务都干了什么 ---- */}
      <section className="rounded-[26px] border border-white/10 bg-white/5 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-white">这个任务都干了什么</h2>
        <p className="mt-1 text-sm text-slate-400">基于事件流、日志、产物自动生成的执行摘要。</p>
        <div className="mt-4 rounded-2xl border border-white/8 bg-black/15 p-5 text-sm leading-7 text-slate-200">
          {summarizeTaskActions(snapshot)}
        </div>
      </section>

      {/* Flow Pipeline - n8n style */}
      <TaskFlowPipeline snapshot={snapshot} />

      <section className="rounded-[26px] border border-white/10 bg-white/5 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">阶段时间线</h2>
            <p className="text-sm text-slate-400">当前执行阶段与生命周期进程。</p>
          </div>
          <div className="text-sm text-slate-400">开始于 {formatDateTime(snapshot.task.startedAt)}</div>
        </div>
        <div className="grid gap-3 md:grid-cols-5 xl:grid-cols-10">
          {phaseOrder.map((phase, index) => {
            const active = index === currentPhaseIndex;
            const completed = index < currentPhaseIndex || snapshot.task.phase === "completed";
            return (
              <div key={phase} className={cn("rounded-2xl border px-3 py-4 text-center", active ? "border-cyan-300/30 bg-cyan-400/10" : completed ? "border-emerald-300/20 bg-emerald-400/10" : "border-white/10 bg-black/10") }>
                <div className={cn("mx-auto mb-2 h-3 w-3 rounded-full", active ? "animate-pulse bg-cyan-300 shadow-[0_0_18px_rgba(61,217,197,0.9)]" : completed ? "bg-emerald-300" : "bg-slate-600")} />
                <div className="text-xs font-medium text-white">{phaseLabel(phase)}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[26px] border border-white/10 bg-white/5 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">事件流</h2>
              <p className="text-sm text-slate-400">Agent 正在执行的语义化时间线。</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{snapshot.events.length} 个事件</div>
          </div>
          <div className="space-y-3">
            {snapshot.events.map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", levelDot(event.level))} />
                      <span className="font-medium text-white">{event.message}</span>
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{event.type}</div>
                  </div>
                  <div className="text-xs text-slate-500">{formatRelative(event.createdAt)}</div>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-white/6 bg-[#090C12] p-3 text-xs text-slate-400">{JSON.stringify(event.payload, null, 2)}</pre>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[26px] border border-white/10 bg-white/5 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">实时日志</h2>
              <p className="text-sm text-slate-400">原始 stdout / stderr / system 流。</p>
            </div>
            <button onClick={() => setAutoScroll((value) => !value)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              {autoScroll ? "自动滚动 开" : "自动滚动 关"}
            </button>
          </div>
          <div className="max-h-[620px] overflow-y-auto rounded-[22px] border border-white/8 bg-[#090C12] p-4 font-mono text-[12px] leading-6 text-slate-300">
            {snapshot.logs.map((log) => (
              <div key={log.id} className="grid grid-cols-[92px_68px_1fr] gap-3 border-b border-white/5 py-2 last:border-b-0">
                <span className="text-slate-500">{formatDateTime(log.createdAt)}</span>
                <span className={cn("text-xs uppercase", streamTone(log.stream, log.level))}>{log.stream}</span>
                <span>{log.content}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[26px] border border-white/10 bg-white/5 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={cn("rounded-full px-4 py-2 text-sm transition", activeTab === tab ? "bg-white text-slate-950" : "border border-white/10 bg-white/5 text-slate-300")}>{tab}</button>
          ))}
        </div>
        <div className="mt-5 rounded-[22px] border border-white/8 bg-black/15 p-5">
          {activeTab === "概览" && (
            <div className="grid gap-4 md:grid-cols-2">
              <InfoCard icon={Bot} title="目标" text={snapshot.task.prompt} />
              <InfoCard icon={Sparkles} title="当前摘要" text={snapshot.task.summary} />
              <InfoCard icon={Activity} title="进度" text={`${snapshot.task.progressPercent}% · ${snapshot.task.progressText}`} />
              <InfoCard icon={Clock3} title="时间" text={`开始 ${formatDateTime(snapshot.task.startedAt)} · 修改 ${formatDateTime(snapshot.task.updatedAt)}`} />
            </div>
          )}
          {activeTab === "产物" && (
            <div className="grid gap-3">
              {snapshot.artifacts.length === 0 ? <EmptyState label="暂无产物" /> : snapshot.artifacts.map((artifact) => {
                const href = artifactActionHref(artifact);
                const label = artifactActionLabel(artifact);
                const external = artifactActionExternal(artifact);
                const downloadHref = artifactFileDownloadUrl(artifact);
                return (
                  <div key={artifact.id} className="rounded-2xl border border-white/8 bg-[#0A0E15] px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-medium text-white">{artifact.name}</div>
                        <div className="truncate text-sm text-slate-400">{artifact.kind} · {formatDateTime(artifact.createdAt)}</div>
                        <div className="mt-1 truncate text-xs text-slate-500">{artifactDisplayPath(artifact)}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {href && (
                          <a
                            href={href}
                            target={external ? "_blank" : undefined}
                            rel={external ? "noopener noreferrer" : undefined}
                            className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3.5 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/20"
                          >
                            {external ? <ExternalLink className="h-3.5 w-3.5" /> : null}
                            {label}
                          </a>
                        )}
                        {downloadHref && (
                          <a
                            href={downloadHref}
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            下载
                          </a>
                        )}
                        {!href && !downloadHref && (
                          <span className="text-xs text-slate-500">内联</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {activeTab === "文件" && (
            <div className="grid gap-3">
              {touchedFiles.map((file) => (
                <div key={String(file)} className="flex items-center justify-between rounded-2xl border border-white/8 bg-[#0A0E15] px-4 py-3">
                  <div className="inline-flex items-center gap-3 text-white"><FolderGit2 className="h-4 w-4 text-cyan-200" />{String(file)}</div>
                  <span className="rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">已修改</span>
                </div>
              ))}
            </div>
          )}
          {activeTab === "通知" && (
            <div className="grid gap-3">
              {snapshot.notifications.length === 0 ? <EmptyState label="暂无通知" /> : snapshot.notifications.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/8 bg-[#0A0E15] px-4 py-3">
                  <div>
                    <div className="font-medium text-white">{item.eventType}</div>
                    <div className="text-sm text-slate-400">{item.channel} → {item.target}</div>
                  </div>
                  <div className="text-sm text-cyan-200">{item.status} · {formatRelative(item.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
          {activeTab === "原始JSON" && (
            <pre className="overflow-x-auto rounded-2xl border border-white/8 bg-[#090C12] p-4 text-xs leading-6 text-slate-300">{rawJson}</pre>
          )}
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
      <div className="flex items-center gap-2 text-sm text-slate-400"><Icon className="h-4 w-4" />{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: "bg-slate-500/15 text-slate-200 border-slate-300/10",
    running: "bg-cyan-400/15 text-cyan-200 border-cyan-300/10",
    blocked: "bg-amber-400/15 text-amber-200 border-amber-300/10",
    done: "bg-emerald-400/15 text-emerald-200 border-emerald-300/10",
    failed: "bg-rose-400/15 text-rose-200 border-rose-300/10",
    stopped: "bg-slate-500/15 text-slate-200 border-slate-300/10",
  };
  return <span className={cn("rounded-full border px-3 py-1 text-sm font-medium", styles[status])}>{statusLabels[status] ?? status}</span>;
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{children}</span>;
}

function ActionButton({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"><Icon className="h-4 w-4" />{label}</button>;
}

function MarkdownPanel({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <div className={cn("rounded-2xl border p-5", className)}>
      <div className="space-y-3 text-sm leading-7 text-slate-200">
        <ReactMarkdown
          components={{
            h1: ({ node, ...props }) => <h1 className="text-xl font-semibold text-white" {...props} />,
            h2: ({ node, ...props }) => <h2 className="text-lg font-semibold text-white" {...props} />,
            h3: ({ node, ...props }) => <h3 className="text-base font-semibold text-white" {...props} />,
            p: ({ node, ...props }) => <p className="text-sm leading-7 text-slate-200" {...props} />,
            ul: ({ node, ...props }) => <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200" {...props} />,
            ol: ({ node, ...props }) => <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-200" {...props} />,
            li: ({ node, ...props }) => <li className="leading-7" {...props} />,
            code: ({ node, className: codeClassName, children, ...props }) => {
              const inline = !codeClassName;
              if (inline) {
                return <code className="rounded bg-white/10 px-1.5 py-0.5 text-[0.9em] text-cyan-100" {...props}>{children}</code>;
              }
              return <code className={cn("block overflow-x-auto rounded-xl border border-white/10 bg-[#090C12] p-4 text-[13px] text-slate-200", codeClassName)} {...props}>{children}</code>;
            },
            pre: ({ node, ...props }) => <pre className="my-3 overflow-x-auto" {...props} />,
            strong: ({ node, ...props }) => <strong className="font-semibold text-white" {...props} />,
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#0A0E15] p-4">
      <div className="flex items-center gap-2 text-sm text-slate-400"><Icon className="h-4 w-4" />{title}</div>
      <div className="mt-2 text-sm leading-7 text-white">{text}</div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">{label}</div>;
}

function levelDot(level: string) {
  if (level === "success") return "bg-emerald-300";
  if (level === "warning") return "bg-amber-300";
  if (level === "error") return "bg-rose-300";
  return "bg-cyan-300";
}

function streamTone(stream: string, level: string) {
  if (stream === "stderr" || level === "error") return "text-rose-300";
  if (level === "warning") return "text-amber-300";
  if (level === "success") return "text-emerald-300";
  if (stream === "system") return "text-cyan-300";
  return "text-slate-400";
}
