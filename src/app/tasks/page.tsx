import { DashboardClient } from "@/components/task-pulse/dashboard-client";
import { TaskDashboard } from "@/components/task-pulse/dashboard";
import { ensureStoreBooted } from "@/lib/task-pulse/store";

export const dynamic = "force-dynamic";

export default function TasksPage() {
  ensureStoreBooted();
  return (
    <DashboardClient>
      <TaskDashboard />
    </DashboardClient>
  );
}
