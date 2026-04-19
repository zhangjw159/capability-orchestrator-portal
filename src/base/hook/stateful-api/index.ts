'use client';

import { v4 as uuidv4 } from 'uuid';
import { ACCESS_TOKEN } from '@/base/constant/auth';
import { getStatefulApiHeaders, setStatefulApiHeaders } from '@/base/state/api';

export const getApiHeader = (): Record<string, string | number> => {
  const headerAuthKey = 'authorization';
  const headers = getStatefulApiHeaders() || {};
  let tempHeaders: Record<string, string | number> = { ...headers } as Record<
    string,
    string | number
  >;

  if (!tempHeaders[headerAuthKey] && typeof localStorage !== 'undefined') {
    const token = localStorage.getItem(ACCESS_TOKEN);
    if (token) {
      tempHeaders = {
        ...tempHeaders,
        [headerAuthKey]: `Bearer ${token}`,
      };
      setStatefulApiHeaders(tempHeaders as unknown as Record<string, unknown>);
    }
  }

  tempHeaders = {
    ...tempHeaders,
    'Trace-ID': uuidv4(),
  };
  return tempHeaders;
};
