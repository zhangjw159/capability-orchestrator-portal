import type { Flow } from '@/types/orchestrator';

export function buildDriverListValidateSkillDefinition() {
  return {
    id: 'driver_list_validate',
    name: 'driver.list.validate',
    status: 'enabled',
    executor: { type: 'validate' },
    tool: {},
    runtimePolicy: {
      timeoutMs: 5000,
      retry: 0,
      maxConcurrency: 50,
    },
    meta: {
      validate: {
        rules: [
          {
            id: 'api_success',
            expr: 'input.ok == true && input.result.parsed.code == 0',
            message: '工具调用失败或业务 code 非 0',
          },
          {
            id: 'page_count_non_negative',
            expr: 'input.result.parsed.data.page_count >= 0',
            message: 'page_count 非法（应 >= 0）',
          },
          {
            id: 'total_list_consistent',
            expr: '!(input.result.parsed.data.total > 0 && len(input.result.parsed.data.lists) == 0)',
            message: 'total 与 lists 不一致',
          },
        ],
      },
    },
  } as Record<string, unknown>;
}

export function buildDriverListQualityGateFlow(): Flow {
  return {
    version: 'flow/v1',
    id: 'driver_list_quality_gate_flow',
    name: 'driver.list quality gate flow',
    input: {
      body: {
        page_size: 1,
        page_number: 10,
        search_value: '',
      },
    },
    nodes: [
      { id: 'start_1', type: 'start', name: '开始', config: {} },
      {
        id: 'tool_driver_list',
        type: 'tool',
        name: '调用 driver_list',
        config: {
          mode: 'skill',
          skillId: 'driver_list',
          skill: 'driver_list',
          input: '{{.input}}',
          output: 'driver_list_result',
        },
      },
      {
        id: 'cond_has_data',
        type: 'condition',
        name: '有数据？',
        config: {
          condition: {
            op: 'gt',
            left: '$.tool_driver_list.result.parsed.data.total',
            right: 0,
          },
        },
      },
      {
        id: 'tool_validate_driver_list',
        type: 'tool',
        name: '校验返回质量',
        config: {
          mode: 'skill',
          skillId: 'driver_list_validate',
          skill: 'driver_list_validate',
          input: {
            ok: true,
            result: '{{index .input "driver_list_result"}}',
          },
          output: 'validate_result',
        },
      },
      { id: 'end_success', type: 'end', name: '成功有数据', config: {} },
      { id: 'end_no_data', type: 'end', name: '成功无数据', config: {} },
      { id: 'end_bad_data', type: 'end', name: '脏数据', config: {} },
    ],
    edges: [
      { id: 'e1', from: 'start_1', to: 'tool_driver_list' },
      { id: 'e2', from: 'tool_driver_list', to: 'cond_has_data' },
      { id: 'e3', from: 'cond_has_data', to: 'end_no_data', label: 'false' },
      { id: 'e4', from: 'cond_has_data', to: 'tool_validate_driver_list', label: 'true' },
      { id: 'e5', from: 'tool_validate_driver_list', to: 'end_success', label: 'true' },
      { id: 'e6', from: 'tool_validate_driver_list', to: 'end_bad_data', label: 'false', default: true },
    ],
  };
}
