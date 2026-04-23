# 前端实现思路

这个项目的前端建议按“流程编排控制台”来实现，而不是普通管理后台。后端已经提供了流程定义、执行、工具注册和执行记录相关接口，前端只要围绕 `Flow` DSL 做可视化编辑和调试即可。

## 1. 前端目标

前端的核心目标是让用户完成以下操作：

- 查看和管理流程定义
- 创建和编辑流程 DSL
- 校验流程结构是否正确
- 发布某个流程版本
- 直接执行流程并查看运行结果
- 查看执行历史和步骤明细
- 查看和刷新工具注册信息

## 2. 后端接口对应关系

前端主要对接以下接口：

- `GET /api/v1/orchestrator/definitions`
- `POST /api/v1/orchestrator/definitions`
- `GET /api/v1/orchestrator/definitions/:definitionId`
- `POST /api/v1/orchestrator/definitions/:definitionId/publish`
- `GET /api/v1/orchestrator/published/:flowId`
- `GET /api/v1/orchestrator/templates/default`
- `POST /api/v1/orchestrator/definitions/from-template`
- `POST /api/v1/orchestrator/flows/validate`
- `POST /api/v1/orchestrator/flows/execute`
- `GET /api/v1/orchestrator/executions`
- `GET /api/v1/orchestrator/executions/:executionId`
- `GET /api/v1/orchestrator/tools`
- `POST /api/v1/orchestrator/tools/refresh`

## 3. 页面结构建议

建议拆成 4 个核心页面：

### 3.1 流程列表页

用途：

- 展示所有流程定义
- 按 `flowId` 过滤
- 查看版本、状态、更新时间、发布人
- 进入编辑页或执行详情页

### 3.2 流程编辑页

这是最核心的页面，建议使用“画布 + 属性面板 + JSON 预览”的组合。

布局建议：

- 左侧：节点库
- 中间：画布
- 右侧：属性编辑器
- 底部或抽屉：DSL JSON 预览

支持能力：

- 拖拽节点
- 连线编辑
- 节点选择与配置
- 保存草稿
- 预校验
- 发布

### 3.3 执行调试页

用途：

- 输入执行参数
- 调用流程执行接口
- 展示执行结果
- 展示 trace、输入输出、报错信息

### 3.4 工具管理页

用途：

- 展示当前注册的工具列表
- 查看工具来源
- 手动刷新 MCP 工具

## 4. 推荐技术栈

如果你想快速落地，推荐：

- React
- Vite
- TypeScript
- Axios
- Zustand 或 Redux Toolkit
- React Flow
- Ant Design

如果你更习惯 Vue，也可以用 Vue 3 + Naive UI + Vue Flow，但基于当前 DSL 结构，React Flow 更直接。

## 5. 核心数据结构

前端最好直接按后端的 `Flow` 结构建模：

```ts
type Flow = {
  version: string
  id: string
  name: string
  input?: Record<string, any>
  nodes: Node[]
  edges: Edge[]
}
```

节点类型和后端保持一致：

- `start`
- `end`
- `set`
- `template`
- `condition`
- `tool`
- `confirm`
- `model`

## 6. 节点配置思路

建议把节点配置分成两层：

- 通用字段：`id`、`type`、`name`、`description`
- 类型字段：`config`

不同节点的 `config` 可做成单独表单。

### 6.1 tool 节点

常见字段：

- `toolId`
- `input`
- `output`

### 6.2 model 节点

常见字段：

- `prompt`
- `input`
- `output`
- `meta.model`
- `meta.temperature`

### 6.3 condition 节点

常见字段：

- `condition.op`
- `condition.left`
- `condition.right`

## 7. 实现顺序

建议按这个顺序做，最稳：

1. 先做 API 层封装
2. 再做流程列表页
3. 再做纯 JSON 编辑页
4. 再接画布可视化
5. 最后做执行调试和执行历史

## 8. 推荐目录结构

```text
src/
  api/
    orchestrator.ts
    tools.ts
  components/
    FlowCanvas/
    NodeForm/
    JsonEditor/
    ExecutionTrace/
  pages/
    FlowList/
    FlowEditor/
    FlowExecute/
    ToolRegistry/
  store/
    flowStore.ts
    toolStore.ts
  types/
    orchestrator.ts
```

## 9. 页面交互逻辑

### 9.1 新建流程

- 先拉取默认模板
- 用模板初始化 flow
- 用户修改后保存草稿

### 9.2 编辑流程

