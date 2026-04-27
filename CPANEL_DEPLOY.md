# cPanel Deploy

## Frontend

1. Copy `frontend/.env.production.example` to `frontend/.env.production`.
2. Set:

   - `VITE_API_URL=https://ims-backend-trtc.onrender.com`
   - `VITE_APP_BASE_PATH=/iwms/`

3. Build and create zip:

   ```bash
   cd frontend
   npm run deploy:cpanel
   ```

4. Upload `frontend/dist-cpanel.zip` to cPanel.
5. Extract it into the exact folder that matches `VITE_APP_BASE_PATH`.

Example:

- If website URL is `https://domain.com/iwms/`, extract into `public_html/iwms/`
- If website URL is `https://domain.com/`, set `VITE_APP_BASE_PATH=/` and extract into `public_html/`

For your current setup:

- frontend URL: `https://havias.asia/iwms/`
- cPanel folder: `public_html/iwms/`

The build already includes:

- correct asset base path
- React Router basename
- `.htaccess` rewrite for SPA refresh

## Backend

If backend also runs on cPanel Node.js App:

1. Copy `backend/.env.example` to `backend/.env`.
2. Set production values:

   - `DATABASE_URL=mysql://DB_USER:DB_PASSWORD@localhost:3306/DB_NAME`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `CORS_ORIGIN=https://your-frontend-domain.com,https://www.your-frontend-domain.com`
   - `PUBLIC_API_URL=https://your-api-domain.com`

3. Install dependencies and build:

   ```bash
   cd backend
   npm install
    npm run prisma:generate
   npm run prisma:push
    npm run build
   ```

4. In cPanel Node.js App, point startup file to `dist/main.js`.
5. If you want sample data, run:

   ```bash
   npm run prisma:seed
   ```

6. Restart the Node.js app and test:

   `https://your-api-domain.com/api/health`

## Common causes of white screen

- `VITE_APP_BASE_PATH` does not match the folder on cPanel
- uploaded files went to `public_html/` while app was built for `/iwms/`
- `.htaccess` was not uploaded
- `VITE_API_URL` still points to localhost
- browser cache still has old JS/CSS
