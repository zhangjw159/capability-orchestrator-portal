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