- 通过 `definitionId` 拉取流程定义
- 解析后端返回的 `dsl`
- 编辑后重新序列化为 JSON 提交

### 9.3 发布流程

- 调用发布接口
- 发布后刷新列表和详情

### 9.4 执行流程

- 如果是从定义执行，就传 `flowDefinitionId`
- 如果是临时调试，就直接提交当前 `Flow`
- 展示返回的 `trace` 和 `output`

### 9.5 查看执行记录

- 列出执行列表
- 点击进入详情页
- 展示 execution 主记录和 step 明细

## 10. 最关键的设计原则

前端最容易出问题的是画布状态和 JSON 状态不同步。建议遵循以下原则：

- 画布是编辑入口
- JSON 是最终真相
- 所有节点变更最终都落回 `Flow` 对象
- 保存前统一调用校验接口

这样最容易和后端 DSL 保持一致，也方便排错。

## 11. 建议的第一版 MVP

第一版不需要一次做完整可视化，建议先实现：

- 流程列表页
- 流程编辑页的 JSON 表单版
- 流程校验
- 流程保存
- 流程执行
- 执行详情页

等这些都跑通后，再把编辑页升级成画布模式。

## 12. 第二阶段实施计划（M2/M3/M4）

基于当前后端能力（`tool` 节点单 `skill`、全局 skill 仅 DB 管理、支持 skill reload），建议按以下里程碑推进。

### M2：React Flow 画布可拖拽编辑

目标：

- 将流程编辑主入口升级为可视化画布（React Flow）
- 画布操作与 DSL JSON 实时同步
- 支持拖拽节点、连线、节点配置编辑

实现要点：

1. 组件拆分
   - `FlowCanvas`: React Flow 容器，负责节点/边渲染与交互
   - `NodePalette`: 左侧节点库（start/end/set/template/condition/tool/confirm/model）
   - `NodePropertyPanel`: 右侧属性编辑（按节点类型渲染不同表单）
   - `FlowJsonPreview`: 底部 DSL JSON 预览（只读为主，可选编辑模式）

2. 状态模型（建议 Zustand）
   - `flowDraft`: 当前唯一真相（Flow DSL 对象）
   - `selectedNodeId`: 当前选中节点
   - `reactFlowNodes/reactFlowEdges`: 画布运行态（由 `flowDraft` 派生）
   - `dirty/lastValidated`: 编辑状态和校验状态

3. 双向映射
   - DSL -> React Flow：页面加载/切换版本时反序列化
   - React Flow -> DSL：拖拽、连线、删除、改名等事件统一回写 `flowDraft`

4. Tool 节点编辑（单 skill 模式）
   - `mode=skill`（推荐）：配置 `config.skill`
   - `mode=tool`（兼容）：配置 `toolId/server/tool/name`
   - 模式切换时互斥清理字段，避免 DSL 冲突

验收标准：

- 可在画布上完成 start -> tool -> end 的可运行 flow
- 刷新页面后可正确还原节点、连线和节点配置
- 调用 `validate` 返回错误时，能定位并高亮对应节点

---

### M3：Skill 管理页 + reload 联动

目标：

- 前端可直接管理 DB 中的 `orchestrator_skill_definition`
- skill 变更后可即时生效（reload）

实现要点：

1. 页面能力（`SkillRegistry`）
   - 列表：`skill_id/name/status/updated_at`
   - 新建 skill（结构化表单或 JSON 编辑）
   - 编辑 skill（禁止改 `skill.id`）
   - 启停 skill（enabled/disabled）
   - 手动 reload 按钮

2. API 对接
   - `GET /api/v1/orchestrator/skills`
   - `POST /api/v1/orchestrator/skills`
   - `PUT /api/v1/orchestrator/skills/:skillId`
   - `POST /api/v1/orchestrator/skills/:skillId/status`
   - `POST /api/v1/orchestrator/skills/reload`

3. 联动策略
   - skill 新建/更新/启停成功后：
     1) 调用 reload
     2) 刷新 skill 列表
     3) 通知流程编辑页更新 skill 下拉缓存

4. 错误处理
   - 若后端返回 `skill.id cannot be changed`，前端提示“skill ID 不可修改，请新建 skill”
   - 风控规则 condition 不合法等，直接展示后端 message

验收标准：

- 新建 skill 后，Flow 编辑页 `tool.config.skill` 下拉可立即选择
- 更新 skill 后执行结果即时体现变更
- 禁用 skill 后，流程执行表现符合后端规则（校验 warning / 执行报错）

---

### M4：执行调试/校验体验完善

目标：

