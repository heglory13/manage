# Inventory Management System - Backend

## Setup Database

1. Cài đặt PostgreSQL và tạo database:
```bash
createdb inventory_management
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Cập nhật DATABASE_URL trong file .env

4. Chạy migration và seed:
```bash
npm run prisma:migrate
npm run prisma:seed
```

## Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Start development server
npm run start:dev
```

## Database Commands

```bash
# Create and apply migration
npm run prisma:migrate

# Seed database
npm run prisma:seed

# Open Prisma Studio
npm run prisma:studio

# Reset database (careful!)
npm run db:reset
```

## Default Admin User

- Email: `admin@inventory.com`
- Password: `admin123`
- Role: `ADMIN`