import {
  PrismaClient,
  Role,
  TransactionType,
  StocktakingStatus,
  PreliminaryCheckStatus,
} from '@prisma/client/index';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Safe upsert: skip if already exists (handles partial unique constraint matches)
async function getOrCreate<T extends Record<string, unknown>>(
  model: keyof PrismaClient,
  where: Record<string, unknown>,
  data: T,
  idField = 'id',
): Promise<T & { id: string }> {
  // @ts-ignore - dynamic model access
  const existing = await (prisma[model] as any).findFirst({ where });
  if (existing) return existing as T & { id: string };
  // @ts-ignore
  return prisma[model].create({ data }) as Promise<T & { id: string }>;
}

// Truncate all data tables in correct FK order before seeding
async function truncateAll() {
  const tableNames = [
    'activity_logs',
    'saved_filters',
    'stocktaking_status_history',
    'stocktaking_items',
    'stocktaking_records',
    'inventory_transactions',
    'warehouse_positions',
    'warehouse_layouts',
    'warehouse_config',
    'preliminary_checks',
    'storage_zones',
    'warehouse_types',
    'product_conditions',
    'sku_combos',
    'materials',
    'sizes',
    'colors',
    'classifications',
    'products',
    'categories',
    'users',
  ];

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
  for (const tableName of tableNames) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${tableName}\``);
  }
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
}

