/**
 * backfill-fifo-prices.ts
 *
 * One-time script to fix STOCK_OUT transactions that have wrong/missing prices
 * (saved as 1đ or null due to the old `|| 1` fallback bug).
 *
 * For each broken STOCK_OUT:
 *   1. Find the STOCK_IN transactions for the same categoryId (+ skuComboId if
 *      present) ordered oldest-first (FIFO).
 *   2. Walk those lots in order, accounting for quantity already consumed by
 *      earlier STOCK_OUTs (ordered by createdAt), to determine which lot price
 *      this STOCK_OUT should carry.
 *   3. Update purchasePrice and salePrice to the correct FIFO lot price.
 *
 * Run with:
 *   npx ts-node prisma/backfill-fifo-prices.ts
 *
 * The script is idempotent — re-running it will not double-update already-fixed rows.
 */

import { PrismaClient, TransactionType, InventoryTransactionStatus } from '@prisma/client/index';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// ── helpers ──────────────────────────────────────────────────────────────────

function asNumber(d: Decimal | null | undefined): number | null {
  if (d === null || d === undefined) return null;
  return Number(d);
}

/**
 * Returns true when a STOCK_OUT row has a "broken" price that needs fixing:
 * - purchasePrice is null, 0, or 1  (the bug produced exactly 1)
 */
function isBrokenPrice(price: Decimal | null): boolean {
  if (price === null) return true;
  const n = Number(price);
  return n === 0 || n === 1;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Scanning for broken STOCK_OUT prices...\n');

  // Load ALL active STOCK_OUT transactions with broken prices
  const brokenOuts = await prisma.inventoryTransaction.findMany({
    where: {
      type: TransactionType.STOCK_OUT,
      status: InventoryTransactionStatus.ACTIVE,
      // Notes must NOT already contain a FIFO_LOT tag (those were created by new code)
      NOT: { notes: { contains: '[FIFO_LOT:' } },
    },
    orderBy: [{ categoryId: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      categoryId: true,
      skuComboId: true,
      quantity: true,
      purchasePrice: true,
      salePrice: true,
      createdAt: true,
    },
  });

  // Filter to only rows with broken prices
  const toFix = brokenOuts.filter((t) => isBrokenPrice(t.purchasePrice));

  if (toFix.length === 0) {
    console.log('✅ No broken STOCK_OUT prices found. Nothing to do.');
    return;
  }

  console.log(`Found ${toFix.length} STOCK_OUT row(s) with broken prices.\n`);

  // Group by (categoryId, skuComboId) so we can do one FIFO pass per group
  const groups = new Map<string, typeof toFix>();
  for (const tx of toFix) {
    const key = `${tx.categoryId}||${tx.skuComboId ?? ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }

  let fixedCount = 0;
  let skippedCount = 0;

  for (const key of Array.from(groups.keys())) {
    const outTxs = groups.get(key)!;
    const [categoryId, skuComboId] = key.split('||');

    // Load ALL STOCK_IN lots for this group, oldest first
    const inboundLots = await prisma.inventoryTransaction.findMany({
      where: {
        categoryId,
        type: TransactionType.STOCK_IN,
        status: InventoryTransactionStatus.ACTIVE,
        ...(skuComboId ? { skuComboId } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        quantity: true,
        purchasePrice: true,
        salePrice: true,
        createdAt: true,
      },
    });

    if (inboundLots.length === 0) {
      console.log(
        `  ⚠️  categoryId=${categoryId} skuComboId=${skuComboId || '-'}: no STOCK_IN found, skipping ${outTxs.length} row(s)`,
      );
      skippedCount += outTxs.length;
      continue;
    }

    // Load ALL STOCK_OUT for this group ordered by createdAt so we can replay
    // FIFO consumption in chronological order
    const allOuts = await prisma.inventoryTransaction.findMany({
      where: {
        categoryId,
        type: TransactionType.STOCK_OUT,
        status: InventoryTransactionStatus.ACTIVE,
        ...(skuComboId ? { skuComboId } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        quantity: true,
        purchasePrice: true,
        createdAt: true,
      },
    });

    // Build a Set of ids we need to fix for quick lookup
    const toFixIds = new Set(outTxs.map((t) => t.id));

    // Replay FIFO: walk allOuts in order, consuming lots
    // Track remaining qty per lot
    const lotRemaining = new Map<string, number>(
      inboundLots.map((l) => [l.id, l.quantity]),
    );
    // Pointer into inboundLots
    let lotIdx = 0;

    for (const outTx of allOuts) {
      let remaining = outTx.quantity;
      // Collect lot slices consumed by this outTx
      const slices: Array<{ lotId: string; qty: number; price: number | null }> = [];

      while (remaining > 0 && lotIdx < inboundLots.length) {
        const lot = inboundLots[lotIdx];
        const available = lotRemaining.get(lot.id) ?? 0;
        if (available <= 0) {
          lotIdx++;
          continue;
        }
        const take = Math.min(available, remaining);
        lotRemaining.set(lot.id, available - take);
        slices.push({ lotId: lot.id, qty: take, price: asNumber(lot.purchasePrice) });
        remaining -= take;
        if ((lotRemaining.get(lot.id) ?? 0) === 0) lotIdx++;
      }

      if (slices.length === 0) {
        // No lots available — can't determine correct price
        if (toFixIds.has(outTx.id)) {
          console.log(`  ⚠️  tx ${outTx.id}: could not resolve FIFO lot (stock exhausted), skipping`);
          skippedCount++;
        }
        continue;
      }

      // Only update if this outTx is in our broken set
      if (!toFixIds.has(outTx.id)) continue;

      // Determine the dominant lot price (the one that supplied the most qty,
      // or the first lot if tied — good enough for legacy correction)
      const dominant = slices.reduce((a, b) => (b.qty > a.qty ? b : a));
      const correctPrice = dominant.price;

      if (correctPrice === null) {
        console.log(`  ⚠️  tx ${outTx.id}: dominant lot has null price, skipping`);
        skippedCount++;
        continue;
      }

      const currentPrice = asNumber(outTx.purchasePrice);
      console.log(
        `  ✏️  tx ${outTx.id} (qty=${outTx.quantity}): ${currentPrice}đ → ${correctPrice}đ` +
        ` [lots: ${slices.map((s) => `${s.qty}×${s.price}`).join(', ')}]`,
      );

      await prisma.inventoryTransaction.update({
        where: { id: outTx.id },
        data: {
          purchasePrice: new Decimal(correctPrice),
          salePrice: new Decimal(correctPrice),
        },
      });
      fixedCount++;
    }
  }

  console.log(`\n✅ Done. Fixed: ${fixedCount} | Skipped: ${skippedCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
