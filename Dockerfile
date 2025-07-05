# Bước 1: Chọn một image Node.js làm nền tảng
# Sử dụng phiên bản 18-slim để có kích thước nhỏ gọn
FROM node:18-slim

# Thiết lập thư mục làm việc bên trong container
WORKDIR /usr/src/app

# Sao chép file package.json và package-lock.json (nếu có)
# Việc này giúp tận dụng cache của Docker, chỉ cài lại thư viện khi có thay đổi
COPY package*.json ./

# Cài đặt các thư viện cần thiết cho Puppeteer trên Debian (hệ điều hành của image)
# Điều này rất quan trọng để Puppeteer có thể chạy
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    --no-install-recommends

# Cài đặt các thư viện Node.js từ package.json
RUN npm install --production

# Sao chép toàn bộ mã nguồn của ứng dụng vào thư mục làm việc
COPY . .

# Mở cổng 3001 để có thể truy cập từ bên ngoài container
# Render sẽ tự động map cổng này
EXPOSE 3001

# Lệnh để khởi động ứng dụng khi container chạy
CMD [ "node", "index.js" ]
