# Deploy

## Backend on Render

1. Push repo này lên GitHub.
2. Trên Render, chọn `New +` -> `Blueprint`.
3. Chọn repo chứa project này.
4. Render sẽ đọc file [render.yaml](./render.yaml) và tạo:
   - `ims-postgres`
   - `ims-backend`
5. Sau khi Render tạo service xong, vào `ims-backend` và sửa env `CORS_ORIGIN` thành domain Vercel thật của frontend.
6. Nếu không muốn seed dữ liệu mẫu mỗi môi trường mới, đổi `AUTO_SEED=false`.

Backend URL sẽ có dạng:

`https://ims-backend.onrender.com`

Health check:

`https://ims-backend.onrender.com/health`

## Frontend on Vercel

1. Import repo lên Vercel.
2. Root Directory: `frontend`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Thêm env:

`VITE_API_URL=https://your-render-backend.onrender.com`

6. Deploy.

## Notes

- Frontend đã đọc API từ `VITE_API_URL`; nếu không có biến này thì local dev vẫn dùng `/api`.
- File [frontend/vercel.json](./frontend/vercel.json) đã cấu hình SPA rewrite để refresh trang không bị 404.
