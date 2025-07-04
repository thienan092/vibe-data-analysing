const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 10000;

// Sử dụng CORS để cho phép các yêu cầu từ tên miền khác
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Tăng giới hạn payload để nhận HTML

// --- HÀM HỖ TRỢ ---

// Hàm khởi tạo trình duyệt Puppeteer
async function launchBrowser() {
    return puppeteer.launch({
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
        headless: true,
    });
}

// Hàm gọi Gemini API
async function callGemini(apiKey, prompt, jsonMode = false) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    if (jsonMode) {
        const result = await model.generateContent(prompt + "\n\nChỉ trả về JSON, không có markdown.");
        const response = await result.response;
        let text = response.text();
        // Cố gắng làm sạch và parse JSON
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } else {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    }
}

// --- ENDPOINTS API ---

app.get('/', (req, res) => {
    res.status(200).send('Crawl4ai service is running! Version 2.0 (Production)');
});

app.post('/crawl', async (req, res) => {
    const { geminiApiKey, discoveryQuery } = req.body;

    if (!geminiApiKey) return res.status(400).json({ error: 'Thiếu Gemini API Key.' });
    if (!discoveryQuery) return res.status(400).json({ error: 'Thiếu discoveryQuery.' });

    console.log(`Nhận yêu cầu tìm kiếm cho: "${discoveryQuery}"`);
    let browser = null;

    try {
        // 1. Dùng Gemini để tìm URL
        console.log("Bước 1: Dùng Gemini tìm URL...");
        const urlPrompt = `Tìm kiếm trên Google các trang web bán hàng tại Việt Nam cho sản phẩm "${discoveryQuery}". Trả về một danh sách JSON của tối đa 3 URL sản phẩm trực tiếp. Định dạng: [{"sourceName": "Tên trang web", "url": "URL sản phẩm"}]`;
        const sources = await callGemini(geminiApiKey, urlPrompt, true);
        if (!sources || sources.length === 0) {
            return res.status(200).json([]);
        }
        console.log(`Đã tìm thấy ${sources.length} URL.`);

        // 2. Crawl và phân tích từng URL
        browser = await launchBrowser();
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');

        const results = [];
        for (const source of sources) {
            try {
                console.log(`Bước 2: Đang xử lý ${source.url}`);
                await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 30000 });
                const pageHtml = await page.content();

                // 3. Dùng Gemini để tìm selector
                console.log("Bước 3: Dùng Gemini tìm selector giá...");
                const selectorPrompt = `Phân tích mã HTML sau và tìm CSS selector chính xác nhất cho giá chính của sản phẩm. Chỉ trả về một đối tượng JSON có dạng {"selector": "your-css-selector"}. HTML: ${pageHtml.substring(0, 5000)}`;
                const { selector } = await callGemini(geminiApiKey, selectorPrompt, true);
                if (!selector) throw new Error("AI không tìm được selector.");

                // 4. Trích xuất giá bằng selector
                const priceText = await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    return el ? el.textContent.trim() : null;
                }, selector);

                if (!priceText) throw new Error("Không tìm thấy giá với selector của AI.");
                const price = parseFloat(priceText.replace(/[^0-9]/g, ''));
                if (isNaN(price)) throw new Error("Không phân tích được giá.");

                console.log(`Thành công: ${source.sourceName} - Giá: ${price}`);
                results.push({
                    status: 'success',
                    data: {
                        product: discoveryQuery,
                        sourceName: source.sourceName,
                        url: source.url,
                        price: price,
                        selector: selector
                    }
                });
            } catch (err) {
                console.warn(`Lỗi khi xử lý ${source.url}: ${err.message}`);
                results.push({ status: 'error', url: source.url, error: err.message });
            }
        }
        
        res.status(200).json(results);

    } catch (error) {
        console.error('Lỗi nghiêm trọng trong quá trình /crawl:', error);
        res.status(500).json({ error: `Lỗi server: ${error.message}` });
    } finally {
        if (browser) {
            await browser.close();
            console.log("Đã đóng trình duyệt.");
        }
    }
});

app.listen(port, () => {
    console.log(`Server đang lắng nghe tại cổng ${port}`);
});
