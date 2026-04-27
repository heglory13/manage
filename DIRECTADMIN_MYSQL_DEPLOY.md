# DirectAdmin MySQL Deploy

## Gia dinh deploy

- Frontend URL: `https://havias.asia/iwms/`
- Backend URL: `https://api.havias.asia`
- Database: MySQL trong `MySQL Management`

## 1. Tao database MySQL

Trong DirectAdmin:

1. Vao `MySQL Management`
2. Tao database moi
3. Tao user moi va cap quyen cho database
4. Ghi lai:
   - `DB_NAME`
   - `DB_USER`
   - `DB_PASSWORD`
   - `DB_HOST`

Thuong `DB_HOST` tren hosting la `localhost`.

## 2. Tao subdomain cho backend

1. Vao `Subdomain Management`
2. Tao subdomain: `api`
3. Bat SSL trong `SSL Certificates`

Sau buoc nay backend se dung:

`https://api.havias.asia`

## 3. Cau hinh backend

Tao file env cho backend:

```env
DATABASE_URL=mysql://DB_USER:DB_PASSWORD@localhost:3306/DB_NAME
JWT_SECRET=change-this-to-a-long-random-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change-this-to-a-second-long-random-secret
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=https://havias.asia,https://www.havias.asia,https://havias.asia/iwms
PUBLIC_API_URL=https://api.havias.asia
AUTO_SEED=false
```

## 4. Upload backend

Trong `Setup Node.js App`:

1. Chon Node.js `20` neu co, neu khong thi dung `18`
2. App root: vi du `nodeapps/backend`
3. App URL: `/`
4. Startup file: de sau, se dat la `dist/main.js`

Upload source backend vao thu muc app root.

Can upload:

- `src/`
- `prisma/`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `tsconfig.build.json`
- `nest-cli.json`

Khong can upload `node_modules`.

## 5. Build backend tren hosting

Neu hosting co Terminal hoac command runner:

```bash
cd ~/nodeapps/backend
npm install
npm run prisma:generate
npm run prisma:push
npm run build
```

Neu muon nap du lieu mau:

```bash
npm run prisma:seed
```

Sau do dat startup file:

```bash
dist/main.js
```

Va restart app.

## 6. Kiem tra backend

Mo:

`https://api.havias.asia/api/health`

Neu endpoint nay len thi backend da chay.

## 7. Build frontend

File [frontend/.env.production](/d:/Code_vo_van/manage/frontend/.env.production:1) da duoc set:

```env
VITE_API_URL=https://api.havias.asia
VITE_APP_BASE_PATH=/iwms/
```

Build tren may ban:

```bash
cd frontend
npm install
npm run deploy:cpanel
```

File tao ra:

`frontend/dist-cpanel.zip`

## 8. Upload frontend

Trong DirectAdmin:

1. Vao `File Manager`
2. Mo `public_html`
3. Tao thu muc `iwms` neu chua co
4. Upload `dist-cpanel.zip` vao `public_html/iwms/`
5. Giai nen ngay trong `public_html/iwms/`

Kiem tra sau giai nen phai co:

- `index.html`
- `.htaccess`
- `assets/`

## 9. Kiem tra frontend

Mo:

`https://havias.asia/iwms/`

## 10. Loi hay gap

- `DATABASE_URL` sai user/password/dbname
- Quen chay `npm run prisma:push`
- Startup file backend sai, khong phai `dist/main.js`
- Frontend upload sai thu muc, dang build `/iwms/` nhung lai giai nen vao `public_html/`
- Thieu file `.htaccess`
- Chua bat SSL cho `api.havias.asia`
