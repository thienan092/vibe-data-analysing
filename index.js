const express = require('express');
const puppeteer = require('puppeteer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3001;

// --- CẤU HÌNH QUAN TRỌNG ---
// Bạn cần lấy API Key từ Google AI Studio và điền vào đây.
// Để bảo mật, hãy sử dụng biến môi trường trên Render.com.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY";

// Cấu hình Proxy chuyên nghiệp (ví dụ: Bright Data, Oxylabs)
// Thay thế bằng thông tin đăng nhập proxy của bạn.
const PROXY_USERNAME = process.env.PROXY_USERNAME || "YOUR_PROXY_USERNAME";
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || "YOUR_PROXY_PASSWORD";
const PROXY_HOST = process.env.PROXY_HOST || "brd.superproxy.io";
const PROXY_PORT = process.env.PROXY_PORT || "22225";
const PROXY_URL = `http://${PROXY_USERNAME}:${PROXY_PASSWORD}@${PROXY_HOST}:${PROXY_PORT}`;

// Khởi tạo Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Middleware cho CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.get('/scrape', async (req, res) => {
    const { keyword } = req.query;
    if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

    console.log(`[AI-JOB] Received job for keyword: "${keyword}"`);

    if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY" || PROXY_USERNAME === "YOUR_PROXY_USERNAME") {
        console.error("[CONFIG ERROR] Gemini API Key or Proxy credentials are not set.");
        return res.status(500).json({ error: 'Server configuration is incomplete. Please set API keys and proxy credentials.' });
    }

    let browser = null;
    try {
        console.log('[PROXY] Connecting via proxy...');
        browser = await puppeteer.launch({
            headless: true,
            args: [
                `--proxy-server=${PROXY_URL}`,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
            ],
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&tbm=shop`;
        console.log(`[INFO] Navigating to: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

        // Lấy toàn bộ nội dung HTML của trang
        const htmlContent = await page.content();
        console.log(`[INFO] Successfully retrieved HTML content (${(htmlContent.length / 1024).toFixed(2)} KB).`);
        
        await browser.close();
        console.log('[INFO] Browser closed. Sending HTML to Gemini AI for parsing.');

        // Tạo prompt cho Gemini
        const prompt = `
            Please act as an expert data extractor. Analyze the following HTML content from a Google Shopping search result page.
            Extract the product information for each item listed.
            Your response MUST be a valid JSON array. Each object in the array should have the following keys: "title", "price", and "source".
            If you cannot find any products, return an empty array [].
            Do not include any explanation or introductory text, only the JSON array.

            HTML Content:
            \`\`\`html
            ${htmlContent}
            \`\`\`
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        
        // Làm sạch output của AI để đảm bảo nó là JSON
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        console.log('[AI-RESPONSE] Gemini AI parsed the data. Sending to client.');
        
        // Parse và trả về kết quả
        const products = JSON.parse(text);
        res.status(200).json(products);

    } catch (error) {
        console.error('[ERROR] AI-Scraping failed:', error);
        if (browser) await browser.close();
        res.status(500).json({ error: 'An error occurred during the AI-powered scraping process.' });
    }
});

app.get('/', (req, res) => res.status(200).send('AI Scraper service is running!'));

app.listen(PORT, () => console.log(`AI Scraper Server is listening on port ${PORT}`));
