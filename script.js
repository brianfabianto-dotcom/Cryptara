// ==================== KONSTANTA ====================
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// ==================== FUNGSI FORMAT ANGKA ====================
function formatNumberID(num) {
    if (num === null || num === undefined) return "0";
    if (typeof num === 'string') num = parseFloat(num.replace(/\./g, ''));
    if (isNaN(num)) return "0";
    const isEN = (typeof currentLang !== 'undefined' && currentLang === 'en');
    if (num >= 1e12) return (num / 1e12).toFixed(2) + " T";
    if (num >= 1e9) return (num / 1e9).toFixed(2) + (isEN ? " B" : " M");
    if (num >= 1e6) return (num / 1e6).toFixed(2) + (isEN ? " M" : " Jt");
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatCurrencyUSD(num) {
    if (num === null || num === undefined) return "$0";
    return "$" + formatNumberID(num);
}

function formatNumber(num) {
    if (num === null || num === undefined) return "0";
    if (typeof num === 'string') num = parseFloat(num);
    return num.toLocaleString('id-ID');
}

// ==================== LIVE TICKER (HARGA USDT) ====================
async function fetchTickerData() {
    const tickerWrap = document.getElementById('ticker-wrap');
    if (!tickerWrap) return;

    // Fetch harga USDT/IDR real dari Indodax (via CORS proxy)
    async function getIndodaxPrice() {
        const url = encodeURIComponent('https://indodax.com/api/ticker/usdtidr');
        const res = await fetch(CORS_PROXY + url);
        const data = await res.json();
        return parseFloat(data.ticker.last);
    }

    // Fetch harga USDT/IDR real dari Binance (digunakan Tokocrypto)
    async function getBinancePrice() {
        const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTIDR');
        const data = await res.json();
        return parseFloat(data.price);
    }

    // Fallback: estimasi kurs via exchangerate-api
    async function getKursIdr() {
        try {
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            const data = await response.json();
            return data.rates.IDR || 16000;
        } catch {
            return 16000;
        }
    }

    const exchanges = [
        { name: 'Indodax', logo: 'https://www.google.com/s2/favicons?domain=indodax.com&sz=32', fetch: getIndodaxPrice, est: false },
        { name: 'Tokocrypto', logo: 'https://www.google.com/s2/favicons?domain=tokocrypto.com&sz=32', fetch: getBinancePrice, est: true },
        { name: 'Binance', logo: 'https://www.google.com/s2/favicons?domain=binance.com&sz=32', fetch: getBinancePrice, est: false },
        { name: 'Pintu', logo: 'https://www.google.com/s2/favicons?domain=pintu.co.id&sz=32', fetch: null, est: true },
        { name: 'Bybit', logo: 'https://www.google.com/s2/favicons?domain=bybit.com&sz=32', fetch: null, est: true },
    ];

    // Ambil harga Indodax dan Binance secara paralel untuk referensi estimasi
    let indodaxPrice = 0;
    let binancePrice = 0;
    try { indodaxPrice = await getIndodaxPrice(); } catch (e) { console.warn('Gagal fetch harga Indodax:', e); }
    try { binancePrice = await getBinancePrice(); } catch (e) { console.warn('Gagal fetch harga Binance:', e); }

    // Jika keduanya gagal, gunakan estimasi kurs
    const fallbackKurs = await getKursIdr();
    const refPrice = indodaxPrice || binancePrice || fallbackKurs;

    const results = await Promise.all(
        exchanges.map(async (ex) => {
            if (ex.fetch === getIndodaxPrice) {
                return { ...ex, price: indodaxPrice || refPrice };
            }
            if (ex.fetch === getBinancePrice) {
                // Tokocrypto (est: true): menggunakan Binance engine, harga sama tapi ditampilkan sebagai estimasi
                // Binance (est: false): harga real dari API Binance
                return { ...ex, price: binancePrice || refPrice };
            }
            // Exchange tanpa public API → estimasi berdasarkan harga referensi
            return { ...ex, price: refPrice };
        })
    );

    let html = '';
    for (let i = 0; i < 2; i++) {
        results.forEach((ex) => {
            const label = ex.est ? `${ex.name} (est.)` : ex.name;
            html += `<div class="ticker-item"><img src="${ex.logo}" alt="${ex.name}" class="ticker-logo">${label}: <span>Rp ${formatNumberID(Math.round(ex.price))}</span></div>`;
        });
    }
    tickerWrap.innerHTML = html;
}

// ==================== NEWS API ====================
async function fetchNews() {
    const newsContainer = document.getElementById('news-items');
    if (!newsContainer) return;

    newsContainer.innerHTML = '<div class="loading">Memuat berita...</div>';

    const sources = [
        async () => {
            const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&limit=5');
            if (!res.ok) throw new Error('CryptoCompare gagal');
            const data = await res.json();
            if (data && data.Data && data.Data.length > 0) return data.Data;
            throw new Error('Data CryptoCompare kosong');
        },
        async () => {
            const url = encodeURIComponent('https://www.reddit.com/r/CryptoCurrency/.rss');
            const res = await fetch(CORS_PROXY + url);
            const text = await res.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');
            const items = xml.querySelectorAll('item');
            if (items.length === 0) throw new Error('Reddit RSS kosong');
            return Array.from(items).slice(0, 5).map((item) => ({
                title: item.querySelector('title').textContent,
                url: item.querySelector('link').textContent,
                source: 'Reddit r/CryptoCurrency',
                published_on: new Date(item.querySelector('pubDate').textContent).getTime() / 1000,
            }));
        },
        async () => {
            const url = encodeURIComponent('https://cointelegraph.com/rss');
            const res = await fetch(CORS_PROXY + url);
            const text = await res.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');
            const items = xml.querySelectorAll('item');
            if (items.length === 0) throw new Error('Cointelegraph RSS kosong');
            return Array.from(items).slice(0, 5).map((item) => ({
                title: item.querySelector('title').textContent,
                url: item.querySelector('link').textContent,
                source: 'Cointelegraph',
                published_on: new Date(item.querySelector('pubDate').textContent).getTime() / 1000,
            }));
        },
    ];

    for (const source of sources) {
        try {
            const articles = await source();
            if (articles && articles.length > 0) {
                displayNews(articles);
                return;
            }
        } catch (error) {
            console.warn('Sumber berita gagal:', error);
        }
    }

    newsContainer.innerHTML = `
        <div class="loading">
            Berita tidak tersedia.
            <button onclick="fetchNews()" class="refresh-btn">Coba lagi</button>
        </div>
    `;
}

function displayNews(articles) {
    const container = document.getElementById('news-items');
    let html = '';
    articles.slice(0, 5).forEach((item) => {
        const date = item.published_on
            ? new Date(item.published_on * 1000).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
              })
            : '';

        html += `
            <div class="news-card">
                <a href="${item.url}" target="_blank">${item.title}</a>
                <div class="news-meta">
                    <span>${item.source}</span>
                    <span>${date}</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ==================== MARKET UPDATE (4 COIN POPULER) ====================
async function fetchMarketData() {
    const marketContainer = document.getElementById('market-items');
    if (!marketContainer) return;

    const cached = localStorage.getItem('marketData');
    const cachedTime = localStorage.getItem('marketDataTime');
    const now = Date.now();

    if (cached && cachedTime && now - parseInt(cachedTime) < 300000) {
        displayMarketData(JSON.parse(cached));
        return;
    }

    marketContainer.innerHTML = '<div class="loading">Memuat data...</div>';

    try {
        const response = await fetch('https://api.coinlore.net/api/tickers/?start=0&limit=4');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (result && result.data && result.data.length > 0) {
            localStorage.setItem('marketData', JSON.stringify(result.data));
            localStorage.setItem('marketDataTime', now.toString());
            displayMarketData(result.data);
        } else {
            throw new Error('Data tidak valid');
        }
    } catch (error) {
        console.error('Gagal memuat market:', error);
        const oldCache = localStorage.getItem('marketData');
        if (oldCache) {
            displayMarketData(JSON.parse(oldCache));
        } else {
            const dummyData = [
                { id: '90', name: 'Bitcoin', symbol: 'BTC', price_usd: '65000', percent_change_24h: '2.5' },
                { id: '80', name: 'Ethereum', symbol: 'ETH', price_usd: '3500', percent_change_24h: '-1.2' },
                { id: '518', name: 'Tether', symbol: 'USDT', price_usd: '1.00', percent_change_24h: '0.01' },
                { id: '2', name: 'Litecoin', symbol: 'LTC', price_usd: '120', percent_change_24h: '0.5' },
            ];
            displayMarketData(dummyData);
        }
    }
}

function displayMarketData(coins) {
    const container = document.getElementById('market-items');
    if (!container) return;

    let html = '';
    const selectedCoins = coins.slice(0, 4);
    selectedCoins.forEach((coin) => {
        const price = parseFloat(coin.price_usd) || 0;
        const change = parseFloat(coin.percent_change_24h) || 0;
        const changeClass = change >= 0 ? 'market-change' : 'market-change negative';
        const changeSign = change >= 0 ? '▲' : '▼';
        const symbolLower = coin.symbol.toLowerCase();
        const logoUrl = `https://assets.coincap.io/assets/icons/${symbolLower}@2x.png`;
        const fallbackLetter = coin.name.charAt(0).toUpperCase();
        html += `
            <div class="market-item" onclick="window.location.href='coin.html?id=${coin.id}'">
                <span class="market-left">
                    <img src="${logoUrl}" alt="${coin.symbol}" class="market-coin-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';">
                    <span class="market-coin-fallback" style="display:none;">${fallbackLetter}</span>
                    ${coin.name} (${coin.symbol})
                </span>
                <div class="market-right">
                    <span class="market-price">${formatCurrencyUSD(price)}</span>
                    <span class="${changeClass}">${changeSign} ${Math.abs(change).toFixed(2)}%</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ==================== ANIMATED COUNTER ====================
function animateCounters() {
    const counters = document.querySelectorAll('.stat-number[data-target]');
    const speed = 200;

    counters.forEach((counter) => {
        const target = parseInt(counter.getAttribute('data-target'));
        let current = 0;
        const increment = Math.ceil(target / speed);

        function updateCount() {
            current += increment;
            if (current >= target) {
                counter.innerText = formatNumberID(target);
                return;
            }
            counter.innerText = formatNumberID(current);
            requestAnimationFrame(updateCount);
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        counter.innerText = '0';
                        updateCount();
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.3 }
        );
        observer.observe(counter);
    });
}

// ==================== PARTICLE CANVAS ====================
function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        initParticlesArray();
    }

    function initParticlesArray() {
        particles = [];
        for (let i = 0; i < 60; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.2,
                vy: (Math.random() - 0.5) * 0.2,
                size: Math.random() * 2 + 0.5,
            });
        }
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#FF5E00';
        ctx.shadowColor = '#FF5E00';
        ctx.shadowBlur = 6;

        particles.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();

            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;
        });

        requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    draw();
}

// ==================== LOAD LOGO DENGAN COINGECKO API ====================
async function loadCoinLogo(coin, containerId) {
    const iconElement = document.getElementById(containerId);
    if (!iconElement) return;

    iconElement.innerHTML = '';

    // Mapping simbol ke CoinGecko ID (pastikan ID benar)
    const coinGeckoIds = {
        'usdt': 'tether',
        'usdc': 'usd-coin',
        'busd': 'binance-usd',
        'dai': 'dai',
        'frax': 'frax',
        'lusd': 'liquity-usd',
        'pyusd': 'paypal-usd',
        'fdusd': 'first-digital-usd',
        'usds': 'usds',
        'usde': 'ethena'
    };

    const coinId = coinGeckoIds[coin.symbol.toLowerCase()];
    if (!coinId) {
        // Jika tidak ada mapping, langsung fallback
        showFallback();
        return;
    }

    // Timeout 5 detik
    const timeout = setTimeout(() => {
        console.warn(`Timeout: CoinGecko untuk ${coin.symbol}`);
        showFallback();
    }, 5000);

    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        clearTimeout(timeout);

        const logoUrl = data.image?.small || data.image?.thumb;
        if (logoUrl) {
            const img = new Image();
            img.onload = () => {
                iconElement.innerHTML = '';
                iconElement.appendChild(img);
                iconElement.style.backgroundColor = 'transparent';
            };
            img.onerror = () => showFallback();
            img.src = logoUrl;
            img.alt = coin.name;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
        } else {
            showFallback();
        }
    } catch (error) {
        clearTimeout(timeout);
        console.warn(`CoinGecko error untuk ${coin.symbol}:`, error);
        showFallback();
    }

    function showFallback() {
        iconElement.innerHTML = coin.symbol.charAt(0).toUpperCase();
        iconElement.style.display = 'flex';
        iconElement.style.alignItems = 'center';
        iconElement.style.justifyContent = 'center';
        iconElement.style.fontSize = '1.2rem';
        iconElement.style.fontWeight = 'bold';
        iconElement.style.backgroundColor = '#2a2a2a';
        iconElement.style.color = '#ff8a00';
    }
}

// ==================== HAMBURGER MENU ====================
document.addEventListener('DOMContentLoaded', function () {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function (e) {
            e.stopPropagation();
            navLinks.classList.toggle('active');
            hamburger.textContent = navLinks.classList.contains('active') ? '✕' : '☰';
        });

        document.addEventListener('click', function (e) {
            if (!navLinks.contains(e.target) && !hamburger.contains(e.target)) {
                navLinks.classList.remove('active');
                hamburger.textContent = '☰';
            }
        });

        navLinks.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                navLinks.classList.remove('active');
                hamburger.textContent = '☰';
            });
        });
    }
});

// ==================== SECURITY & ANTI-SCRAPING ====================
(function () {
    // Console warning for potential scrapers
    console.log('%c⚠ STOP!', 'color: #FF5E00; font-size: 2rem; font-weight: bold;');
    console.log('%cThis is a browser feature intended for developers. If someone told you to paste something here, it is a scam.', 'font-size: 1rem;');

    // Rate limiter: track rapid calls per key
    const _rateLimitMap = {};
    window.Cryptara = window.Cryptara || {};
    window.Cryptara.checkRateLimit = function (key, maxCalls, windowMs) {
        const now = Date.now();
        if (!_rateLimitMap[key]) _rateLimitMap[key] = [];
        _rateLimitMap[key] = _rateLimitMap[key].filter(t => now - t < windowMs);
        if (_rateLimitMap[key].length >= maxCalls) return false;
        _rateLimitMap[key].push(now);
        return true;
    };
})();

// ==================== INITIAL CALLS ====================
document.addEventListener('DOMContentLoaded', function () {
    setLanguage(currentLang);

    fetchTickerData();
    setInterval(fetchTickerData, 30000);

    fetchNews();
    setInterval(fetchNews, 60000);

    fetchMarketData();
    setInterval(fetchMarketData, 60000);

    animateCounters();
    initParticles();

    // Honeypot: invisible element to detect bots
    const honeypot = document.createElement('a');
    honeypot.href = '/honeypot-bot-trap';
    honeypot.style.cssText = 'position:absolute;left:-9999px;top:-9999px;opacity:0;pointer-events:none;';
    honeypot.setAttribute('aria-hidden', 'true');
    honeypot.setAttribute('tabindex', '-1');
    document.body.appendChild(honeypot);

    if (typeof VanillaTilt !== 'undefined') {
        VanillaTilt.init(document.querySelectorAll('.card'), {
            max: 5,
            speed: 300,
            glare: false,
            gyroscope: true,
        });
    }
});