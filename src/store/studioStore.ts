import { create } from 'zustand';

import type {
  StudioAssistant,
  StudioRunRecord,
  StudioRunWaitRequest,
  StudioRunWaitResponse,
  StudioThread,
} from '@/types/studio';

type StudioState = {
  assistants: StudioAssistant[];
  selectedAssistantId?: string;
  lastRunRequest?: StudioRunWaitRequest;
  lastRunResponse?: StudioRunWaitResponse;
  runHistory: StudioRunRecord[];
  selectedRunId?: string;
  threads: StudioThread[];
  setAssistants: (assistants: StudioAssistant[]) => void;
  setSelectedAssistantId: (assistantId?: string) => void;
  setLastRunRequest: (request?: StudioRunWaitRequest) => void;
  setLastRunResponse: (response?: StudioRunWaitResponse) => void;
  addRunRecord: (
    request: StudioRunWaitRequest,
    response: StudioRunWaitResponse
  ) => StudioRunRecord;
  setSelectedRunId: (id?: string) => void;
  setThreads: (threads: StudioThread[]) => void;
};

export const useStudioStore = create<StudioState>((set) => ({
  assistants: [],
  selectedAssistantId: undefined,
  lastRunRequest: undefined,
  lastRunResponse: undefined,
  runHistory: [],
  selectedRunId: undefined,
  threads: [],
  setAssistants: (assistants) => set({ assistants }),
  setSelectedAssistantId: (selectedAssistantId) => set({ selectedAssistantId }),
  setLastRunRequest: (lastRunRequest) => set({ lastRunRequest }),
  setLastRunResponse: (lastRunResponse) => set({ lastRunResponse }),
  addRunRecord: (request, response) => {
    const id = String(
      response.run_id ??
        response.id ??
        response.execution_id ??
        `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
    const record: StudioRunRecord = {
      id,
      createdAt: new Date().toISOString(),
      assistantId: request.assistant_id,
      request,
      response,
    };
    set((state) => ({
      runHistory: [record, ...state.runHistory].slice(0, 30),
      selectedRunId: record.id,
    }));
    return record;
  },
  setSelectedRunId: (selectedRunId) => set({ selectedRunId }),
  setThreads: (threads) => set({ threads }),
}));
