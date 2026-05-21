import { NextResponse } from "next/server";
import { deleteTask } from "@/lib/task-pulse/store";

type RouteProps = {
  params: Promise<{ taskId: string }>;
};

export async function POST(_: Request, { params }: RouteProps) {
  const { taskId } = await params;
  const ok = deleteTask(taskId);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deleted: true, taskId });
}
