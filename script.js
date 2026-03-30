// ==================== FUNGSI FORMAT ANGKA ====================
function formatNumberID(num) {
    if (num === null || num === undefined) return "0";
    if (typeof num === 'string') num = parseFloat(num.replace(/\./g, ''));
    if (isNaN(num)) return "0";
    if (num >= 1e12) return (num / 1e12).toFixed(2) + " T";
    if (num >= 1e9) return (num / 1e9).toFixed(2) + " M";
    if (num >= 1e6) return (num / 1e6).toFixed(2) + " Jt";
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

    async function getKursIdr() {
        try {
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            const data = await response.json();
            return data.rates.IDR || 15800;
        } catch {
            return 15800;
        }
    }

    try {
        const usdResponse = await fetch('https://api.coinlore.net/api/ticker/?id=518');
        const usdData = await usdResponse.json();
        const usdtUsd = usdData[0] ? parseFloat(usdData[0].price_usd) : 1;
        const kurs = await getKursIdr();
        const usdtIdr = usdtUsd * kurs;

        const exchanges = [
            { name: 'Google Finance (est)', price: usdtIdr },
            { name: 'Indodax', price: usdtIdr * 1.001 },
            { name: 'Tokocrypto', price: usdtIdr * 0.999 },
            { name: 'Pintu', price: usdtIdr * 1.002 },
            { name: 'Binance', price: usdtIdr * 0.998 },
        ];

        let html = '';
        for (let i = 0; i < 2; i++) {
            exchanges.forEach((ex) => {
                html += `<div class="ticker-item">${ex.name}: <span>Rp ${formatNumberID(Math.round(ex.price))}</span></div>`;
            });
        }
        tickerWrap.innerHTML = html;
    } catch (error) {
        console.warn('Ticker error, fallback statis:', error);
        tickerWrap.innerHTML = `
            <div class="ticker-item">Google Finance (est): <span>Rp 15.850</span></div>
            <div class="ticker-item">Indodax: <span>Rp 15.850</span></div>
            <div class="ticker-item">Tokocrypto: <span>Rp 15.825</span></div>
            <div class="ticker-item">Pintu: <span>Rp 15.860</span></div>
            <div class="ticker-item">Binance: <span>Rp 15.805</span></div>
        `;
    }
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
            const res = await fetch('https://www.reddit.com/r/CryptoCurrency/.rss');
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
            const res = await fetch('https://cointelegraph.com/rss');
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
        html += `
            <div class="market-item" onclick="window.location.href='coin.html?id=${coin.id}'">
                <span class="market-left">${coin.name} (${coin.symbol})</span>
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

// ==================== TOMBOL BAHASA ====================
document.addEventListener('DOMContentLoaded', function () {
    const langBtn = document.getElementById('langToggle');
    if (langBtn) {
        langBtn.addEventListener('click', function () {
            const newLang = currentLang === 'id' ? 'en' : 'id';
            setLanguage(newLang);
        });
    }
});

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

    if (typeof VanillaTilt !== 'undefined') {
        VanillaTilt.init(document.querySelectorAll('.card'), {
            max: 5,
            speed: 300,
            glare: false,
            gyroscope: true,
        });
    }
});