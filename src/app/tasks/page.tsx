import { DashboardClient } from "@/components/task-pulse/dashboard-client";
import { TaskDashboard } from "@/components/task-pulse/dashboard";
import { ensureStoreBooted } from "@/lib/task-pulse/store";

export default function TasksPage() {
  ensureStoreBooted();
  return (
    <DashboardClient>
      <TaskDashboard />
    </DashboardClient>
  );
}
