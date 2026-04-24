import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL?.trim();
const normalizedApiBase = rawApiUrl
  ? `${rawApiUrl.replace(/\/+$/, '')}${rawApiUrl.replace(/\/+$/, '').endsWith('/api') ? '' : '/api'}`
  : '/api';

export const api = axios.create({
  baseURL: normalizedApiBase,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
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
