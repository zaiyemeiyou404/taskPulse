import { NextResponse } from "next/server";
import { getTaskSnapshot, updateTaskGroup } from "@/lib/task-pulse/store";
import { TaskCategory } from "@/lib/task-pulse/types";

type RouteProps = {
  params: Promise<{ taskId: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  const { taskId } = await params;
  const snapshot = getTaskSnapshot(taskId);
  if (!snapshot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(snapshot);
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const { taskId } = await params;
  const body = (await request.json()) as { groupName?: string; category?: TaskCategory };
  const snapshot = updateTaskGroup(taskId, body.groupName, body.category);
  if (!snapshot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(snapshot);
}
