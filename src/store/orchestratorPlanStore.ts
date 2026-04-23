import { create } from 'zustand';

import type { PlanInput, PlanResult } from '@/types/orchestrator';

type PlanStatus = 'idle' | 'loading' | 'success' | 'error';
type ValidationSource = 'langgraph' | 'backend-validate';

type OrchestratorPlanState = {
  planInput: PlanInput;
  planResult: PlanResult | null;
  planStatus: PlanStatus;
  validationSource: ValidationSource;
  planErrorText: string;
  planRawResponse: unknown;
  setPlanInput: (patch: Partial<PlanInput>) => void;
  setPlanResult: (result: PlanResult | null) => void;
  setPlanStatus: (status: PlanStatus) => void;
  setValidationSource: (source: ValidationSource) => void;
  setPlanErrorText: (text: string) => void;
  setPlanRawResponse: (raw: unknown) => void;
  resetPlanState: () => void;
};

const initialPlanInput: PlanInput = {
  goal: '',
  context: {},
  constraints: {},
};

export const useOrchestratorPlanStore = create<OrchestratorPlanState>(
  (set) => ({
    planInput: initialPlanInput,
    planResult: null,
    planStatus: 'idle',
    validationSource: 'langgraph',
    planErrorText: '',
    planRawResponse: null,
    setPlanInput: (patch) =>
      set((state) => ({
        planInput: {
          ...state.planInput,
          ...patch,
        },
      })),
    setPlanResult: (result) => set({ planResult: result }),
    setPlanStatus: (status) => set({ planStatus: status }),
    setValidationSource: (source) => set({ validationSource: source }),
    setPlanErrorText: (text) => set({ planErrorText: text }),
    setPlanRawResponse: (raw) => set({ planRawResponse: raw }),
    resetPlanState: () =>
      set({
        planInput: initialPlanInput,
        planResult: null,
        planStatus: 'idle',
        validationSource: 'langgraph',
        planErrorText: '',
        planRawResponse: null,
      }),
  })
);
