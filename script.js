class CryptoTracker {
    constructor() {
        this.baseUrl = 'https://api.coingecko.com/api/v3';
        this.chart = null;
        this.portfolio = JSON.parse(localStorage.getItem('portfolio')) || [];
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadMarketOverview();
        await this.loadTopCoins();
        this.loadPortfolio();
        this.createChart('bitcoin'); // Default to Bitcoin
    }

    setupEventListeners() {
        document.getElementById('searchBtn').addEventListener('click', () => this.handleSearch());
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        document.querySelectorAll('.time-filter').forEach(button => {
            button.addEventListener('click', (e) => this.handleTimeFilterChange(e));
        });

        document.getElementById('addToPortfolio').addEventListener('click', () => this.addToPortfolio());
    }

    async loadMarketOverview() {
        try {
            const response = await fetch(`${this.baseUrl}/global`);
            const data = await response.json();
            const market = data.data;

            document.getElementById('globalMarketCap').textContent = 
                this.formatCurrency(market.total_market_cap.usd);
            document.getElementById('total24hVolume').textContent = 
                this.formatCurrency(market.total_volume.usd);
            document.getElementById('btcDominance').textContent = 
                `${market.market_cap_percentage.btc.toFixed(1)}%`;
        } catch (error) {
            console.error('Error loading market overview:', error);
        }
    }

    async loadTopCoins() {
        try {
            const response = await fetch(
                `${this.baseUrl}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&sparkline=false`
            );
            const coins = await response.json();
            const coinList = document.getElementById('coinList');
            coinList.innerHTML = '';

            coins.forEach(coin => {
                const coinElement = document.createElement('div');
                coinElement.className = 'coin-item';
                coinElement.innerHTML = `
                    <img src="${coin.image}" alt="${coin.name}">
                    <div class="coin-info">
                        <h3>${coin.name} (${coin.symbol.toUpperCase()})</h3>
                        <p>${this.formatCurrency(coin.current_price)}</p>
                    </div>
                    <div class="coin-stats">
                        <p class="${coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}">
                            ${coin.price_change_percentage_24h.toFixed(2)}%
                        </p>
                    </div>
                `;
                coinElement.addEventListener('click', () => this.createChart(coin.id));
                coinList.appendChild(coinElement);
            });
        } catch (error) {
            console.error('Error loading top coins:', error);
        }
    }

    async createChart(coinId) {
        try {
            const days = document.querySelector('.time-filter.active').dataset.days;
            const response = await fetch(
                `${this.baseUrl}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
            );
            const data = await response.json();

            const ctx = document.getElementById('priceChart').getContext('2d');
            
            if (this.chart) {
                this.chart.destroy();
            }

            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.prices.map(price => 
                        new Date(price[0]).toLocaleDateString()
                    ),
                    datasets: [{
                        label: 'Price (USD)',
                        data: data.prices.map(price => price[1]),
                        borderColor: '#2c3e50',
                        borderWidth: 1,
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false
                        }
                    }
                }
            });

            // Update coin name in chart header
            const coinData = await this.getCoinData(coinId);
            document.getElementById('selectedCoinName').textContent = 
                `${coinData.name} Price Chart`;
        } catch (error) {
            console.error('Error creating chart:', error);
        }
    }

    async handleSearch() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        try {
            const response = await fetch(
                `${this.baseUrl}/search?query=${searchTerm}`
            );
            const data = await response.json();
            
            if (data.coins.length > 0) {
                this.createChart(data.coins[0].id);
                document.getElementById('searchInput').value = '';
            }
        } catch (error) {
            console.error('Error searching:', error);
        }
    }

    handleTimeFilterChange(e) {
        document.querySelectorAll('.time-filter').forEach(btn => 
            btn.classList.remove('active')
        );
        e.target.classList.add('active');
        
        const coinId = document.getElementById('selectedCoinName')
            .textContent.split(' ')[0].toLowerCase();
        this.createChart(coinId);
    }

    async addToPortfolio() {
        const coinName = document.getElementById('coinInput').value;
        const quantity = parseFloat(document.getElementById('quantityInput').value);

        if (!coinName || !quantity) return;

        try {
            const response = await fetch(
                `${this.baseUrl}/simple/price?ids=${coinName}&vs_currencies=usd`
            );
            const data = await response.json();

            if (data[coinName]) {
                const price = data[coinName].usd;
                const portfolioItem = {
                    coin: coinName,
                    quantity: quantity,
                    purchasePrice: price
                };

                this.portfolio.push(portfolioItem);
                localStorage.setItem('portfolio', JSON.stringify(this.portfolio));
                this.loadPortfolio();

                document.getElementById('coinInput').value = '';
                document.getElementById('quantityInput').value = '';
            }
        } catch (error) {
            console.error('Error adding to portfolio:', error);
        }
    }

    async loadPortfolio() {
        const portfolioList = document.getElementById('portfolioList');
        portfolioList.innerHTML = '';
        let totalValue = 0;

        for (const item of this.portfolio) {
            try {
                const response = await fetch(
                    `${this.baseUrl}/simple/price?ids=${item.coin}&vs_currencies=usd`
                );
                const data = await response.json();
                const currentPrice = data[item.coin].usd;
                const value = currentPrice * item.quantity;
                totalValue += value;

                const portfolioItem = document.createElement('div');
                portfolioItem.className = 'portfolio-item';
                portfolioItem.innerHTML = `
                    <div>
                        <h3>${item.coin}</h3>
                        <p>Quantity: ${item.quantity}</p>
                    </div>
                    <div>
                        <p>Value: ${this.formatCurrency(value)}</p>
                        <p class="${currentPrice >= item.purchasePrice ? 'positive' : 'negative'}">
                            ${((currentPrice - item.purchasePrice) / item.purchasePrice * 100).toFixed(2)}%
                        </p>
                    </div>
                `;
                portfolioList.appendChild(portfolioItem);
            } catch (error) {
                console.error('Error loading portfolio item:', error);
            }
        }

        document.getElementById('portfolioValue').textContent = 
            this.formatCurrency(totalValue);
    }

    async getCoinData(coinId) {
        const response = await fetch(`${this.baseUrl}/coins/${coinId}`);
        return await response.json();
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new CryptoTracker();
});