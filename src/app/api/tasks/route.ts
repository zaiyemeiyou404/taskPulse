import { NextResponse } from "next/server";
import { createTask, listTasks } from "@/lib/task-pulse/store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ tasks: listTasks() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { title?: string; prompt?: string; category?: string; runner?: string; model?: string; source?: string; mode?: "demo" | "live"; cwd?: string; groupName?: string; repoLink?: string; };
  const snapshot = createTask({
    title: body.title ?? "",
    prompt: body.prompt ?? "创建一个新的实时任务演示。",
    category: (body.category as "chat" | "ppt" | "paper" | "coding") ?? "coding",
    runner: body.runner,
    model: body.model,
    source: body.source,
    mode: body.mode,
    cwd: body.cwd,
    groupName: body.groupName,
    repoLink: body.repoLink,
  });
  return NextResponse.json(snapshot, { status: 201 });
}
