import { PrismaClient, Role } from '@prisma/client/index';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'hung@havias.asia';
  const password = 'admin@123';
  const name = 'Hung Havias';
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: hashedPassword,
      role: Role.ADMIN,
      refreshToken: null,
    },
    create: {
      email,
      name,
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  console.log('Admin user is ready.');
  console.log(`Email: ${user.email}`);
  console.log(`Password: ${password}`);
  console.log(`Role: ${user.role}`);
}

main()
  .catch((error) => {
    console.error('Failed to seed admin user:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
