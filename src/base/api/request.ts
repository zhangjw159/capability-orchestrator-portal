import { notification } from 'antd';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { ACCESS_TOKEN } from '@/base/constant/auth';
import { getApiHeader } from '@/base/hook/stateful-api';
import { setStatefulApiHeaders } from '@/base/state/api';

type Result<T> = {
  data: T;
  code: number;
  message: string;
  result: T;
};

type CustomAxiosRequestConfig = AxiosRequestConfig & {
  returnData?: boolean;
  hideErrorTip?: boolean;
  requestId?: string;
  cancelPrevious?: boolean;
};

const BASE_API_URL =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_BASE_API_URL) || '';

export class Request {
  private activeAbortControllers: Map<string, AbortController[]> = new Map();
  instance: AxiosInstance;
  baseConfig: AxiosRequestConfig = {
    baseURL: BASE_API_URL || '/',
    timeout: 60000,
  };

  constructor(config: CustomAxiosRequestConfig) {
    this.instance = axios.create({ ...this.baseConfig, ...config });

    this.instance.interceptors.request.use(
      (config: any) => {
        const requestId = config.requestId || uuidv4();
        const url = config.url || '';
        if (config.cancelPrevious) {
          let existing = this.activeAbortControllers.get(url);
          if (!existing) {
            existing = [];
            this.activeAbortControllers.set(url, existing);
          }
          existing.forEach((c) => c.abort());
          const controller = new AbortController();
          existing.push(controller);
          config.signal = controller.signal;
        }
        const header = getApiHeader();
        config.headers = { ...config.headers, ...header };
        return { ...config, requestId };
      },
      (err) => Promise.reject(err)
    );

    this.instance.interceptors.response.use(
      (res: AxiosResponse) => {
        this.handleRequestId(res.config as CustomAxiosRequestConfig);
        if (res.config.responseType === 'blob') return res;
        if (res?.data?.code === 7 || res?.status === 401) {
          notification.error({
            message: 'Error',
            description: res?.data?.message || 'Token is expired',
          });
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(ACCESS_TOKEN);
          }
          setStatefulApiHeaders({});
          if (typeof window !== 'undefined') window.location.href = '/login';
          return Promise.reject('Login has expired');
        }
        if ((res.config as CustomAxiosRequestConfig).returnData) {
          const payload = res.data;
          const isEnvelope =
            payload &&
            typeof payload === 'object' &&
            !Array.isArray(payload) &&
            'code' in payload;

          if (isEnvelope) {
            const code = (payload as { code: number }).code;
            if (code === 0 || code === 200) {
              return (payload as { data?: unknown }).data;
            }
            const message = (payload as { message?: string }).message;
            if ((res.config as CustomAxiosRequestConfig).hideErrorTip)
              return Promise.reject(message);
            notification.error({ message: 'Error', description: message });
            return Promise.reject(message);
          }

          // 无 { code, data } 包装时直接返回业务 JSON（如 { tools: [] }）
          return payload;
        }
        return res.data;
      },
      (err) => {
        this.handleRequestId(err?.config as CustomAxiosRequestConfig);
        if (err?.code === 'ERR_CANCELED') return Promise.reject(err?.response);
        const message = this.getErrorMessage(err);
        notification.error({ message: 'Error', description: message });
        return Promise.reject(err?.response);
      }
    );
  }

  private handleRequestId(config?: CustomAxiosRequestConfig) {
    const url = config?.url || '';
    if (!url) return;
    const list = this.activeAbortControllers.get(url);
    if (!list) return;
    const rest = list.filter((c) => !c.signal.aborted);
    if (rest.length) this.activeAbortControllers.set(url, rest);
    else this.activeAbortControllers.delete(url);
  }

  private getErrorMessage(err: any): string {
    const status = err?.response?.status;
    const map: Record<number, string> = {
      400: err?.response?.data?.message || 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      408: 'Request Timeout',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };
    return map[status] || `Request error ${status ?? ''}`;
  }

  public request<T>(config: CustomAxiosRequestConfig) {
    return this.instance.request<any, T>(config);
  }

  public get<T>(
    url: string,
    data?: any,
    config?: CustomAxiosRequestConfig
  ): Promise<T | Result<T>> {
    return this.instance
      .get(url, { params: data ?? {}, ...config })
      .then((res) =>
        res && typeof res === 'object' && 'code' in res && 'message' in res
          ? (res as unknown as Result<T>)
          : (res as T)
      );
  }

  public post<T>(
    url: string,
    data?: any,
    config?: CustomAxiosRequestConfig,
    responseType?: 'json' | 'text' | 'arraybuffer' | 'stream' | 'blob'
  ): Promise<T | Result<T>> {
    return this.instance
      .post(url, data, { ...config, responseType })
      .then((res) =>
        res && typeof res === 'object' && 'code' in res && 'message' in res
          ? (res as unknown as Result<T>)
          : (res as T)
      );
  }

  public put<T>(
    url: string,
    data?: any,
    config?: CustomAxiosRequestConfig
  ): Promise<T | Result<T>> {
    return this.instance.put(url, data, config).then((res) => res as T | Result<T>);
  }

  public delete<T>(
    url: string,
    data?: any,
    config?: CustomAxiosRequestConfig
  ): Promise<T | Result<T>> {
    return this.instance
      .delete(url, { params: data ?? {}, ...config })
      .then((res) => res as T | Result<T>);
  }
}

export const request = new Request({ returnData: true });

export const BASE_API_URL_EXPORT = BASE_API_URL;
