# Sử dụng base image Node.js 20 Alpine siêu nhẹ, khởi động nhanh và bảo mật cao
FROM node:20-alpine

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Biến môi trường mặc định
ENV NODE_ENV=production
ENV PORT=8080

# Sao chép file cấu hình và toàn bộ mã nguồn
COPY package.json ./
COPY server.js ./
COPY index.html ./
COPY test_ar.html ./
COPY assets/ ./assets/
COPY docs/ ./docs/
COPY README.md ./

# Mở cổng phục vụ
EXPOSE 8080

# Chạy server
CMD ["node", "server.js"]
