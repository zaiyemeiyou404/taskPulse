# 每日凌晨自检 — 任务审查

## 概述

task-pulse 每天北京时间凌晨 5:00 自动执行一次全量任务审查，通过微信推送日报。

## 配置

### Cron Job

```yaml
name: task-pulse-daily-check
schedule: "0 5 * * *"     # 每天 UTC 21:00 / 北京时间 5:00
deliver: origin             # 推送到微信
model: gpt-5.4
provider: openai-codex
```

### 创建/更新方式

通过 Hermes Agent 的 `cronjob` 工具：

```
cronjob(action="update", job_id="xxx", model={"model":"gpt-5.4","provider":"openai-codex"})
```

### ⚠️ 必须设 model

创建 cron job 时**必须显式设置 model 和 provider**，否则 openai-codex 会报错：

```
RuntimeError: Codex Responses request 'model' must be a non-empty string.
```

## 审查内容

### 1. 分组名审查
检测：
- "项目开发"、"默认"、"其他" 等无辨识度名称 → **「需改名」**
- 只含 1 个任务但又可合并的分组 → **「建议合并」**
- 命名风格不一致 → **「命名不一致」**

### 2. 分类整理检查
检测：
- category 为空或 null → **「缺少分类」**
- category 与标题不符 → **「分类疑似错误」**
- 可合并的重复任务 → **「建议合并」**

### 3. 状态异常检查
- `blocked` → ⚠️ 阻塞
- `approval_required` → 👆 待审批
- `running` 超 1 小时 → ⏱ 运行超时
- `failed` → ❌ 失败

## 日报输出格式

### 有异常时

```
📋 每日任务状态 (凌晨5点)

### 分组名审查
✅ task-Pluse 完善 — 正常
⚠️ "杂项" — 建议合并

### 分类整理建议
⚠️ task_xxx "XX" — 缺少分类

### 各分组概况
📁 task-Pluse 完善 (N个) — ⚠️ 1个阻塞
...

### 异常任务
- task_xxx「标题」— ⚠️ 阻塞
```

### 一切正常

```
✅ 今日一切正常。N个任务，N个分组，无异常。
```

## 注意事项

- Cron job 只做「报告」不做自动修复
- 如要手动触发：`hermes cron run <job_id>`
- 如要查看现有配置：`hermes cron list`
