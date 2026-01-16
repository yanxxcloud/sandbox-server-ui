import axios from 'axios';

// 动态获取后端 API 基础地址
const getBackendApiBaseURL = () => {
  // 开发环境：使用当前访问的 hostname，端口 8081
  if (import.meta.env.DEV) {
    const hostname = window.location.hostname;
    return `http://${hostname}:8081/api`;
  }
  // 生产环境：使用环境变量或默认值
  return import.meta.env.VITE_BACKEND_API_BASE_URL || 'http://127.0.0.1:8081/api';
};

const backendApi = axios.create({
  baseURL: getBackendApiBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ExecRequest {
  command: string;
  workDir?: string;
  env?: Record<string, string>;
  timeoutSeconds?: number;
}

export interface ExecResponse {
  exitCode: number;
  stdout: string[];
  stderr: string[];
  executionTimeMs: number;
  success: boolean;
  error?: string;
}

export interface FileInfo {
  name: string;
  path: string;
  type: string;
  size: number;
  mode: number;
  modTime: string;
}

export interface FileWriteRequest {
  path: string;
  content: string;
  mode?: number;
}

export const backendApiService = {
  // 执行命令
  exec: async (sandboxId: string, request: ExecRequest): Promise<ExecResponse> => {
    const { data } = await backendApi.post(`/sandboxes/${sandboxId}/exec`, request);
    return data;
  },

  // 列出文件
  listFiles: async (sandboxId: string, path: string = '/', pattern: string = '*'): Promise<FileInfo[]> => {
    const { data } = await backendApi.get(`/sandboxes/${sandboxId}/files`, {
      params: { path, pattern },
    });
    return data;
  },

  // 读取文件
  readFile: async (sandboxId: string, path: string): Promise<{ content: string; path: string }> => {
    const { data } = await backendApi.get(`/sandboxes/${sandboxId}/files/read`, {
      params: { path },
    });
    return data;
  },

  // 写入文件
  writeFile: async (sandboxId: string, request: FileWriteRequest): Promise<void> => {
    await backendApi.post(`/sandboxes/${sandboxId}/files/write`, request);
  },

  // 上传文件
  uploadFile: async (sandboxId: string, path: string, file: File, mode: number = 644): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file);
    await backendApi.post(`/sandboxes/${sandboxId}/files/upload`, formData, {
      params: { path, mode },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // 删除文件
  deleteFiles: async (sandboxId: string, paths: string[]): Promise<void> => {
    await backendApi.delete(`/sandboxes/${sandboxId}/files`, { data: paths });
  },

  // 下载文件
  getDownloadUrl: (sandboxId: string, path: string): string => {
    const baseURL = getBackendApiBaseURL();
    return `${baseURL}/sandboxes/${sandboxId}/files/download?path=${encodeURIComponent(path)}`;
  },

  // 健康检查
  healthCheck: async (): Promise<boolean> => {
    try {
      await backendApi.get('/sandboxes/health');
      return true;
    } catch {
      return false;
    }
  },
};

// WebSocket 终端连接
export class TerminalWebSocket {
  private ws: WebSocket | null = null;
  private sandboxId: string;
  private onStdout: (data: string) => void;
  private onStderr: (data: string) => void;
  private onExit: (code: number) => void;
  private onError: (error: string) => void;
  private onConnected: () => void;

  constructor(
    sandboxId: string,
    callbacks: {
      onStdout: (data: string) => void;
      onStderr: (data: string) => void;
      onExit: (code: number) => void;
      onError: (error: string) => void;
      onConnected: () => void;
    }
  ) {
    this.sandboxId = sandboxId;
    this.onStdout = callbacks.onStdout;
    this.onStderr = callbacks.onStderr;
    this.onExit = callbacks.onExit;
    this.onError = callbacks.onError;
    this.onConnected = callbacks.onConnected;
  }

  connect() {
    // 如果已经连接，先断开
    if (this.ws) {
      this.disconnect();
    }
    
    // 动态获取 WebSocket URL
    const hostname = window.location.hostname;
    const url = `ws://${hostname}:8081/api/sandboxes/${this.sandboxId}/terminal`;
    console.log('[WebSocket] Connecting to:', url);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected');
      this.onConnected();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'stdout':
            this.onStdout(data.data);
            break;
          case 'stderr':
            this.onStderr(data.data);
            break;
          case 'exit':
            this.onExit(data.exitCode);
            break;
          case 'error':
            this.onError(data.message);
            break;
          case 'connected':
            // 连接成功
            console.log('[WebSocket] Server confirmed connection');
            break;
        }
      } catch (e) {
        console.error('[WebSocket] Failed to parse message:', e);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] Connection error:', error);
      this.onError('WebSocket 连接错误');
    };

    this.ws.onclose = (event) => {
      console.log('[WebSocket] Closed:', event.code, event.reason);
      // 连接关闭
    };
  }

  send(command: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // 兼容旧格式：发送 exec 类型
      this.ws.send(JSON.stringify({ type: 'exec', command }));
    }
  }

  sendInput(input: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'input', data: input }));
    }
  }

  disconnect() {
    if (this.ws) {
      const state = this.ws.readyState;
      console.log('[WebSocket] Disconnecting, state:', state);
      
      // 只在连接已建立或正在连接时才关闭
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        try {
          // 如果正在连接，等待一下再关闭
          if (state === WebSocket.CONNECTING) {
            console.log('[WebSocket] Waiting for connection to establish before closing...');
            // 设置一个短暂的超时，让连接有机会建立
            setTimeout(() => {
              if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.close();
              }
              this.ws = null;
            }, 100);
            return;
          }
          this.ws.close();
        } catch (e) {
          console.error('[WebSocket] Error closing:', e);
        }
      }
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
