export type StudioAssistant = {
  assistant_id: string;
  graph_id: string;
  name?: string;
  metadata?: Record<string, unknown>;
};

export type StudioAssistantCreatePayload = {
  graph_id: string;
  name?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type StudioRunWaitRequest = {
  assistant_id: string;
  input: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  command?: Record<string, unknown>;
  on_completion?: 'delete' | 'keep';
  interrupt_before?: '*' | string[];
  interrupt_after?: '*' | string[];
  [key: string]: unknown;
};

export type StudioRunWaitResponse = Record<string, unknown>;

export type StudioThread = Record<string, unknown>;

export type StudioThreadCreatePayload = {
  thread_id?: string;
  metadata?: Record<string, unknown>;
  if_exists?: 'raise' | 'do_nothing';
  [key: string]: unknown;
};

export type StudioRunRecord = {
  id: string;
  createdAt: string;
  assistantId: string;
  request: StudioRunWaitRequest;
  response: StudioRunWaitResponse;
};
