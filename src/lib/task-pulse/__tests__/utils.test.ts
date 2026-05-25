import { describe, it, expect } from "vitest";
import {
  cn,
  formatDuration,
  phaseLabel,
  statusLabel,
  inferTitle,
  inferGroupId,
  inferGroupName,
  inferRepoLink,
  summarizeTaskActions,
  generateCodingReleaseNotes,
  extractChatTrace,
} from "../utils";
import type { TaskSnapshot } from "../types";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("filters falsy values", () => {
    expect(cn("a", false, "b", null, undefined, "c")).toBe("a b c");
  });

  it("returns empty string for no args", () => {
    expect(cn()).toBe("");
  });
});

describe("formatDuration", () => {
  it("formats seconds", () => {
    expect(formatDuration(5000)).toBe("5s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(125000)).toBe("2m 5s");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3660000)).toBe("1h 1m");
  });
});

describe("phaseLabel", () => {
  it("returns Chinese labels for known phases", () => {
    expect(phaseLabel("queued")).toBe("排队中");
    expect(phaseLabel("coding")).toBe("正在改代码");
    expect(phaseLabel("completed")).toBe("已完成");
  });

  it("returns phase string for unknown phases", () => {
    expect(phaseLabel("unknown")).toBe("unknown");
  });
});

describe("statusLabel", () => {
  it("returns Chinese labels for known statuses", () => {
    expect(statusLabel("running")).toBe("执行中");
    expect(statusLabel("done")).toBe("已完成");
    expect(statusLabel("approval_required")).toBe("待命令同意");
  });
});

describe("inferTitle", () => {
  it("uses runner label for short prompts", () => {
    const title = inferTitle("hi", "chat", "hermes");
    expect(title).toContain("Hermes");
    expect(title).toContain("聊天");
  });

  it("extracts Chinese sentence from prompt", () => {
    const title = inferTitle("帮我创建一个新的仪表盘组件", "coding", "opencode");
    expect(title).toContain("帮我创建一个新的仪表盘");
  });

  it("truncates long titles", () => {
    const long = "这是一段非常长的中文文本，远远超过三十个字符的标题长度限制";
    const title = inferTitle(long, "chat", "opencode");
    expect(title.length).toBeLessThanOrEqual(31);
  });
});

describe("inferGroupId", () => {
  it("generates consistent group ID from category", () => {
    const id = inferGroupId("coding");
    expect(id).toContain("group_");
  });

  it("includes repo link in seed", () => {
    const id = inferGroupId("coding", undefined, "https://github.com/user/repo");
    expect(id).toContain("repo");
  });
});

describe("inferGroupName", () => {
  it("uses AUTO_GROUP_MAP for known categories", () => {
    expect(inferGroupName("coding")).toBe("项目开发");
    expect(inferGroupName("chat")).toBe("日常聊天");
  });

  it("uses custom name when provided", () => {
    expect(inferGroupName("coding", "我的项目")).toBe("我的项目");
  });
});

describe("inferRepoLink", () => {
  it("extracts github URL from prompt", () => {
    const link = inferRepoLink("check https://github.com/user/repo for details");
    expect(link).toBe("https://github.com/user/repo");
  });

  it("returns undefined when no repo link in prompt", () => {
    expect(inferRepoLink("just a normal prompt")).toBeUndefined();
  });
});

describe("summarizeTaskActions", () => {
  function makeSnapshot(overrides: Partial<TaskSnapshot> = {}): TaskSnapshot {
    return {
      task: {
        id: "test",
        title: "Test Task",
        prompt: "Test prompt",
        status: "running",
        phase: "coding",
        category: "coding",
        runner: "opencode",
        model: "test-model",
        source: "test",
        summary: "",
        progressText: "Working...",
        needsHuman: false,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        endedAt: null,
        durationMs: 1000,
        eventCount: 0,
        logCount: 0,
        notificationCount: 0,
        progressPercent: 50,
        metadata: {},
        groupId: "group_test",
      },
      events: [],
      logs: [],
      artifacts: [],
      notifications: [],
      version: 0,
      ...overrides,
    };
  }

  it("returns queued message for queued tasks", () => {
    const snap = makeSnapshot({ task: { ...makeSnapshot().task, status: "queued" } });
    const result = summarizeTaskActions(snap);
    expect(result).toContain("排队等待执行");
  });

  it("includes file change count when events exist", () => {
    const snap = makeSnapshot({
      events: [{ type: "files.changed", level: "success", message: "Changed files", payload: { files: ["a.ts", "b.ts"] }, id: "e1", taskId: "test", createdAt: new Date().toISOString() }],
    });
    const result = summarizeTaskActions(snap);
    expect(result).toContain("修改");
  });
});

describe("generateCodingReleaseNotes", () => {
  function makeCodingSnapshot(overrides: Partial<TaskSnapshot> = {}): TaskSnapshot {
    return {
      task: {
        id: "test",
        title: "Test Feature",
        prompt: "Test prompt",
        status: "done",
        phase: "completed",
        category: "coding",
        runner: "opencode",
        model: "test-model",
        source: "test",
        summary: "Test summary for release",
        progressText: "Done",
        needsHuman: false,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: 5000,
        eventCount: 3,
        logCount: 2,
        notificationCount: 1,
        progressPercent: 100,
        metadata: {},
        groupId: "group_test",
      },
      events: [
        { id: "e1", taskId: "test", type: "files.changed", level: "success", message: "Updated files", payload: { files: ["src/app.ts", "src/utils.ts"] }, createdAt: new Date().toISOString() },
        { id: "e2", taskId: "test", type: "opencode.tool", level: "info", message: "Used write", payload: { tool: "write" }, createdAt: new Date().toISOString() },
      ],
      logs: [
        { id: "l1", taskId: "test", stream: "system", level: "success", content: "All tests passed successfully", createdAt: new Date().toISOString() },
      ],
      artifacts: [
        { id: "a1", taskId: "test", name: "release.zip", kind: "bundle", path: "/tmp/release.zip", createdAt: new Date().toISOString() },
      ],
      notifications: [],
      version: 0,
      ...overrides,
    };
  }

  it("returns empty string for non-coding tasks", () => {
    const snap = makeCodingSnapshot();
    snap.task.category = "chat";
    expect(generateCodingReleaseNotes(snap)).toBe("");
  });

  it("includes file changes in release notes", () => {
    const notes = generateCodingReleaseNotes(makeCodingSnapshot());
    expect(notes).toContain("src/app.ts");
    expect(notes).toContain("src/utils.ts");
  });

  it("includes success messages", () => {
    const notes = generateCodingReleaseNotes(makeCodingSnapshot());
    expect(notes).toContain("Updated files");
  });

  it("includes artifacts", () => {
    const notes = generateCodingReleaseNotes(makeCodingSnapshot());
    expect(notes).toContain("release.zip");
  });

  it("includes tools used", () => {
    const notes = generateCodingReleaseNotes(makeCodingSnapshot());
    expect(notes).toContain("write");
  });
});

describe("extractChatTrace", () => {
  function makeChatSnapshot(overrides: Partial<TaskSnapshot> = {}): TaskSnapshot {
    return {
      task: {
        id: "chat_test",
        title: "Chat Task",
        prompt: "帮我写一个 Python 脚本",
        status: "done",
        phase: "completed",
        category: "chat",
        runner: "hermes",
        model: "test-model",
        source: "weixin",
        summary: "Completed the chat request",
        progressText: "Done",
        needsHuman: false,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: 30000,
        eventCount: 4,
        logCount: 2,
        notificationCount: 1,
        progressPercent: 100,
        metadata: {},
        groupId: "group_chat",
      },
      events: [
        { id: "e1", taskId: "chat_test", type: "task.created", level: "info", message: "Task created", payload: {}, createdAt: new Date().toISOString() },
        { id: "e2", taskId: "chat_test", type: "triage.completed", level: "success", message: "Triage completed", payload: {}, createdAt: new Date().toISOString() },
        { id: "e3", taskId: "chat_test", type: "task.completed", level: "success", message: "Task completed", payload: {}, createdAt: new Date().toISOString() },
      ],
      logs: [
        { id: "l1", taskId: "chat_test", stream: "stdout", level: "info", content: "Script written", createdAt: new Date().toISOString() },
      ],
      artifacts: [],
      notifications: [],
      version: 0,
      ...overrides,
    };
  }

  it("returns empty array for non-chat tasks", () => {
    const snap = makeChatSnapshot();
    snap.task.category = "coding";
    expect(extractChatTrace(snap)).toEqual([]);
  });

  it("includes user request from task.created event", () => {
    const trace = extractChatTrace(makeChatSnapshot());
    expect(trace.some((t) => t.type === "user_request")).toBe(true);
  });

  it("includes analysis decisions", () => {
    const trace = extractChatTrace(makeChatSnapshot());
    expect(trace.some((t) => t.type === "analysis_decision")).toBe(true);
  });

  it("includes execution results", () => {
    const trace = extractChatTrace(makeChatSnapshot());
    expect(trace.some((t) => t.type === "execution_result")).toBe(true);
  });
});
