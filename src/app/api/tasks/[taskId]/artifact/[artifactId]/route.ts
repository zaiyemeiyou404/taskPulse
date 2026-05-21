import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getTaskSnapshot } from "@/lib/task-pulse/store";

const APP_ROUTE_RE = /^\/(?:api|tasks)\b/;
const HTTP_URL_RE = /^https?:\/\//i;

type RouteProps = {
  params: Promise<{ taskId: string; artifactId: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  const { taskId, artifactId } = await params;
  const snapshot = getTaskSnapshot(taskId);
  if (!snapshot) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const artifact = snapshot.artifacts.find((a) => a.id === artifactId);
  if (!artifact) return NextResponse.json({ error: "Artifact not found" }, { status: 404 });

  const filePath = artifact.path;
  if (!filePath) return NextResponse.json({ error: "Artifact has no file path" }, { status: 400 });
  if (APP_ROUTE_RE.test(filePath)) return NextResponse.json({ error: "Cannot serve app routes" }, { status: 400 });
  if (HTTP_URL_RE.test(filePath)) return NextResponse.json({ error: "Cannot serve remote URLs" }, { status: 400 });

  const resolved = path.resolve(filePath);
  if (!existsSync(resolved)) return NextResponse.json({ error: "File not found on disk" }, { status: 404 });

  const buf = await readFile(resolved);
  const filename = path.basename(resolved);

  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Content-Length": String(buf.byteLength),
    },
  });
}
