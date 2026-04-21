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