async function main() {
  await truncateAll();
  console.log('🧹 All tables truncated (fresh start)\n');
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  // ============================================================
  // 1. USERS
  // ============================================================
  const hashedPassword = await bcrypt.hash('admin@123', 10);
  const adminUser = await getOrCreate('user', { email: 'admin@inventory.com' }, {
    email: 'admin@inventory.com', password: hashedPassword, name: 'Nguyễn Văn A', role: Role.ADMIN,
  });
  const seededAdminUser = await prisma.user.update({
    where: { id: adminUser.id },
    data: {
      email: 'hung@havias.asia',
      password: hashedPassword,
      name: 'Hung Havias',
    },
  });
  const managerUser = await getOrCreate('user', { email: 'manager@inventory.com' }, {
    email: 'manager@inventory.com', password: hashedPassword, name: 'Trần Thị B', role: Role.MANAGER,
  });
  const staff1 = await getOrCreate('user', { email: 'staff1@inventory.com' }, {
    email: 'staff1@inventory.com', password: hashedPassword, name: 'Lê Minh C', role: Role.STAFF,
  });
  const staff2 = await getOrCreate('user', { email: 'staff2@inventory.com' }, {
    email: 'staff2@inventory.com', password: hashedPassword, name: 'Phạm Thị D', role: Role.STAFF,
  });
  const staff3 = await getOrCreate('user', { email: 'staff3@inventory.com' }, {
    email: 'staff3@inventory.com', password: hashedPassword, name: 'Hoàng Văn E', role: Role.STAFF,
  });
  const users = [seededAdminUser, managerUser, staff1, staff2, staff3];
  console.log(`✅ 5 users created/loaded`);

  // ============================================================
  // 2. CATEGORIES
  // ============================================================
  const catData = [
    { name: 'Giày thể thao', code: 'GTT' },
    { name: 'Giày da', code: 'GD' },
    { name: 'Giày sandal', code: 'GS' },
    { name: 'Giày boot', code: 'GB' },
    { name: 'Dép guốc', code: 'DG' },
    { name: 'Túi xách', code: 'TX' },
    { name: 'Ví da', code: 'VD' },
    { name: 'Thắt lưng', code: 'TL' },
    { name: 'Balo', code: 'BL' },
    { name: 'Phụ kiện', code: 'PK' },
  ];
  const categories: Record<string, string> = {};
  for (const c of catData) {
    const cat = await getOrCreate('category', { code: c.code }, c);
    categories[c.code] = cat.id;
  }
  console.log(`✅ ${catData.length} categories created/loaded`);

  // ============================================================
  // 3. CLASSIFICATIONS
  // ============================================================
  const classificationNames = [
    'Cao cấp', 'Thời trang', 'Phổ thông', 'Khuyến mãi',
    'Classic', 'Sport', 'Casual', 'Premium', 'Limited Edition', 'Kids',
  ];
  const classifications: Record<string, string> = {};
  for (const name of classificationNames) {
    const c = await getOrCreate('classification', { name }, { name });
    classifications[name] = c.id;
  }
  console.log(`✅ ${classificationNames.length} classifications created/loaded`);

  // ============================================================
  // 4. COLORS
  // ============================================================
  const colorNames = [
    'Đen', 'Trắng', 'Bạc', 'Vàng gold', 'Xanh navy', 'Đỏ',
    'Nâu', 'Be', 'Xám', 'Hồng', 'Cam', 'Xanh lá',
    'Tím', 'Vàng nhạt', 'Đen bóng', 'Nâu đậm',
  ];
  const colors: Record<string, string> = {};
  for (const name of colorNames) {
    const c = await getOrCreate('color', { name }, { name });
    colors[name] = c.id;
  }
  console.log(`✅ ${colorNames.length} colors created/loaded`);

  // ============================================================
  // 5. SIZES
  // ============================================================
  const sizeNames = ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];
  const sizes: Record<string, string> = {};
  for (const name of sizeNames) {
    const s = await getOrCreate('size', { name }, { name });
    sizes[name] = s.id;
  }
  console.log(`✅ ${sizeNames.length} sizes created/loaded`);

  // ============================================================
  // 6. MATERIALS
  // ============================================================
  const materialNames = [
    'Da thật', 'Da bò', 'Da cá sấu', 'Da giả/Simili',
    'Vải canvas', 'Vải lưới', 'Cao su', 'Nhựa EVA',
    'Da PU', 'Nỉ', 'Lưới thoáng khí', 'Microfiber',
  ];
  const materials: Record<string, string> = {};
  for (const name of materialNames) {
    const m = await getOrCreate('material', { name }, { name });
    materials[name] = m.id;
  }
  console.log(`✅ ${materialNames.length} materials created/loaded`);

  // ============================================================
  // 7. PRODUCT CONDITIONS
  // ============================================================
  const conditionNames = [
    'Đạt tiêu chuẩn', 'Lỗi/Hỏng nhẹ', 'Lỗi/Hỏng nặng',
    'Hàng khách kí gửi', 'Hàng trưng bày', 'Hàng mẫu',
  ];
  const conditions: Record<string, string> = {};
  for (const name of conditionNames) {
    const c = await getOrCreate('productCondition', { name }, { name });
    conditions[name] = c.id;
  }
  console.log(`✅ ${conditionNames.length} product conditions created/loaded`);

  // ============================================================
  // 8. WAREHOUSE TYPES
  // ============================================================
  const warehouseTypeNames = ['Kho sản xuất', 'Kho lẻ', 'Kho trung chuyển'];
  const warehouseTypes: Record<string, string> = {};
  for (const name of warehouseTypeNames) {
    const t = await getOrCreate('warehouseType', { name }, { name });
    warehouseTypes[name] = t.id;
  }
  console.log(`✅ ${warehouseTypeNames.length} warehouse types created/loaded`);

  // ============================================================
  // 9. STORAGE ZONES
  // ============================================================
  const zoneData = [
    { name: 'Thùng OV1', maxCapacity: 100 },
    { name: 'Thùng OV2', maxCapacity: 100 },
    { name: 'Thùng OV3', maxCapacity: 150 },
    { name: 'Thùng BO1', maxCapacity: 80 },
    { name: 'Thùng BO2', maxCapacity: 80 },
    { name: 'Thùng S1', maxCapacity: 120 },
    { name: 'Thùng S2', maxCapacity: 120 },
    { name: 'Thùng K1', maxCapacity: 200 },
    { name: 'Thùng K2', maxCapacity: 200 },
    { name: 'Thùng P1', maxCapacity: 60 },
    { name: 'Thùng P2', maxCapacity: 60 },
    { name: 'Thùng L1', maxCapacity: 90 },
    { name: 'Thùng L2', maxCapacity: 90 },
    { name: 'Thùng N1', maxCapacity: 110 },
    { name: 'Thùng N2', maxCapacity: 110 },
  ];
  const zones: Record<string, string> = {};
  for (const z of zoneData) {
    const zone = await getOrCreate('storageZone', { name: z.name }, { name: z.name, maxCapacity: z.maxCapacity, currentStock: 0 });
    zones[z.name] = zone.id;
  }
  console.log(`✅ ${zoneData.length} storage zones created/loaded`);

  // ============================================================
  // 10. WAREHOUSE LAYOUTS
  // ============================================================
  const gridLayout = await getOrCreate('warehouseLayout', { id: 'grid-layout' }, {
    id: 'grid-layout',
    name: 'Kho chính - Lưới',
    rows: 4,
    columns: 6,
    layoutMode: 'GRID',
    canvasWidth: 1200,
    canvasHeight: 700,
  });

  const freeLayout = await getOrCreate('warehouseLayout', { id: 'free-layout' }, {
    id: 'free-layout',
    name: 'Kho tự do - Hình L',
    rows: 0,
    columns: 0,
    layoutMode: 'FREE',
    canvasWidth: 1600,
    canvasHeight: 900,
  });

  // GRID positions
  const gridPositions: Record<string, string> = {};
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      const label = `${String.fromCharCode(65 + r)}${c + 1}`;
      const pos = await getOrCreate('warehousePosition', { id: `grid-pos-${label}` }, {
        id: `grid-pos-${label}`,
        layoutId: gridLayout.id,
        row: r,
        column: c,
        x: c * 110,
        y: r * 90,
        width: 100,
        height: 80,
        label,
        isActive: true,
        currentStock: 0,
        maxCapacity: 50,
      });
      gridPositions[label] = pos.id;
    }
  }
  console.log(`✅ GRID layout: ${Object.keys(gridPositions).length} positions created/loaded`);

  // FREE positions - L-shape
  const freePosData = [
    { id: 'f1', x: 50, y: 50, w: 120, h: 100, label: 'L1', row: 0, col: 0 },
    { id: 'f2', x: 180, y: 50, w: 120, h: 100, label: 'L2', row: 0, col: 1 },
    { id: 'f3', x: 310, y: 50, w: 120, h: 100, label: 'L3', row: 0, col: 2 },
    { id: 'f4', x: 440, y: 50, w: 120, h: 100, label: 'L4', row: 0, col: 3 },
    { id: 'f5', x: 570, y: 50, w: 120, h: 100, label: 'L5', row: 0, col: 4 },
    { id: 'f6', x: 700, y: 50, w: 120, h: 100, label: 'L6', row: 0, col: 5 },
    { id: 'f7', x: 50, y: 160, w: 120, h: 100, label: 'L7', row: 1, col: 0 },
    { id: 'f8', x: 50, y: 270, w: 120, h: 100, label: 'L8', row: 2, col: 0 },
    { id: 'f9', x: 50, y: 380, w: 120, h: 100, label: 'L9', row: 3, col: 0 },
    { id: 'f10', x: 180, y: 160, w: 200, h: 100, label: 'L10', row: 1, col: 1 },
    { id: 'f11', x: 390, y: 160, w: 200, h: 100, label: 'L11', row: 1, col: 2 },
    { id: 'f12', x: 600, y: 160, w: 200, h: 100, label: 'L12', row: 1, col: 3 },
    { id: 'f13', x: 810, y: 160, w: 200, h: 100, label: 'L13', row: 1, col: 4 },
  ];
  const freePositions: Record<string, string> = {};
  for (const p of freePosData) {
    const pos = await getOrCreate('warehousePosition', { id: `free-pos-${p.id}` }, {
      id: `free-pos-${p.id}`,
      layoutId: freeLayout.id,
      row: p.row,
      column: p.col,
      x: p.x,
      y: p.y,
      width: p.w,
      height: p.h,
      label: p.label,
      isActive: true,
      currentStock: 0,
      maxCapacity: 80,
    });
    freePositions[p.label] = pos.id;
  }
  console.log(`✅ FREE layout: ${freePosData.length} positions created/loaded`);

  // ============================================================
  // 11. SKU COMBOS
  // ============================================================
  const clsKeys = Object.keys(classifications);
  const colKeys = Object.keys(colors);
  const sizeKeys = Object.keys(sizes);
  const matKeys = Object.keys(materials);

  console.log(`   Generating SKU combos (${clsKeys.length}×${colKeys.length}×${sizeKeys.length}×${matKeys.length} total)...`);

  let skuComboCount = 0;
  for (const cls of clsKeys) {
    for (const col of colKeys) {
      for (const sz of sizeKeys) {
        for (const mat of matKeys) {
          const clsName = classifications[cls].replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
          const colName = col.substring(0, 2).toUpperCase();
          const szName = sz;
          const matName = mat.replace(/[^a-zA-Z0-9]/g, '').substring(0, 2).toUpperCase();
          const compositeSku = `${clsName}-${colName}-${szName}-${matName}`;

          try {
            await getOrCreate('skuCombo', { compositeSku }, {
              classificationId: classifications[cls],
              colorId: colors[col],
              sizeId: sizes[sz],
              materialId: materials[mat],
              compositeSku,
            });
            skuComboCount++;
          } catch {
            // Skip duplicates
          }
        }
      }
    }
  }
  console.log(`✅ ${skuComboCount} SKU combos created/loaded`);

  // ============================================================
  // 12. PRODUCTS
  // ============================================================
  const productTemplates = [
    { name: 'Giày thể thao Nike Air Max 90', category: 'GTT', minThreshold: 5, maxThreshold: 100, price: 4500000 },
    { name: 'Giày thể thao Adidas Ultraboost 22', category: 'GTT', minThreshold: 5, maxThreshold: 80, price: 6200000 },
    { name: 'Giày thể thao Puma RS-X', category: 'GTT', minThreshold: 3, maxThreshold: 60, price: 3200000 },
    { name: 'Giày thể thao New Balance 574', category: 'GTT', minThreshold: 4, maxThreshold: 70, price: 3800000 },
    { name: 'Giày chạy bộ Asics Gel-Kayano', category: 'GTT', minThreshold: 3, maxThreshold: 50, price: 5500000 },
    { name: 'Giày thể thao Converse Run Star Hike', category: 'GTT', minThreshold: 2, maxThreshold: 40, price: 2900000 },
    { name: 'Giày thể thao Vans Old Skool', category: 'GTT', minThreshold: 4, maxThreshold: 80, price: 2100000 },
    { name: 'Giày thể thao Reebok Classic Leather', category: 'GTT', minThreshold: 3, maxThreshold: 60, price: 2600000 },
    { name: 'Giày da nam Classic Oxford', category: 'GD', minThreshold: 3, maxThreshold: 50, price: 4800000 },
    { name: 'Giày da nữ Pumps Kitten Heel', category: 'GD', minThreshold: 2, maxThreshold: 40, price: 3500000 },
    { name: 'Giày da lười nam', category: 'GD', minThreshold: 4, maxThreshold: 60, price: 2200000 },
    { name: 'Giày da boots nam Chelsea', category: 'GB', minThreshold: 2, maxThreshold: 35, price: 5200000 },
    { name: 'Giày da nam Brogue', category: 'GD', minThreshold: 2, maxThreshold: 30, price: 5800000 },
    { name: 'Giày da nữ Ballerina', category: 'GD', minThreshold: 3, maxThreshold: 45, price: 2400000 },
    { name: 'Sandal nữ đế bằng', category: 'GS', minThreshold: 5, maxThreshold: 100, price: 850000 },
    { name: 'Sandal nam quai ngang', category: 'GS', minThreshold: 4, maxThreshold: 80, price: 750000 },
    { name: 'Sandal nữ cao gót', category: 'GS', minThreshold: 3, maxThreshold: 50, price: 1200000 },
    { name: 'Sandal trẻ em', category: 'GS', minThreshold: 5, maxThreshold: 60, price: 450000 },
    { name: 'Boot nam Timberland 6 inch', category: 'GB', minThreshold: 2, maxThreshold: 30, price: 7500000 },
    { name: 'Boot nữ gót vuông', category: 'GB', minThreshold: 2, maxThreshold: 35, price: 3100000 },
    { name: 'Boot combat nam', category: 'GB', minThreshold: 2, maxThreshold: 25, price: 4200000 },
    { name: 'Boot snow cho nam', category: 'GB', minThreshold: 1, maxThreshold: 15, price: 6800000 },
    { name: 'Dép guốc nam cao su', category: 'DG', minThreshold: 10, maxThreshold: 200, price: 180000 },
    { name: 'Dép guốc nữ EVA', category: 'DG', minThreshold: 10, maxThreshold: 150, price: 220000 },
    { name: 'Dép xỏ ngón nam', category: 'DG', minThreshold: 8, maxThreshold: 120, price: 150000 },
    { name: 'Dép sandal nữ', category: 'DG', minThreshold: 8, maxThreshold: 100, price: 350000 },
    { name: 'Túi xách nữ đeo chéo', category: 'TX', minThreshold: 3, maxThreshold: 50, price: 890000 },
    { name: 'Túi xách nữ tote', category: 'TX', minThreshold: 2, maxThreshold: 30, price: 1400000 },
    { name: 'Túi xách nam da thật', category: 'TX', minThreshold: 2, maxThreshold: 25, price: 3200000 },
    { name: 'Túi clutch nữ', category: 'TX', minThreshold: 3, maxThreshold: 40, price: 650000 },
    { name: 'Túi xách laptop', category: 'TX', minThreshold: 2, maxThreshold: 20, price: 1800000 },
    { name: 'Ví nam da bò ngắn', category: 'VD', minThreshold: 5, maxThreshold: 80, price: 480000 },
    { name: 'Ví nữ gấp đôi', category: 'VD', minThreshold: 4, maxThreshold: 60, price: 350000 },
    { name: 'Ví nam da cá sấu', category: 'VD', minThreshold: 1, maxThreshold: 20, price: 2200000 },
    { name: 'Ví đựng thẻ (card holder)', category: 'VD', minThreshold: 3, maxThreshold: 40, price: 280000 },
    { name: 'Thắt lưng nam da', category: 'TL', minThreshold: 5, maxThreshold: 80, price: 380000 },
    { name: 'Thắt lưng nam vải', category: 'TL', minThreshold: 5, maxThreshold: 60, price: 180000 },
    { name: 'Thắt lưng nữ', category: 'TL', minThreshold: 3, maxThreshold: 40, price: 250000 },
    { name: 'Thắt lưng da cá sấu', category: 'TL', minThreshold: 1, maxThreshold: 15, price: 1800000 },
    { name: 'Balo laptop 15.6 inch', category: 'BL', minThreshold: 2, maxThreshold: 30, price: 1200000 },
    { name: 'Balo chống nước', category: 'BL', minThreshold: 2, maxThreshold: 25, price: 1800000 },
    { name: 'Balo du lịch 45L', category: 'BL', minThreshold: 1, maxThreshold: 15, price: 2400000 },
    { name: 'Balo trẻ em', category: 'BL', minThreshold: 3, maxThreshold: 30, price: 580000 },
    { name: 'Dây giày thể thao', category: 'PK', minThreshold: 20, maxThreshold: 300, price: 80000 },
    { name: 'Miếng lót giày', category: 'PK', minThreshold: 15, maxThreshold: 200, price: 60000 },
    { name: 'Bình xịt làm sạch giày', category: 'PK', minThreshold: 10, maxThreshold: 150, price: 120000 },
    { name: 'Keo dán giày chuyên dụng', category: 'PK', minThreshold: 10, maxThreshold: 100, price: 95000 },
    { name: 'Bàn chải đánh giày', category: 'PK', minThreshold: 8, maxThreshold: 80, price: 45000 },
    { name: 'Xịt khử mùi giày', category: 'PK', minThreshold: 12, maxThreshold: 120, price: 180000 },
  ];

  const products: { id: string; sku: string; stock: number }[] = [];
  for (let i = 0; i < productTemplates.length; i++) {
    const t = productTemplates[i];
    const sku = `${t.category}-${String(i + 1).padStart(4, '0')}`;
    const stock = randInt(0, 120);

    try {
      const product = await getOrCreate('product', { sku }, {
        name: t.name,
        sku,
        price: t.price,
        categoryId: categories[t.category],
        stock,
        minThreshold: t.minThreshold,
        maxThreshold: t.maxThreshold,
      });
      products.push({ id: product.id, sku: product.sku, stock });
    } catch {
      // product already exists
      const existing = await prisma.product.findFirst({ where: { sku } });
      if (existing) products.push({ id: existing.id, sku: existing.sku, stock: existing.stock });
    }
  }
  console.log(`✅ ${products.length} products created/loaded`);

  // ============================================================
  // 13. INVENTORY TRANSACTIONS
  // ============================================================
  const allSkus = await prisma.skuCombo.findMany({ take: 500 });
  const zoneKeys = Object.values(zones);
  const conditionKeys = Object.values(conditions);
  const staffUsers = users.filter(u => u.role === Role.STAFF || u.role === Role.MANAGER);
  const positionIds = [...Object.values(gridPositions), ...Object.values(freePositions)];

  let txnCount = 0;
  for (let i = 0; i < 250; i++) {
    const product = pick(products);
    const skuCombo = pick(allSkus);
    const zone = pick(zoneKeys);
    const condition = pick(conditionKeys);
    const user = pick(staffUsers);
    const isStockIn = Math.random() > 0.3;
    const quantity = randInt(1, 20);
    const createdAt = randDate(threeMonthsAgo, now);
    const positionId = pick(positionIds);
    const stockInDate = new Date(createdAt);
    stockInDate.setDate(stockInDate.getDate() + randInt(0, 3));
    const salePrice = randInt(150000, 7500000);
    const purchasePrice = Math.max(50000, Math.round(salePrice * (0.55 + Math.random() * 0.25)));

    try {
      await prisma.inventoryTransaction.create({
        data: {
          productId: product.id,
          type: isStockIn ? TransactionType.STOCK_IN : TransactionType.STOCK_OUT,
          quantity,
          purchasePrice,
          salePrice,
          userId: user.id,
          skuComboId: skuCombo.id,
          productConditionId: condition,
          storageZoneId: zone,
          warehousePositionId: positionId,
          actualStockDate: isStockIn ? stockInDate : createdAt,
          createdAt,
        },
      });
      txnCount++;
    } catch {
      // Skip constraint violations
    }
  }
  console.log(`✅ ${txnCount} inventory transactions created`);

  // ============================================================
  // 14. PRELIMINARY CHECKS
  // ============================================================
  const allClassifications = Object.values(classifications);
  const allWarehouseTypes = Object.values(warehouseTypes);

  for (let i = 0; i < 30; i++) {
    const cls = pick(allClassifications);
    const whType = pick(allWarehouseTypes);
    const qty = randInt(5, 200);
    const isCompleted = Math.random() > 0.4;
    const createdByUser = pick(staffUsers);

    try {
      await prisma.preliminaryCheck.create({
        data: {
          classificationId: cls,
          quantity: qty,
          warehouseTypeId: whType,
          imageUrl: null,
          note: `Kiểm tra sơ bộ lô hàng #${i + 1}`,
          status: isCompleted ? PreliminaryCheckStatus.COMPLETED : PreliminaryCheckStatus.PENDING,
          createdBy: createdByUser.id,
        },
      });
    } catch {
      // Skip
    }
  }
  console.log(`✅ 30 preliminary checks created`);

  // ============================================================
  // 15. STOCKTAKING RECORDS
  // ============================================================
  // Record 1: APPROVED
  const cutoff1 = new Date();
  cutoff1.setDate(15);
  cutoff1.setMonth(cutoff1.getMonth() - 1);
  const record1 = await prisma.stocktakingRecord.create({
    data: {
      status: StocktakingStatus.APPROVED,
      createdBy: adminUser.id,
      cutoffTime: cutoff1,
      submittedAt: new Date(cutoff1.getTime() + 86400000 * 2),
      mode: 'full',
    },
  });

  for (const p of products.slice(0, 15)) {
    const sysQty = p.stock || randInt(5, 50);
    const actualQty = sysQty + randInt(-5, 5);
    await prisma.stocktakingItem.create({
      data: {
        recordId: record1.id,
        productId: p.id,
        systemQuantity: sysQty,
        actualQuantity: Math.max(0, actualQty),
        discrepancy: Math.max(0, actualQty) - sysQty,
        evidenceUrl: null,
        discrepancyReason: actualQty < sysQty ? 'Thiếu hàng do đóng gói' : null,
      },
    });
  }
  await prisma.stocktakingStatusHistory.createMany({
    data: [
      { recordId: record1.id, status: StocktakingStatus.CHECKING, changedBy: adminUser.id, note: 'Bắt đầu kiểm kê' },
      { recordId: record1.id, status: StocktakingStatus.PENDING, changedBy: adminUser.id, note: 'Đã hoàn thành kiểm đếm' },
      { recordId: record1.id, status: StocktakingStatus.APPROVED, changedBy: adminUser.id, note: 'Duyệt biên bản' },
    ],
  });

  // Record 2: PENDING
  const cutoff2 = new Date();
  cutoff2.setDate(cutoff2.getDate() - 7);
  const record2 = await prisma.stocktakingRecord.create({
    data: {
      status: StocktakingStatus.PENDING,
      createdBy: managerUser.id,
      cutoffTime: cutoff2,
      submittedAt: new Date(cutoff2.getTime() + 86400000),
      mode: 'full',
    },
  });
  for (const p of products.slice(15, 25)) {
    await prisma.stocktakingItem.create({
      data: { recordId: record2.id, productId: p.id, systemQuantity: p.stock || 10, actualQuantity: p.stock || 10, discrepancy: 0 },
    });
  }
  await prisma.stocktakingStatusHistory.createMany({
    data: [
      { recordId: record2.id, status: StocktakingStatus.CHECKING, changedBy: managerUser.id },
      { recordId: record2.id, status: StocktakingStatus.PENDING, changedBy: managerUser.id, note: 'Submit để duyệt' },
    ],
  });

  // Record 3: CHECKING
  const cutoff3 = new Date();
  cutoff3.setDate(cutoff3.getDate() - 3);
  const record3 = await prisma.stocktakingRecord.create({
    data: {
      status: StocktakingStatus.CHECKING,
      createdBy: staff1.id,
      cutoffTime: cutoff3,
      mode: 'selected',
    },
  });
  for (const p of products.slice(25, 33)) {
    await prisma.stocktakingItem.create({
      data: { recordId: record3.id, productId: p.id, systemQuantity: p.stock || 10, actualQuantity: 0, discrepancy: -(p.stock || 10) },
    });
  }

  // Record 4: REJECTED
  const cutoff4 = new Date();
  cutoff4.setDate(cutoff4.getDate() - 14);
  const record4 = await prisma.stocktakingRecord.create({
    data: {
      status: StocktakingStatus.REJECTED,
      createdBy: staff2.id,
      cutoffTime: cutoff4,
      submittedAt: new Date(cutoff4.getTime() + 86400000),
      mode: 'full',
    },
  });
  await prisma.stocktakingStatusHistory.createMany({
    data: [
      { recordId: record4.id, status: StocktakingStatus.CHECKING, changedBy: staff2.id },
      { recordId: record4.id, status: StocktakingStatus.PENDING, changedBy: staff2.id },
      { recordId: record4.id, status: StocktakingStatus.REJECTED, changedBy: adminUser.id, note: 'Số liệu không khớp, yêu cầu kiểm tra lại' },
    ],
  });
  console.log(`✅ 4 stocktaking records created`);

  // ============================================================
  // 16. ACTIVITY LOGS
  // ============================================================
  const actions = ['CREATE', 'UPDATE', 'DELETE', 'STOCK_IN', 'STOCK_OUT'];
  const tables = ['products', 'inventory_transactions', 'warehouse_positions', 'stocktaking_records'];
  const tableProducts = await prisma.product.findMany({ take: 10 });

  for (let i = 0; i < 30; i++) {
    const user = pick(users);
    const action = pick(actions);
    const table = pick(tables);
    const recordId = tableProducts[i % tableProducts.length]?.id ?? 'demo-id';
    const createdAt = randDate(threeMonthsAgo, now);

    try {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action,
          tableName: table,
          recordId,
          oldData: action === 'UPDATE' ? { stock: randInt(10, 50) } : undefined,
          newData: action !== 'DELETE' ? { stock: randInt(10, 100) } : undefined,
          createdAt,
        },
      });
    } catch {
      // Skip
    }
  }
  console.log(`✅ 30 activity logs created`);

  // ============================================================
  // 17. WAREHOUSE CONFIG
  // ============================================================
  await prisma.warehouseConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', maxCapacity: 50000 },
  });

  // ============================================================
  // 18. UPDATE PRODUCT STOCK FROM TRANSACTIONS
  // ============================================================
  const allProducts = await prisma.product.findMany();
  for (const product of allProducts) {
    const txns = await prisma.inventoryTransaction.findMany({ where: { productId: product.id } });
    let stock = 0;
    for (const t of txns) {
      stock += t.type === TransactionType.STOCK_IN ? t.quantity : -t.quantity;
    }
    await prisma.product.update({ where: { id: product.id }, data: { stock: Math.max(0, stock) } });
  }
  console.log(`✅ Product stock recalculated from transactions`);

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n🎉 ====== SEED COMPLETE ======');
  console.log('');
  console.log('📊 Dataset summary:');
  console.log(`   Users:            5 (admin, manager, 3 staff)`);
  console.log(`   Categories:       ${catData.length}`);
  console.log(`   Classifications:  ${classificationNames.length}`);
  console.log(`   Colors:           ${colorNames.length}`);
  console.log(`   Sizes:            ${sizeNames.length}`);
  console.log(`   Materials:        ${materialNames.length}`);
  console.log(`   SKU Combos:       ${skuComboCount}`);
  console.log(`   Products:         ${products.length}`);
  console.log(`   Transactions:     ${txnCount}+`);
  console.log(`   Storage Zones:    ${zoneData.length}`);
  console.log(`   Warehouse Layouts: 2 (GRID 4×6, FREE L-shape)`);
  console.log(`   Positions:        ${Object.keys(gridPositions).length + freePosData.length}`);
  console.log(`   Stocktaking:      4 records`);
  console.log(`   Preliminary Checks: 30`);
  console.log(`   Activity Logs:    30`);
  console.log('');
  console.log('🔐 Login credentials:');
  console.log('   Admin:    hung@havias.asia       / admin@123');
  console.log('   Manager:  manager@inventory.com  / admin@123');
  console.log('   Staff:    staff1@inventory.com   / admin@123');
  console.log('');
  console.log('📋 Data spans: ~3 months of transactions');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
