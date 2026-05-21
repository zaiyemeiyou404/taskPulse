import { NextResponse } from "next/server";
import { stopTask } from "@/lib/task-pulse/store";

type RouteProps = {
  params: Promise<{ taskId: string }>;
};

export async function POST(_: Request, { params }: RouteProps) {
  const { taskId } = await params;
  const snapshot = stopTask(taskId);
  if (!snapshot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(snapshot);
}
