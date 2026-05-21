import { getTaskSnapshot, getTaskVersion } from "@/lib/task-pulse/store";

type RouteProps = {
  params: Promise<{ taskId: string }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const { taskId } = await params;
  const encoder = new TextEncoder();
  const initial = getTaskSnapshot(taskId);

  if (!initial) {
    return new Response("Not found", { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      let currentVersion = getTaskVersion(taskId);
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      send("task.snapshot", initial);

      const interval = setInterval(() => {
        const nextVersion = getTaskVersion(taskId);
        const snapshot = getTaskSnapshot(taskId);
        if (!snapshot) return;
        if (nextVersion !== currentVersion) {
          currentVersion = nextVersion;
          send("task.updated", snapshot);
        } else {
          send("heartbeat", { ts: new Date().toISOString() });
        }
      }, 1000);

      const close = () => {
        clearInterval(interval);
        controller.close();
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