- 建立“编辑 -> 校验 -> 执行 -> 排错”的完整闭环

实现要点：

1. 校验体验
   - 保存前默认调用 `POST /flows/validate`
   - 错误/告警分组展示
   - 点击错误可跳转画布并定位节点

2. 执行调试
   - 支持两种执行：
     - 按 `flowDefinitionId` 执行
     - 按当前 `flowDraft` 临时执行
   - 展示 `trace` 时间线：
     - `nodeId/nodeType/status/transition/error`
     - 每步 `input/output` 折叠查看

3. 结果可观测性
   - 展示 `output`、`variables`、`executionId`
   - 失败时提供“一键复制错误上下文”（节点+错误+关键输入）
   - 支持根据 `executionId` 跳转执行详情页

4. 用户效率优化
   - 快捷按钮：
     - 校验
     - 保存草稿
     - 校验并执行
   - Tool 节点显示已绑定 `skill`（便于排查映射/风控来源）

验收标准：

- 校验错误可在 1 次点击内定位到对应节点
- 执行失败可通过 trace 明确具体失败节点与错误原因
- 从执行结果可快速回到编辑页修复并重试

---

### M2/M3/M4 建议任务拆分（可直接用于排期）

1. M2-1：React Flow 画布骨架 + 节点库拖拽  
2. M2-2：节点/边与 DSL 双向同步  
3. M2-3：右侧属性编辑器（按节点类型）  
4. M2-4：Tool 节点 skill/tool 双模式编辑  
5. M2-5：画布校验定位（error/warning 高亮）  
6. M3-1：Skill 列表页与筛选  
7. M3-2：Skill 新建/编辑/启停  
8. M3-3：Skill reload 与编辑页缓存联动  
9. M4-1：执行调试面板（input/output/trace）  
10. M4-2：执行历史与详情联动  
11. M4-3：错误上下文复制与排障体验优化

## 13. 最新执行方案（对齐当前后端架构）

本节为当前版本的主执行方案，与既有章节并行，但实现优先级以本节为准。

### 13.1 基线与边界

- 执行架构：Temporal-only（父 workflow + 每节点 child workflow + node activity）
- AI 规划入口：`POST /api/v1/orchestrator/flows/plan`
- 规划返回结构：`PlanResult = { flow, validation }`（`validation` 来源于 LangGraph）
- 规划失败语义：
  - `400 + PlanResult`：语义失败（`validation.valid=false`，但通常有可用 `flow`）
  - `400 + {error,message}`：系统失败（planner 调用失败/解析失败）

### 13.2 目标闭环（产品主链路）

构建“AI 初稿 -> 人工修订 -> 执行观测 -> 回流重试”的稳定闭环：

1. 用户输入 `goal/context/constraints`
2. 前端调用 `flows/plan` 获取 `flow + validation`
3. 将 `flow` 应用到画布/JSON 编辑器
4. 保存草稿并发布
5. 触发执行并查看 trace
6. 基于错误定位回到节点修订并重试

### 13.3 API 对接矩阵（按能力分组）

#### A. 规划与编排

- `POST /api/v1/orchestrator/flows/plan`
- `POST /api/v1/orchestrator/flows/validate`（兜底校验）
- `POST /api/v1/orchestrator/flows/execute`

#### B. 定义管理

- `GET /api/v1/orchestrator/definitions`
- `POST /api/v1/orchestrator/definitions`
- `GET /api/v1/orchestrator/definitions/:definitionId`
- `POST /api/v1/orchestrator/definitions/:definitionId/publish`
- `GET /api/v1/orchestrator/templates/default`
- `POST /api/v1/orchestrator/definitions/from-template`

#### C. 执行观测

- `GET /api/v1/orchestrator/executions`
- `GET /api/v1/orchestrator/executions/:executionId`

#### D. Tool / Skill

- `GET /api/v1/orchestrator/tools`
- `POST /api/v1/orchestrator/tools/refresh`
- `GET /api/v1/orchestrator/skills`
- `POST /api/v1/orchestrator/skills`
- `PUT /api/v1/orchestrator/skills/:skillId`
- `POST /api/v1/orchestrator/skills/:skillId/status`
- `POST /api/v1/orchestrator/skills/reload`

### 13.4 前端类型与容错策略（建议直接落地）

```ts
type PlanInput = {
  goal: string
  context?: Record<string, any>
  constraints?: Record<string, any>
}

type PlanResult = {
  flow: Flow
  validation?: {
    valid?: boolean | string | number
    errors?: any[]
    warnings?: any[]
    [k: string]: any
  }
}
```

