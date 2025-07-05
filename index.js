const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware để cho phép CORS (Cross-Origin Resource Sharing)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
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
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&tbm=shop`;
        
        console.log(`[INFO] Navigating to: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });

        // =================== PHẦN CẬP NHẬT CHÍNH ===================
        // Các selector đã được thay đổi để phù hợp với cấu trúc HTML mới của Google.
        const products = await page.evaluate(() => {
            const results = [];
            // Selector mới cho từng thẻ chứa sản phẩm
            const items = document.querySelectorAll('.sh-dgr__content');

            items.forEach(item => {
                try {
                    // Selector mới cho tiêu đề
                    const title = item.querySelector('h3.sh-np__product-title')?.innerText;
                    // Selector mới cho giá
                    const price = item.querySelector('.T14wmb > .a8Pemb')?.innerText;
                    // Selector mới cho nguồn cung cấp
                    const source = item.querySelector('.E5ocAb')?.innerText;

                    if (title && price && source) {
                        results.push({ title, price, source });
                    }
                } catch (e) {
                    // Bỏ qua nếu có lỗi ở một sản phẩm cụ thể
                }
            });
            return results;
        });
        // =================== KẾT THÚC PHẦN CẬP NHẬT ===================

        console.log(`[INFO] Found ${products.length} products.`);
        res.status(200).json(products);

    } catch (error) {
        console.error('[ERROR] Scraping failed:', error);
        res.status(500).json({ error: 'Failed to scrape data. The website structure might have changed or the service encountered an error.' });
    } finally {
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
