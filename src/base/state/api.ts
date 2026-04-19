import { get, set } from 'lodash';

export const setStatefulApiHeaders = (headers: Record<string, unknown>) => {
  set(globalThis, 'statefulApi.headers', headers);
};

export const getStatefulApiHeaders = (): Record<string, unknown> | undefined => {
  return get(globalThis, 'statefulApi.headers');
};
