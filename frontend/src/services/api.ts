import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL?.trim();
const normalizedApiBase = rawApiUrl
  ? `${rawApiUrl.replace(/\/+$/, '')}${rawApiUrl.replace(/\/+$/, '').endsWith('/api') ? '' : '/api'}`
  : '/api';

const ACCESS_TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refreshToken';

function getStoredAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function storeAuthTokens(accessToken: string, refreshToken?: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
  api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  delete api.defaults.headers.common['Authorization'];
}

export const api = axios.create({
  baseURL: normalizedApiBase,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    const isRefreshRequest = String(originalRequest?.url || '').includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest?._retry && !isRefreshRequest) {
      originalRequest._retry = true;

      const refreshToken = getStoredRefreshToken();
      if (refreshToken) {
        try {
          const refreshClient = axios.create({
            baseURL: normalizedApiBase,
            headers: { 'Content-Type': 'application/json' },
          });
          const refreshResponse = await refreshClient.post('/auth/refresh', { refreshToken });
          const { accessToken, refreshToken: nextRefreshToken } = refreshResponse.data;

          storeAuthTokens(accessToken, nextRefreshToken);
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch {
          clearAuthTokens();
        }
      } else {
        clearAuthTokens();
      }

      if (window.location.pathname !== `${import.meta.env.BASE_URL}login`) {
        window.location.href = `${import.meta.env.BASE_URL}login`;
      }
    }
    return Promise.reject(error);
  }
);

export interface Product {
  id: number;
  sku: string;
  name: string;
  category?: { id: number; name: string };
  unit?: string;
  minStock?: number;
  isActive: boolean;
}

export interface Category {
  id: number;
  name: string;
  parentId?: number;
  children?: Category[];
}

export interface InventoryPosition {
  id: number;
  code: string;
  warehouseId: number;
  warehouseName: string;
  zoneId: number;
  zoneName: string;
  zoneColor: string;
  row: number;
  column: number;
  capacity: number;
  currentQuantity: number;
  isActive: boolean;
  skus?: { sku: string; productName: string; quantity: number }[];
}

export interface Warehouse {
  id: number;
  name: string;
  code: string;
  layout: { rows: number; columns: number };
  capacity: number;
  currentQuantity: number;
  zones?: { id: number; name: string; color: string }[];
}

export interface Stocktaking {
  id: number;
  code: string;
  warehouseId: number;
  warehouseName: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  period: string;
  createdAt: string;
  submittedAt?: string;
  approvedAt?: string;
  createdBy?: { name: string };
  notes?: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  isActive: boolean;
  createdAt: string;
}

export interface ActivityLog {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  entityName: string;
  userId: number;
  userName: string;
  changes?: Record<string, { old: string; new: string }>;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DashboardStats {
  totalProducts: number;
  totalInventory: number;
  lowStockCount: number;
  totalWarehouses: number;
  pendingStocktaking: number;
  recentActivity: ActivityLog[];
}

export interface InputDeclaration {
  id: number;
  code: string;
  warehouseId: number;
  warehouseName: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  submittedAt?: string;
  approvedAt?: string;
  classifications?: { id: number; name: string }[];
  colors?: { id: number; name: string; code: string }[];
  sizes?: { id: number; name: string }[];
  materials?: { id: number; name: string }[];
  productConditions?: { id: number; name: string }[];
  warehouseTypes?: { id: number; name: string }[];
  storageZones?: { id: number; name: string; warehouseTypeId: number }[];
}
