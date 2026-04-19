'use client';

import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { rootReducer } from './slice';
import { configSlice } from './slices/configSlice';

export const store = configureStore({
  reducer: {
    rootGlobal: rootReducer,
    config: configSlice.reducer,
  },
  devTools: process.env.NEXT_PUBLIC_ENV !== 'prod',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const GlobalStateProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => <Provider store={store}>{children}</Provider>;
