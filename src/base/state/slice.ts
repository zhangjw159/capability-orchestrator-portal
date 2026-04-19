import { createSlice } from '@reduxjs/toolkit';
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { cloneDeep, get, set } from 'lodash';

const rootSlice = createSlice({
  name: 'rootGlobal',
  initialState: {} as Record<string, unknown>,
  reducers: {},
});

const rootReducer = (state: Record<string, unknown> = {}, action: any) => {
  const { type, payload } = action;
  if (type?.startsWith('rootGlobal.')) {
    const path = type.replace('rootGlobal.', '');
    const newState = cloneDeep(state);
    set(newState, path, payload);
    return newState;
  }
  return state;
};

export { rootReducer };

export const useGlobalState = <T>(path: string, initialData?: T) => {
  const dispatch = useDispatch();
  const state: T = useSelector((s) => get(s, `rootGlobal.${path}`));
  const update = useCallback(
    (value: T) => {
      dispatch({ type: `rootGlobal.${path}`, payload: value });
    },
    [dispatch, path]
  );
  return { state, update };
};
