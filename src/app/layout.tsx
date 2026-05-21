import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Task Pulse - AI 任务驾驶舱",
  description: "Hermes / OpenCode / DeepSeek 实时 AI 任务监控驾驶舱。查看任务状态、阶段、事件流、日志与产物。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
