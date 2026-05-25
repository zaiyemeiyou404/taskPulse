import { describe, it, expect, beforeEach } from "vitest";
import {
  ensureStoreBooted,
  createTask,
  listTasks,
  getTaskSnapshot,
  stopTask,
  retryTask,
  deleteTask,
  approveTask,
  listGroups,
  getGroupWithTasks,
} from "../store";

describe("store", () => {
  beforeEach(() => {
    ensureStoreBooted();
  });

  it("lists at least 4 initial tasks", () => {
    const tasks = listTasks();
    expect(tasks.length).toBeGreaterThanOrEqual(4);
    const ids = tasks.map((t) => t.id);
    const demoIds = ["task_demo_live", "task_blocked_approval", "task_done_metrics", "task_approval_cmd"];
    const hasAny = demoIds.some((id) => ids.includes(id));
    expect(hasAny).toBe(true);
    expect(tasks[0].title).toBeTruthy();
    expect(tasks[0].category).toBeTruthy();
  });

  it("gets a task snapshot by ID", () => {
    const tasks = listTasks();
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    const snap = getTaskSnapshot(tasks[0].id);
    expect(snap).not.toBeNull();
    expect(snap!.task.id).toBe(tasks[0].id);
    expect(snap!.task.title).toBeTruthy();
  });

  it("creates a new task", () => {
    const result = createTask({
      title: "Test Creation",
      prompt: "Run a test task",
      category: "coding",
      runner: "opencode",
      mode: "demo",
    });
    expect(result).not.toBeNull();
    expect(result!.task.id).toMatch(/^task_/);
    expect(result!.task.status).toBe("queued");
    expect(result!.task.category).toBe("coding");
    expect(result!.task.runner).toBe("opencode");
  });

  it("creates a task with custom group name", () => {
    const result = createTask({
      title: "Grouped Task",
      prompt: "Test grouping",
      category: "chat",
      runner: "hermes",
      groupName: "我的项目",
      mode: "demo",
    });
    expect(result).not.toBeNull();
    expect(result!.task.groupId).toContain("group_");
    expect(result!.task.metadata.groupName).toBe("我的项目");
  });

  it("stops a running task", () => {
    const result = createTask({ title: "To Stop", prompt: "Will be stopped", category: "coding", runner: "opencode", mode: "demo" });
    expect(result).not.toBeNull();
    const taskId = result!.task.id;
    const stopped = stopTask(taskId);
    expect(stopped).not.toBeNull();
    expect(stopped!.task.status).toBe("stopped");
  });

  it("retries a task", () => {
    const task = createTask({ title: "To Retry", prompt: "Will be retried", category: "coding", runner: "opencode", mode: "demo" });
    expect(task).not.toBeNull();
    const taskId = task!.task.id;
    stopTask(taskId);
    const retried = retryTask(taskId);
    expect(retried).not.toBeNull();
    expect(retried!.task.status).toBe("queued");
  });

  it("deletes a task", () => {
    const result = createTask({ title: "To Delete", prompt: "Will be deleted", category: "coding", runner: "opencode", mode: "demo" });
    expect(result).not.toBeNull();
    const taskId = result!.task.id;
    const deleted = deleteTask(taskId);
    expect(deleted).toBe(true);
    expect(getTaskSnapshot(taskId)).toBeNull();
  });

  it("approves a task", () => {
    const result = createTask({ title: "Approve Test", prompt: "test approval flow", category: "coding", runner: "opencode", mode: "demo" });
    expect(result).not.toBeNull();
    const taskId = result!.task.id;

    const approvedSnap = approveTask(taskId);
    expect(approvedSnap).not.toBeNull();
    expect(approvedSnap!.task.status).toBe("running");
    expect(approvedSnap!.task.needsHuman).toBe(false);
  });

  it("lists groups", () => {
    const groups = listGroups();
    expect(groups.length).toBeGreaterThanOrEqual(1);
    for (const g of groups) {
      expect(g.id).toMatch(/^group_/);
      expect(g.childTaskIds.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("gets group with tasks", () => {
    const groups = listGroups();
    if (groups.length > 0) {
      const gid = groups[0].id;
      const result = getGroupWithTasks(gid);
      expect(result).not.toBeNull();
      expect(result!.group.id).toBe(gid);
      expect(result!.tasks.length).toBeGreaterThanOrEqual(1);
    }
  });
});