建议新增统一解析函数 `isValidationValid(raw): boolean`，对 `boolean/string/number` 做标准化，避免前后端语义偏差。

### 13.5 页面与交互变更（在现有编辑页增量）

在现有流程编辑页新增“AI 规划入口”（独立页或抽屉均可）：

- 输入区：`goal/context/constraints`
- 操作区：`生成 Flow`
- 结果区：
  - Flow 摘要（节点数、边数、关键节点）
  - Validation 摘要（`valid/errors/warnings`）
- 决策区：
  - `valid=true`：允许“应用到画布”
  - `valid=false`：展示错误，并提供“仍应用后手工修复 / 返回重试”

### 13.6 状态管理建议（Zustand）

新增状态：

- `planInput`
- `planResult`
- `planStatus`（idle/loading/success/error）
- `validationSource`（`langgraph` / `backend-validate`）

保留并强调：

- `flowDraft`：唯一真相（single source of truth）
- `reactFlowNodes/reactFlowEdges`：由 `flowDraft` 派生，不单独持久化
- `executionResult`、`trace`

### 13.7 实施排期（执行版）

#### M1（1~1.5 周）：AI 规划闭环 MVP

- 接入 `flows/plan`
- 新增计划输入面板
- 处理三类返回：`200` / `400+PlanResult` / `400+error`
- 一键应用 `flow` 到编辑器

验收：用户可从自然语言生成 flow 并进入编辑。

#### M2（1.5~2 周）：画布强一致

- 完善 React Flow 编辑能力
- DSL <-> 画布双向同步
- 规划结果差异高亮（新增/删除/修改节点与边）

验收：规划后可视化修订、保存、刷新后保持一致。

#### M3（1 周）：执行观测强化

- 执行调试面板
- trace 时间线（status/error/input/output）
- 失败定位并一跳返回编辑节点

验收：失败可在一次跳转内定位问题节点并重试。

#### M4（1 周）：Skill/Tool 联动

- Skill CRUD + status + reload
- Tool 节点 skill 绑定体验优化
- “校验并执行”快捷链路

验收：业务可独立维护 skill，并即时体现到执行链路。

### 13.8 联调与发布清单（必过）

1. `flows/plan` 三类场景联调：
   - `200 + valid=true`
   - `400 + valid=false + flow`
   - `400 + planner error`
2. 主链路联调：`plan -> apply -> save/publish -> execute -> trace`
3. 回归检查：
   - 手工编辑流程（不走 AI）能力不回退
   - 定义列表 / 执行详情 / 工具管理不回退

### 13.9 风险与规避

- 风险：LangGraph 返回 message 文本而非 flow JSON
  - 规避：明确提示“规划结果不可执行”，并保留原始响应用于排查
- 风险：`validation` 字段格式不稳定
  - 规避：统一 `isValidationValid` 解析策略（bool/string/number）
- 风险：画布与 JSON 状态不一致
  - 规避：坚持 `flowDraft` 为唯一真相，画布状态只做派生

## 14. 路线 B（彻底）：Studio 原生实施方案

本节适用于“完全按 LangGraph/LangSmith Studio 模式构建”，即前端主对象切到 LangGraph 原生模型，不再以 Flow DSL 作为编辑中心。

### 14.1 架构目标

- 前端主模型：`assistant / thread / run / state`
- 后端角色：LangGraph Studio API 网关（鉴权、转发、审计）
- 主运行链路：前端 -> `/api/v1/studio/*` -> LangGraph API
- 现有 `orchestrator` 接口保留兼容；新功能默认走 `studio` 接口

### 14.2 当前可用后端接口（已提供）

网关代理接口如下：

- `GET /api/v1/studio/info` -> `GET /info`
- `POST /api/v1/studio/assistants/search` -> `POST /assistants/search`
- `POST /api/v1/studio/runs/wait` -> `POST /runs/wait`
- `POST /api/v1/studio/threads/search` -> `POST /threads/search`

统一约定：

- 请求/响应按 LangGraph 原生对象透传（map/json）
- 网关失败返回 `502 + {error,message}`，否则透传上游 HTTP 状态

### 14.3 前端信息架构（Studio 模式）

建议页面：

1. `Assistants`：助手列表、检索、默认 assistant 选择
2. `StudioRun`：输入区 + 运行区（run/wait）+ 结果区
3. `Threads`：线程检索与历史 run 浏览
4. `RunInspector`：run 详情、状态、输出、错误

