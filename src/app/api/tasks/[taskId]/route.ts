import { NextResponse } from "next/server";
import { getTaskSnapshot } from "@/lib/task-pulse/store";

type RouteProps = {
  params: Promise<{ taskId: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  const { taskId } = await params;
  const snapshot = getTaskSnapshot(taskId);
  if (!snapshot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(snapshot);
}
