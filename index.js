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
        
        // Chuyển log từ bên trong trình duyệt ảo ra console của Node.js
        page.on('console', msg => console.log(`[BROWSER LOG] ${msg.text()}`));

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&tbm=shop`;
        
        console.log(`[INFO] Navigating to: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });

        // =================== PHẦN CẬP NHẬT CHÍNH ===================
        // Thêm log chi tiết vào bên trong hàm evaluate
        const products = await page.evaluate(() => {
            const results = [];
            
            // Định nghĩa các bộ chọn
            const selector1 = 'div.sh-pr__product-results-grid div.sh-dgr__content';
            const selector2 = '.sh-dgr__content';
            const selector3 = 'div.KZmu8e';

            // Thử bộ chọn 1
            console.log(`[DIAGNOSTIC] Trying selector 1: "${selector1}"`);
            let items = document.querySelectorAll(selector1);
            console.log(`[DIAGNOSTIC] Found ${items.length} items with selector 1.`);

            // Thử bộ chọn 2 (dự phòng)
            if (items.length === 0) {
                console.log(`[DIAGNOSTIC] Selector 1 failed. Trying selector 2: "${selector2}"`);
                items = document.querySelectorAll(selector2);
                console.log(`[DIAGNOSTIC] Found ${items.length} items with selector 2.`);
            }
            
            // Thử bộ chọn 3 (dự phòng)
            if (items.length === 0) {
                console.log(`[DIAGNOSTIC] Selector 2 failed. Trying selector 3: "${selector3}"`);
                items = document.querySelectorAll(selector3);
                console.log(`[DIAGNOSTIC] Found ${items.length} items with selector 3.`);
            }

            items.forEach((item, index) => {
                try {
                    // Thử nhiều bộ chọn cho từng chi tiết
                    const title = item.querySelector('h3.sh-np__product-title, h3.Xjkr3b')?.innerText;
                    const price = item.querySelector('.T14wmb > .a8Pemb, span.a8Pemb')?.innerText;
                    const source = item.querySelector('.E5ocAb, div.aULzUe')?.innerText;

                    if (title && price && source) {
                        results.push({ title, price, source });
                    } else {
                        // Log ra nếu một sản phẩm không đủ thông tin
                        console.log(`[DIAGNOSTIC] Item ${index + 1} is incomplete. Title: ${!!title}, Price: ${!!price}, Source: ${!!source}`);
                    }
                } catch (e) {
                    console.log(`[DIAGNOSTIC] Error processing item ${index + 1}: ${e.message}`);
                }
            });
            return results;
        });
        // =================== KẾT THÚC PHẦN CẬP NHẬT ===================

        console.log(`[INFO] Found and processed ${products.length} products successfully.`);
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

app.get('/', (req, res) => {
    res.status(200).send('Scraper service is running!');
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