说明：Flow 画布在 Route B 不再是必选项，后续可补“Graph 只读视图”作为辅助。

### 14.4 前端类型建议（LangGraph 原生）

```ts
type StudioAssistant = {
  assistant_id: string
  graph_id: string
  name?: string
  metadata?: Record<string, any>
}

type StudioRunWaitRequest = {
  assistant_id: string
  input: Record<string, any>
  metadata?: Record<string, any>
  on_completion?: 'delete' | 'keep'
}

type StudioRunWaitResponse = Record<string, any>
```

### 14.5 API 与 Store 落地项

在 `src/api/studio.ts` 新增：

- `getStudioInfo()`
- `searchAssistants(payload)`
- `runWait(payload)`
- `searchThreads(payload)`

在 store 新增：

- `studioStore.assistants`
- `studioStore.selectedAssistantId`
- `studioStore.lastRunRequest`
- `studioStore.lastRunResponse`
- `studioStore.threads`

### 14.6 分阶段排期（Route B）

#### B1（3~5 天）：Studio 网关联调

- 接 `/studio/info`、`/studio/assistants/search`
- 实现 assistant 选择器
- 跑通最小 `run/wait`

验收：前端可选择 assistant 并成功执行一次 run。

#### B2（1 周）：Run/Thread 工作台

- Run 请求表单（JSON 输入）
- 结果面板（JSON Viewer + 错误提示）
- Thread 检索与历史展示

验收：可复盘最近线程与执行结果。

#### B3（1 周）：体验对齐 LangSmith Studio

- 左侧对象导航（assistants/threads）
- 中间运行工作区
- 右侧 inspector（run metadata/errors/timing）

验收：交互路径接近 Studio，可支撑业务日常调试。

### 14.7 与 Route A（DSL）关系

- Route B 主线：Studio 原生对象优先
- Route A（DSL）定位：兼容历史流程资产
- 前端建议显式分区：
  - `Studio Console`（新主线）
  - `Legacy Flow Console`（兼容入口）

目的：在迁移期避免认知混乱，保障新旧路径可并行演进。

### 14.8 Runnable 节点配置规范（Studio Graph Playground）

为保证前端画布与后端 LangGraph 执行器一致，`runnable` 节点统一使用如下配置约定（放在节点 `data.config`）。

#### A. 通用字段（所有 runnable 建议包含）

```json
{
  "kind": "tool | template | model | confirm",
  "node_key": "unique_node_key",
  "enabled": true,
  "timeout_ms": 10000,
  "retry": 1
}
```

#### B. tool 节点（调用外部工具/服务）

```json
{
  "kind": "tool",
  "node_key": "load_driver_detail",
  "tool_name": "load_driver_detail",
  "input_mapping": {
    "driver_id": "$.selected_driver_id"
  },
  "output_key": "driver_detail",
  "timeout_ms": 10000,
  "retry": 1
}
```

#### C. template 节点（轻量数据加工）

```json
{
  "kind": "template",
  "node_key": "extract_driver_count",
  "template_key": "extract_driver_count",
  "input_mapping": {
    "driver_list": "$.driver_list"
  },
  "output_key": "driver_count"
}
```

#### D. model 节点（LLM 推理）

```json
{
  "kind": "model",
  "node_key": "llm_analysis",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "prompt_template": "基于司机详情做分析：{{driver_detail}}",
  "input_mapping": {
    "driver_detail": "$.driver_detail"
  },
  "output_key": "analysis",
  "temperature": 0.2,
  "max_tokens": 800,
  "timeout_ms": 20000
}
```

#### E. confirm 节点（条件分支）

```json
{
  "kind": "confirm",
  "node_key": "confirm_continue",
  "expression": "$.driver_count > 0",
  "true_label": "true",
  "false_label": "false"
}
```

约束：

- `confirm` 节点必须存在 `true/false` 两条分支边。
- `__start__` 不能有入边，`__end__` 不能有出边。
- 前后端统一 `kind/tool_name/input_mapping/output_key` 字段语义，避免“画布可配但执行器不识别”。

#### F. 运行期注入约定（前端 -> LangGraph）

当用户点击“注入画布并运行”时，前端在 `metadata` 中注入：

```json
{
  "execution_source": "graph_draft",
  "graph_draft_version": "flow/v1",
  "graph_draft": {
    "nodes": [],
    "edges": []
  }
}
```

后端可按需选择：

- 仅记录（观测用途）
- 按草稿执行（实验模式）
- 对比已发布 graph 与草稿差异（审计模式）

