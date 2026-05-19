import { PrismaClient, Role } from '@prisma/client/index';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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
    'order_plans',
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
  console.log('✅ Đã xoá toàn bộ dữ liệu cũ');
}

async function main() {
  await truncateAll();

  const hashedPassword = await bcrypt.hash('admin@123', 10);

  await prisma.user.create({
    data: {
      email: 'hung@havias.asia',
      password: hashedPassword,
      name: 'Hung Havias',
      role: Role.ADMIN,
    },
  });

  console.log('✅ Tạo tài khoản Admin thành công');
  console.log('   Email: hung@havias.asia | Role: ADMIN');
  console.log('   ⚠️  Đổi mật khẩu ngay sau lần đăng nhập đầu tiên!');
}

main()
  .catch((e) => {
    console.error('❌ Seed thất bại:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
