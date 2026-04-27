## Upload Ready

Muc tieu:

- Frontend: `https://havias.asia/iwms/`
- Backend: `https://api.havias.asia`
- Database: MySQL tren chinh DirectAdmin

### File da san sang

- Frontend zip de upload:
  - [dist-cpanel.zip](/d:/Code_vo_van/manage/frontend/dist-cpanel.zip:1)
- Backend zip de upload:
  - [backend-directadmin-upload.zip](/d:/Code_vo_van/manage/deploy_artifacts/backend-directadmin-upload.zip:1)
- Huong dan chi tiet:
  - [DIRECTADMIN_MYSQL_DEPLOY.md](/d:/Code_vo_van/manage/DIRECTADMIN_MYSQL_DEPLOY.md:1)

### Ban chi can lam tren DirectAdmin

1. Tao MySQL database + user trong `MySQL Management`
2. Tao subdomain `api.havias.asia`
3. Bat SSL cho `havias.asia` va `api.havias.asia`
4. Upload frontend zip vao `public_html/iwms/` roi giai nen
5. Tao `Setup Node.js App` cho backend
6. Upload backend zip vao thu muc app root roi giai nen
7. Tao file `.env` cho backend tu [backend/.env.directadmin.example](/d:/Code_vo_van/manage/backend/.env.directadmin.example:1)
8. Chay lenh:

```bash
npm install
npm run prisma:generate
npm run prisma:push
```

Neu muon co du lieu mau:

```bash
npm run prisma:seed
```

9. Dat startup file:

```bash
dist/main.js
```

10. Restart app

### Luu y

- Frontend da build san voi `VITE_API_URL=https://api.havias.asia`
- Backend da doi sang MySQL
- Khong dung `prisma migrate deploy` cho database moi nay, dung `npm run prisma:push`
