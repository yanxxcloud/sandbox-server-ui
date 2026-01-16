import axios from 'axios';

const backendApi = axios.create({
  baseURL: 'http://127.0.0.1:8081/api',
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
    return `http://127.0.0.1:8081/api/sandboxes/${sandboxId}/files/download?path=${encodeURIComponent(path)}`;
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
    const url = `ws://127.0.0.1:8081/api/sandboxes/${this.sandboxId}/terminal`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
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
            break;
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    this.ws.onerror = () => {
      this.onError('WebSocket 连接错误');
    };

    this.ws.onclose = () => {
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
      // 只在连接已建立时才关闭，避免 React Strict Mode 问题
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        try {
          this.ws.close();
        } catch (e) {
          // 忽略关闭错误
        }
      }
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
