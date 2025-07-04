# Sử dụng phiên bản Node.js 20 gọn nhẹ
FROM node:20-slim

# Thiết lập thư mục làm việc
WORKDIR /usr/src/app

# Cài đặt các thư viện cần thiết cho trình duyệt Chrome chạy ẩn
# Đây là bước quan trọng để Puppeteer hoạt động trên server
RUN apt-get update && apt-get install -yq \
    gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 \
    libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 \
    libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 \
    libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation \
    libappindicator1 libnss3 lsb-release xdg-utils wget \
    --no-install-recommends

# Sao chép file package.json để cài đặt các gói phụ thuộc
COPY package*.json ./

# Chạy lệnh cài đặt
RUN npm install

# Sao chép toàn bộ mã nguồn còn lại
COPY . .

# Mở cổng 10000 để dịch vụ có thể nhận yêu cầu
EXPOSE 10000

# Lệnh để khởi động dịch vụ
CMD [ "npm", "start" ]