import { notFound } from "next/navigation";
import { TaskDetailClient } from "@/components/task-pulse/task-detail-client";
import { getTaskSnapshot } from "@/lib/task-pulse/store";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ taskId: string }>;
};

export default async function TaskDetailPage({ params }: PageProps) {
  const { taskId } = await params;
  const snapshot = getTaskSnapshot(taskId);
  if (!snapshot) notFound();
  return <TaskDetailClient initialSnapshot={snapshot} />;
}
