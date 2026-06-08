import { NextResponse } from "next/server";
import { listTasks } from "@/lib/task-pulse/store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ tasks: listTasks() });
}

export async function POST() {
  return NextResponse.json(
    { error: "Forbidden", message: "网页端任务创建已禁用，只保留只读监控" },
    { status: 403 },
  );
}
