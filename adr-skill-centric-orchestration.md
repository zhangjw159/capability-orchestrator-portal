# ADR: Skill-Centric Orchestration Architecture

## Status

Proposed

## Date

2026-04-24

## Context

当前系统存在两条能力线：

1. LangGraph Studio（assistant/thread/run），偏调试与交互；
2. Flow + Temporal + MCP Tools，偏生产编排与执行。

主要问题：

- 业务能力与底层工具耦合过深；
- 编排主模型不统一（assistant/thread/run 与 flow 并存）；
- AI 规划和生产执行职责边界不清。

## Decision

采用 Skill-Centric 架构，Flow + Temporal 为核心执行主链路。

### Core Runtime

Flow Definition -> Temporal -> Node Workflow -> Skill Executor

### Layering

- MCP Tool：底层连接器和接口；
- Skill：可治理的业务能力抽象；
- Flow：Skill 组合与控制流；
- Temporal：可靠执行编排。

### LangGraph Role (Sidecar)

LangGraph 不作为核心执行引擎，定位为：

- AI Planner
- Flow Generator
- Skill Recommender

标准链路：
自然语言需求 -> LangGraph 生成 Flow 草稿 -> 后端 validate -> 人工确认 -> 保存发布 -> Temporal 执行。

## Consequences

### Positive

- 主模型统一，团队心智负担更低；
- Skill 可治理（版本、权限、SLA、审计）；
- 工具替换不影响 Flow 定义；
- AI 能力可插拔，不入侵执行主链路。

### Trade-offs

- 需要建设 Skill Registry 与 Skill Executor；
- 需要迁移历史 tool 直连配置；
- 需要统一错误模型和执行上下文。

## Scope

### P0

- 保留 Flow + Temporal 主链路；
- 引入 Skill Registry（MCP Tool -> Skill 抽象）；
- 打通 NL -> Draft -> Validate -> Human Confirm。

### P1

- 收敛产品概念为 Flow Studio、Run Console、Skill Center；
- 降低 assistant/thread/run 作为主模型的权重。

## Non-Goals

- P0 不做全量历史流程迁移；
- P0 不下线 LangGraph Studio（仅定位为旁路能力）。

## Success Metrics

- 新增流程以 Skill 编排为默认；
- 关键流程执行成功率和延迟不劣于基线；
- 生产问题可通过 traceId 和 skillId 追踪到具体调用。
