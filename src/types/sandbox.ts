export interface ImageAuth {
  username: string;
  password: string;
}

export interface ImageSpec {
  uri: string;
  auth?: ImageAuth | null;
}

export interface SandboxStatus {
  state: string;
  reason?: string | null;
  message?: string | null;
  lastTransitionAt?: string | null;
}

export interface ResourceLimits {
  [key: string]: string;
}

export interface Sandbox {
  id: string;
  image: ImageSpec;
  status: SandboxStatus;
  metadata?: Record<string, string> | null;
  entrypoint: string[];
  expiresAt: string;
  createdAt: string;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface ListSandboxesResponse {
  items: Sandbox[];
  pagination: PaginationInfo;
}

export interface CreateSandboxRequest {
  image: ImageSpec;
  timeout: number;
  resourceLimits: ResourceLimits;
  env?: Record<string, string | null> | null;
  metadata?: Record<string, string> | null;
  entrypoint: string[];
  extensions?: Record<string, string> | null;
}

export interface CreateSandboxResponse {
  id: string;
  status: SandboxStatus;
  metadata?: Record<string, string> | null;
  expiresAt: string;
  createdAt: string;
  entrypoint: string[];
}

export interface Endpoint {
  endpoint: string;
}

export interface RenewSandboxExpirationRequest {
  expiresAt: string;
}

export interface RenewSandboxExpirationResponse {
  expiresAt: string;
}

export interface ErrorResponse {
  code: string;
  message: string;
}
