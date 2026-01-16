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

const api = axios.create({
  baseURL: 'http://127.0.0.1:8080',
  headers: {
    'Content-Type': 'application/json',
  },
});

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
