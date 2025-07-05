const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
// Render.com sẽ tự động cung cấp biến PORT
const PORT = process.env.PORT || 3001;

// Middleware để cho phép CORS (Cross-Origin Resource Sharing)
// Điều này rất quan trọng để trang web của bạn có thể gọi API này
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Cho phép tất cả các domain
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Endpoint chính để thực hiện việc scrape
app.get('/scrape', async (req, res) => {
    const { keyword } = req.query;

    if (!keyword) {
        return res.status(400).json({ error: 'Keyword is required' });
    }

    console.log(`[INFO] Received job for keyword: "${keyword}"`);

    let browser = null;
    try {
        // Khởi tạo trình duyệt ảo Puppeteer với các tùy chọn cần thiết cho môi trường server (như Render)
        browser = await puppeteer.launch({
            headless: true, // Chạy ở chế độ không giao diện
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Cần thiết cho các môi trường container
                '--single-process'
            ]
        });

        const page = await browser.newPage();
        
        // Giả lập User-Agent của một trình duyệt thông thường để tránh bị phát hiện
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Tạo URL tìm kiếm trên Google Shopping
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&tbm=shop`;
        
        console.log(`[INFO] Navigating to: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2' }); // Chờ trang tải xong

        // Bóc tách dữ liệu từ trang web
        // LƯU Ý QUAN TRỌNG: Các selector (class name) của Google có thể thay đổi bất cứ lúc nào.
        // Nếu script không hoạt động, bạn cần vào Google Shopping, dùng "Inspect" để tìm class name mới.
        const products = await page.evaluate(() => {
            const results = [];
            // Selector cho mỗi item sản phẩm
            const items = document.querySelectorAll('.sh-dgr__gr-auto .sh-dgr__content');

            items.forEach(item => {
                try {
                    const title = item.querySelector('h3.tAxDx')?.innerText;
                    const price = item.querySelector('span.a8Pemb')?.innerText;
                    const source = item.querySelector('div.aULzUe')?.innerText;

                    // Chỉ thêm vào kết quả nếu có đủ thông tin
                    if (title && price && source) {
                        results.push({ title, price, source });
                    }
                } catch (e) {
                    // Bỏ qua nếu có lỗi ở một sản phẩm cụ thể
                }
            });
            return results;
        });

        console.log(`[INFO] Found ${products.length} products.`);
        res.status(200).json(products);

    } catch (error) {
        console.error('[ERROR] Scraping failed:', error);
        res.status(500).json({ error: 'Failed to scrape data. The website structure might have changed or the service encountered an error.' });
    } finally {
        // Luôn luôn đóng trình duyệt ảo để giải phóng tài nguyên
        if (browser) {
            await browser.close();
            console.log('[INFO] Browser closed.');
        }
    }
});

// Endpoint kiểm tra sức khỏe (health check)
app.get('/', (req, res) => {
    res.status(200).send('Scraper service is running!');
});


app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
