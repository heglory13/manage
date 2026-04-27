# Deploy

## Chay local

1. Bat MySQL local bang Docker:

```bash
docker compose -f docker-compose.local.yml up -d
```

2. Tao file env:

- `backend/.env`: copy tu `backend/.env.example`
- `frontend/.env`: copy tu `frontend/.env.example`

3. Cai package:

```bash
cd backend && npm install
cd ../frontend && npm install
```

4. Khoi tao database:

```bash
cd backend
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

5. Kiem tra nhanh truoc khi chay:

```bash
cd backend && npm test && npm run build
cd ../frontend && npm test && npm run build
```

6. Chay local:

```bash
cd backend && npm run start:dev
cd ../frontend && npm run dev
```

Mac dinh:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001/api`
- Tai khoan admin mac dinh: `admin@inventory.com` / `admin123`

## Backend on DirectAdmin / VPS with MySQL

1. Tao MySQL database va user trong `MySQL Management`.
2. Tao file env:

```env
DATABASE_URL=mysql://DB_USER:DB_PASSWORD@localhost:3306/DB_NAME
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
CORS_ORIGIN=https://your-frontend-domain.com
PUBLIC_API_URL=https://your-api-domain.com
AUTO_SEED=false
```

3. Upload backend source len server.
4. Cai package va tao schema:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:push
npm run build
```

5. Neu can du lieu mau:

```bash
npm run prisma:seed
```

6. Cho app Node.js chay bang `dist/main.js`.
7. Kiem tra health:

`https://your-api-domain.com/api/health`

## Frontend on Vercel

1. Import repo len Vercel.
2. Root Directory: `frontend`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Them env:

`VITE_API_URL=https://your-render-backend.onrender.com`

`VITE_APP_BASE_PATH=/`

6. Deploy.

## Frontend on VPS/Subfolder

Neu frontend duoc deploy duoi subfolder, vi du `https://havias.asia/iwms/`, can them env khi build:

`VITE_APP_BASE_PATH=/iwms/`

Khi do:

- Vite se build asset voi base path `/iwms/`
- React Router se match route theo `/iwms/...`
- Redirect 401 se quay ve `/iwms/login`

Voi Nginx, can rewrite SPA ve `index.html`, vi du:

```nginx
location /iwms/ {
    alias /var/www/iwms/;
    try_files $uri $uri/ /iwms/index.html;
}
```

## Notes

- Frontend da doc API tu `VITE_API_URL`; neu khong co bien nay thi local dev van dung `/api`.
- File [frontend/vercel.json](./frontend/vercel.json) da cau hinh SPA rewrite de refresh trang khong bi 404.
- Bo migrations SQL cu duoc tao tu PostgreSQL. Voi MySQL moi, uu tien dung `npm run prisma:push` de dong bo schema.
