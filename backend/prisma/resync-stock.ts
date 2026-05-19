/**
 * 1. Backfill warehousePositionId on STOCK_OUT transactions that are missing it
 *    (caused by old bug where stockOut didn't infer position from zone)
 * 2. Resync currentStock on warehousePosition and storageZone from actual transactions
 *
 * Run: npx ts-node prisma/resync-stock.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ── 1. Backfill warehousePositionId on orphaned STOCK_OUT transactions ────
  console.log('=== Bước 1: Backfill warehousePositionId cho STOCK_OUT cũ ===');

  const orphanedStockOuts = await prisma.inventoryTransaction.findMany({
    where: {
      type: 'STOCK_OUT',
      warehousePositionId: null,
      storageZoneId: { not: null },
      status: 'ACTIVE',
    },
    select: { id: true, categoryId: true, storageZoneId: true, skuComboId: true },
  });

  console.log(`Tìm thấy ${orphanedStockOuts.length} STOCK_OUT chưa có vị trí.`);

  for (const txn of orphanedStockOuts) {
    const latestInbound = await prisma.inventoryTransaction.findFirst({
      where: {
        categoryId: txn.categoryId,
        type: 'STOCK_IN',
        status: 'ACTIVE',
        storageZoneId: txn.storageZoneId!,
        warehousePositionId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { warehousePositionId: true },
    });

    if (latestInbound?.warehousePositionId) {
      await prisma.inventoryTransaction.update({
        where: { id: txn.id },
        data: { warehousePositionId: latestInbound.warehousePositionId },
      });
      console.log(`  ✓ txn ${txn.id} → position ${latestInbound.warehousePositionId}`);
    } else {
      console.log(`  ✗ txn ${txn.id}: không tìm được vị trí phù hợp (bỏ qua)`);
    }
  }

  // ── 2. Resync warehousePosition.currentStock ──────────────────────────────
  console.log('\n=== Bước 2: Resync currentStock cho warehousePosition ===');

  const positions = await prisma.warehousePosition.findMany({
    select: { id: true, label: true },
  });

  for (const pos of positions) {
    const txns = await prisma.inventoryTransaction.findMany({
      where: { warehousePositionId: pos.id, status: 'ACTIVE' },
      select: { type: true, quantity: true },
    });

    const stock = txns.reduce(
      (acc, t) => (t.type === 'STOCK_IN' ? acc + t.quantity : acc - t.quantity),
      0,
    );

    await prisma.warehousePosition.update({
      where: { id: pos.id },
      data: { currentStock: Math.max(0, stock) },
    });
    console.log(`  [position] ${pos.label ?? pos.id}: currentStock → ${Math.max(0, stock)}`);
  }

  // ── 3. Resync storageZone.currentStock ────────────────────────────────────
  console.log('\n=== Bước 3: Resync currentStock cho storageZone ===');

  const zones = await prisma.storageZone.findMany({
    select: { id: true, name: true },
  });

  for (const zone of zones) {
    const txns = await prisma.inventoryTransaction.findMany({
      where: { storageZoneId: zone.id, status: 'ACTIVE' },
      select: { type: true, quantity: true },
    });

    const stock = txns.reduce(
      (acc, t) => (t.type === 'STOCK_IN' ? acc + t.quantity : acc - t.quantity),
      0,
    );

    await prisma.storageZone.update({
      where: { id: zone.id },
      data: { currentStock: Math.max(0, stock) },
    });
    console.log(`  [zone]     ${zone.name}: currentStock → ${Math.max(0, stock)}`);
  }

  console.log('\nDone. Tất cả data đã được đồng bộ lại.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
