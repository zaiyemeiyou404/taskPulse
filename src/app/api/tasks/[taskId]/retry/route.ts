import { NextResponse } from "next/server";
import { retryTask } from "@/lib/task-pulse/store";

type RouteProps = {
  params: Promise<{ taskId: string }>;
};

export async function POST(_: Request, { params }: RouteProps) {
  const { taskId } = await params;
  const snapshot = retryTask(taskId);
  if (!snapshot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(snapshot);
}
