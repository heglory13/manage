import * as XLSX from 'xlsx';
import { formatDateTime } from './utils';

export interface TransactionExportRow {
  id: string;
  createdAt?: string | null;
  actualStockDate?: string | null;
  kind?: string | null;
  status?: string | null;
  categoryName?: string | null;
  productName?: string | null;
  sku?: string | null;
  productConditionName?: string | null;
  warehouseTypeName?: string | null;
  storageZoneName?: string | null;
  positionLabel?: string | null;
  purchasePrice?: number | null;
  salePrice?: number | null;
  quantity?: number | null;
  signedQuantity?: number | null;
  userName?: string | null;
  note?: string | null;
}

const kindLabels: Record<string, string> = {
  STOCK_IN: 'Nhập kho',
  STOCK_OUT: 'Xuất kho',
  ADJUSTMENT: 'Điều chỉnh',
  TRANSFER: 'Điều chuyển',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Đang GD',
  SUSPENDED: 'Ngưng GD',
};

function toExcelRows(rows: TransactionExportRow[]) {
  return rows.map((row) => ({
    'Mã giao dịch': row.id,
    'Thời gian tạo phiếu': row.createdAt ? formatDateTime(row.createdAt) : '-',
    'Thời gian nhập kho thực tế': row.actualStockDate ? formatDateTime(row.actualStockDate) : '-',
    'Loại giao dịch': row.kind ? kindLabels[row.kind] || row.kind : '-',
    'Trạng thái': row.status ? statusLabels[row.status] || row.status : '-',
    'Danh mục': row.categoryName || '-',
    'Sản phẩm': row.productName || '-',
    SKU: row.sku || '-',
    'Tình trạng hàng': row.productConditionName || '-',
    'Loại kho': row.warehouseTypeName || '-',
    'Khu vực / Thùng': row.storageZoneName || '-',
    'Vị trí kho': row.positionLabel || '-',
    'Giá nhập': row.purchasePrice ?? '',
    'Giá bán': row.salePrice ?? '',
    'Số lượng': row.signedQuantity ?? row.quantity ?? '',
    'Người tạo': row.userName || '-',
    'Ghi chú': row.note || '-',
  }));
}

export function exportTransactionsToExcel(
  rows: TransactionExportRow[],
  fileName: string,
  sheetName: string = 'Transactions',
) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(toExcelRows(rows));
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}
