import axios from 'axios';
import type {
  Sandbox,
  ListSandboxesResponse,
  CreateSandboxRequest,
  CreateSandboxResponse,
  Endpoint,
  RenewSandboxExpirationRequest,
  RenewSandboxExpirationResponse,
} from '../types/sandbox';

// 动态获取 API 基础地址
// 通过后端代理访问 OpenSandbox 服务，避免跨域问题
const getApiBaseURL = () => {
  // 开发环境：使用当前访问的 hostname，通过后端代理（8081端口）
  if (import.meta.env.DEV) {
    const hostname = window.location.hostname;
    const baseURL = `http://${hostname}:8081/api`;
    console.log('[API] Base URL:', baseURL);
    return baseURL;
  }
  // 生产环境：使用环境变量或默认值
  return import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8081/api';
};

const api = axios.create({
  baseURL: getApiBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// 添加请求拦截器用于调试
api.interceptors.request.use(
  (config) => {
    console.log('[API] Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// 添加响应拦截器用于调试
api.interceptors.response.use(
  (response) => {
    console.log('[API] Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('[API] Response error:', error.response?.status, error.config?.url, error.message);
    return Promise.reject(error);
  }
);

export const sandboxApi = {
  list: async (params?: {
    state?: string[];
    metadata?: string;
    page?: number;
    pageSize?: number;
  }): Promise<ListSandboxesResponse> => {
    const { data } = await api.get('/sandboxes', { params });
    return data;
  },

  get: async (sandboxId: string): Promise<Sandbox> => {
    const { data } = await api.get(`/sandboxes/${sandboxId}`);
    return data;
  },

  create: async (request: CreateSandboxRequest): Promise<CreateSandboxResponse> => {
    const { data } = await api.post('/sandboxes', request);
    return data;
  },

  delete: async (sandboxId: string): Promise<void> => {
    await api.delete(`/sandboxes/${sandboxId}`);
  },

  pause: async (sandboxId: string): Promise<void> => {
    await api.post(`/sandboxes/${sandboxId}/pause`);
  },

  resume: async (sandboxId: string): Promise<void> => {
    await api.post(`/sandboxes/${sandboxId}/resume`);
  },

  renew: async (
    sandboxId: string,
    request: RenewSandboxExpirationRequest
  ): Promise<RenewSandboxExpirationResponse> => {
    const { data } = await api.post(`/sandboxes/${sandboxId}/renew-expiration`, request);
    return data;
  },

  getEndpoints: async (sandboxId: string): Promise<Endpoint[]> => {
    const { data } = await api.get(`/sandboxes/${sandboxId}/endpoints`);
    return data;
  },

  healthCheck: async (): Promise<boolean> => {
    try {
      await api.get('/health');
      return true;
    } catch {
      return false;
    }
  },
};
