"use client";

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";

export function DashboardClient({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function DashboardDeleteButton({ taskId }: { taskId: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("确定要删除这个任务吗？此操作不可撤销。")) return;
    await fetch(`/api/tasks/${taskId}/delete`, { method: "POST" });
    router.refresh();
  }

  return (
    <button onClick={handleDelete} className="inline-flex items-center gap-1 rounded-full border border-rose-300/15 bg-rose-400/10 px-2.5 py-1 text-xs text-rose-200 hover:bg-rose-400/20 transition" title="删除任务">
      <Trash2 className="h-3 w-3" />
    </button>
  );
}

export function DashboardApproveButton({ taskId }: { taskId: string }) {
  const router = useRouter();

  async function handleApprove() {
    await fetch(`/api/tasks/${taskId}/approve`, { method: "POST" });
    router.refresh();
  }

  return (
    <button onClick={handleApprove} className="inline-flex items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-400/20 transition" title="批准命令/权限请求">
      <Check className="h-3 w-3" />
      批准
    </button>
  );
}
