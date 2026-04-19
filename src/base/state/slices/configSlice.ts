import { createSlice } from '@reduxjs/toolkit';

export interface ConfigDataItem {
  id: string;
  name: string;
  value: string | number | boolean;
}

export interface ConfigData {
  [key: string]: ConfigDataItem[];
}

export interface ConfigState {
  data: ConfigData | null;
  isLoading: boolean;
  error: Error | null;
}

const initialState: ConfigState = {
  data: null,
  isLoading: false,
  error: null,
};

export const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    getConfigStart: (state) => {
      state.isLoading = true;
    },
    getConfigSuccess: (state, action) => {
      state.data = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    getConfigFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },
  },
});

export const { getConfigStart, getConfigSuccess, getConfigFailure } =
  configSlice.actions;
