import {
  InventoryTransactionStatus,
  TransactionType,
} from '@prisma/client/index';

export interface TransactionValuationRow {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  skuComboId: string | null;
  compositeSku: string | null;
  classification?: string | null;
  color?: string | null;
  size?: string | null;
  material?: string | null;
  type: TransactionType;
  quantity: number;
  purchasePrice: number | null;
  createdAt: Date;
  status: InventoryTransactionStatus;
}

export interface InventoryValuationBucket {
  key: string;
  productId: string;
  productName: string;
  productSku: string;
  compositeSku: string;
  classification: string;
  color: string;
  size: string;
  material: string;
  openingQty: number;
  openingValue: number;
  totalInQty: number;
  totalInValue: number;
  totalOutQty: number;
  totalOutValue: number;
  closingQty: number;
  closingValue: number;
  averageCost: number;
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function buildInventoryValuationBuckets(
  rows: TransactionValuationRow[],
  startDate?: Date,
  endDate?: Date,
): InventoryValuationBucket[] {
  const activeRows = rows
    .filter((row) => row.status === InventoryTransactionStatus.ACTIVE)
    .sort((a, b) => {
      const byDate = a.createdAt.getTime() - b.createdAt.getTime();
      return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
    });

  const bucketMap = new Map<string, InventoryValuationBucket>();

  const ensureBucket = (row: TransactionValuationRow) => {
    const key = row.skuComboId || `product:${row.productId}`;
    if (!bucketMap.has(key)) {
      bucketMap.set(key, {
        key,
        productId: row.productId,
        productName: row.productName,
        productSku: row.productSku,
        compositeSku: row.compositeSku || row.productSku,
        classification: row.classification || '-',
        color: row.color || '-',
        size: row.size || '-',
        material: row.material || '-',
        openingQty: 0,
        openingValue: 0,
        totalInQty: 0,
        totalInValue: 0,
        totalOutQty: 0,
        totalOutValue: 0,
        closingQty: 0,
        closingValue: 0,
        averageCost: 0,
      });
    }

    return bucketMap.get(key)!;
  };

  for (const row of activeRows) {
    const bucket = ensureBucket(row);

    const isBeforePeriod = startDate ? row.createdAt < startDate : false;
    const isInPeriod =
      (!startDate || row.createdAt >= startDate) &&
      (!endDate || row.createdAt <= endDate);

    if (row.type === TransactionType.STOCK_IN) {
      const inboundValue = roundCurrency(row.quantity * (row.purchasePrice ?? 0));
      bucket.closingQty += row.quantity;
      bucket.closingValue = roundCurrency(bucket.closingValue + inboundValue);
      bucket.averageCost =
        bucket.closingQty > 0 ? roundCurrency(bucket.closingValue / bucket.closingQty) : 0;

      if (isBeforePeriod) {
        bucket.openingQty += row.quantity;
        bucket.openingValue = roundCurrency(bucket.openingValue + inboundValue);
      }

      if (isInPeriod) {
        bucket.totalInQty += row.quantity;
        bucket.totalInValue = roundCurrency(bucket.totalInValue + inboundValue);
      }
    } else {
      const unitCost = bucket.averageCost;
      const outboundValue = roundCurrency(row.quantity * unitCost);
      bucket.closingQty -= row.quantity;
      bucket.closingValue = roundCurrency(bucket.closingValue - outboundValue);

      if (bucket.closingQty <= 0) {
        bucket.closingQty = 0;
        bucket.closingValue = 0;
        bucket.averageCost = 0;
      } else {
        bucket.averageCost = roundCurrency(bucket.closingValue / bucket.closingQty);
      }

      if (isBeforePeriod) {
        bucket.openingQty -= row.quantity;
        bucket.openingValue = roundCurrency(bucket.openingValue - outboundValue);
      }

      if (isInPeriod) {
        bucket.totalOutQty += row.quantity;
        bucket.totalOutValue = roundCurrency(bucket.totalOutValue + outboundValue);
      }
    }
  }

  return Array.from(bucketMap.values())
    .map((bucket) => ({
      ...bucket,
      openingValue: roundCurrency(Math.max(bucket.openingValue, 0)),
      totalInValue: roundCurrency(Math.max(bucket.totalInValue, 0)),
      totalOutValue: roundCurrency(Math.max(bucket.totalOutValue, 0)),
      closingValue: roundCurrency(Math.max(bucket.closingValue, 0)),
      averageCost: roundCurrency(Math.max(bucket.averageCost, 0)),
    }))
    .filter(
      (bucket) =>
        bucket.openingQty !== 0 ||
        bucket.totalInQty !== 0 ||
        bucket.totalOutQty !== 0 ||
        bucket.closingQty !== 0,
    );
}
