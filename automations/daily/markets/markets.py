#!/usr/bin/env python3
"""
Markets Script
Displays price data for tracked cryptocurrencies and stocks.
"""

import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
import yfinance as yf
from colorama import Fore, Style, init as colorama_init
from tabulate import tabulate

# Path constants
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
CONFIG_DIR = REPO_ROOT / ".config"
DATA_DIR = REPO_ROOT / ".data"
LOGS_DIR = DATA_DIR / "logs"
WATCHLIST_PATH = CONFIG_DIR / "watchlist.json"

# API constants
COINGECKO_API_BASE = "https://api.coingecko.com/api/v3"


class APIError(Exception):
    """Base exception for API errors."""
    pass


def load_watchlist() -> dict[str, Any]:
    """Load watchlist from JSON config."""
    if not WATCHLIST_PATH.exists():
        print(f"{Fore.RED}Error: Watchlist not found at {WATCHLIST_PATH}{Style.RESET_ALL}")
        print(f"Create a watchlist.json file with your assets.")
        sys.exit(1)

    with open(WATCHLIST_PATH) as f:
        return json.load(f)


class CryptoFetcher:
    """Handles CoinGecko API interactions."""

    def __init__(self):
        self.base_url = COINGECKO_API_BASE
        self.session = requests.Session()

    def _request(self, endpoint: str, params: dict = None) -> dict:
        """Make API request with retry logic."""
        url = f"{self.base_url}{endpoint}"

        for attempt in range(3):
            try:
                response = self.session.get(url, params=params, timeout=10)

                if response.status_code == 429:
                    time.sleep(5 * (attempt + 1))
                    continue

                response.raise_for_status()
                return response.json()

            except requests.exceptions.Timeout:
                if attempt < 2:
                    time.sleep(1)
                    continue
                raise APIError("Request timed out")
            except requests.exceptions.RequestException as e:
                raise APIError(f"API request failed: {e}")

        raise APIError("Max retries exceeded")

    def fetch_prices(self, coins: list[dict]) -> list[dict]:
        """Fetch current prices and changes for cryptocurrencies."""
        if not coins:
            return []

        coin_ids = [c["id"] for c in coins]

        # Fetch all data in a single batched request - includes all timeframes
        market_data = self._request("/coins/markets", {
            "vs_currency": "usd",
            "ids": ",".join(coin_ids),
            "sparkline": "false",
            "price_change_percentage": "24h,7d,30d,1y"
        })

        market_by_id = {item["id"]: item for item in market_data}

        # Build results
        results = []
        for coin in coins:
            coin_id = coin["id"]

            if coin_id not in market_by_id:
                results.append({
                    "symbol": coin["symbol"],
                    "name": coin["name"],
                    "error": "Not found"
                })
                continue

            data = market_by_id[coin_id]
            price = data.get("current_price", 0)

            result = {
                "symbol": coin["symbol"],
                "name": coin["name"],
                "price": price,
                "change_24h": data.get("price_change_percentage_24h"),
                "change_7d": data.get("price_change_percentage_7d_in_currency"),
                "change_30d": data.get("price_change_percentage_30d_in_currency"),
                "change_1yr": data.get("price_change_percentage_1y_in_currency")
            }

            # Add portfolio metrics if holdings data exists
            holdings = coin.get("holdings")
            if holdings:
                result["portfolio_metrics"] = PortfolioCalculator.calculate_holding_metrics(price, holdings)

            results.append(result)

        return results


class StockFetcher:
    """Handles Yahoo Finance interactions via yfinance."""

    def fetch_prices(self, stocks: list[dict]) -> list[dict]:
        """Fetch stock data using yfinance with batch downloading."""
        if not stocks:
            return []

        tickers = [s["ticker"] for s in stocks]
        ticker_to_name = {s["ticker"]: s["name"] for s in stocks}
        all_stocks = stocks  # Store reference for holdings lookup

        # Batch download all tickers at once - much faster than individual requests
        # Use 2y to ensure we have enough data for 1yr calculations (need 253+ trading days)
        hist = yf.download(tickers, period="2y", group_by="ticker", progress=False)

        results = []
        for ticker in tickers:
            try:
                # Handle single vs multiple ticker DataFrame structure
                if len(tickers) == 1:
                    ticker_hist = hist
                else:
                    ticker_hist = hist[ticker]

                # Check if we have data
                if ticker_hist.empty or ticker_hist["Close"].isna().all():
                    results.append({
                        "ticker": ticker,
                        "name": ticker_to_name[ticker],
                        "error": "No data available"
                    })
                    continue

                # Drop NaN values for accurate calculations
                close_prices = ticker_hist["Close"].dropna()
                if close_prices.empty:
                    results.append({
                        "ticker": ticker,
                        "name": ticker_to_name[ticker],
                        "error": "No data available"
                    })
                    continue

                current_price = close_prices.iloc[-1]

                # Calculate changes
                change_24h = self._calc_change(close_prices, 1, current_price)
                change_7d = self._calc_change(close_prices, 5, current_price)  # 5 trading days
                change_3mo = self._calc_change(close_prices, 63, current_price)  # ~63 trading days
                change_1yr = self._calc_change(close_prices, 252, current_price)  # ~252 trading days

                result = {
                    "ticker": ticker,
                    "name": ticker_to_name[ticker],
                    "price": current_price,
                    "change_24h": change_24h,
                    "change_7d": change_7d,
                    "change_3mo": change_3mo,
                    "change_1yr": change_1yr
                }

                # Add portfolio metrics if holdings data exists
                # Find the original stock dict to get holdings
                stock_dict = next((s for s in all_stocks if s["ticker"] == ticker), None)
                if stock_dict and stock_dict.get("holdings"):
                    result["portfolio_metrics"] = PortfolioCalculator.calculate_holding_metrics(
                        current_price, stock_dict["holdings"]
                    )

                results.append(result)

            except Exception as e:
                results.append({
                    "ticker": ticker,
                    "name": ticker_to_name[ticker],
                    "error": str(e)
                })

        return results

    def _calc_change(self, close_prices, days_back: int, current: float) -> float | None:
        """Calculate percentage change from days_back to current."""
        if len(close_prices) <= days_back:
            return None

        historical = close_prices.iloc[-(days_back + 1)]
        return ((current - historical) / historical) * 100


class PortfolioCalculator:
    """Calculates portfolio metrics for holdings."""

    @staticmethod
    def calculate_holding_metrics(price: float, holdings: dict | None) -> dict | None:
        """Calculate RoR metrics for a single holding.

        Args:
            price: Current market price
            holdings: Dict with 'quantity' and 'cost_basis' keys

        Returns:
            Dict with calculated metrics or None if no holdings
        """
        if not holdings or 'quantity' not in holdings or 'cost_basis' not in holdings:
            return None

        quantity = holdings['quantity']
        cost_basis = holdings['cost_basis']

        current_value = price * quantity
        total_cost = cost_basis * quantity
        gain_loss_dollars = current_value - total_cost
        gain_loss_percent = (gain_loss_dollars / total_cost * 100) if total_cost > 0 else 0

        return {
            'quantity': quantity,
            'cost_basis': cost_basis,
            'current_value': current_value,
            'total_cost': total_cost,
            'gain_loss_dollars': gain_loss_dollars,
            'gain_loss_percent': gain_loss_percent
        }

    @staticmethod
    def calculate_portfolio_totals(assets_data: list[dict]) -> dict:
        """Calculate aggregate portfolio metrics.

        Args:
            assets_data: List of asset dicts with portfolio_metrics

        Returns:
            Dict with total_value, total_cost, total_gain_loss_dollars, total_gain_loss_percent
        """
        total_value = 0
        total_cost = 0

        for asset in assets_data:
            metrics = asset.get('portfolio_metrics')
            if metrics:
                total_value += metrics['current_value']
                total_cost += metrics['total_cost']

        total_gain_loss_dollars = total_value - total_cost
        total_gain_loss_percent = (total_gain_loss_dollars / total_cost * 100) if total_cost > 0 else 0

        return {
            'total_value': total_value,
            'total_cost': total_cost,
            'total_gain_loss_dollars': total_gain_loss_dollars,
            'total_gain_loss_percent': total_gain_loss_percent,
            'num_holdings': sum(1 for a in assets_data if a.get('portfolio_metrics'))
        }


class OutputFormatter:
    """Handles terminal and file output formatting."""

    @staticmethod
    def format_change(value: float | None, colored: bool = True) -> str:
        """Format change with optional color."""
        if value is None:
            return "N/A"

        prefix = "+" if value > 0 else ""
        formatted = f"{prefix}{value:.2f}%"

        if not colored:
            return formatted

        if value > 0:
            return f"{Fore.GREEN}{formatted}{Style.RESET_ALL}"
        elif value < 0:
            return f"{Fore.RED}{formatted}{Style.RESET_ALL}"
        return formatted

    @staticmethod
    def format_price(value: float) -> str:
        """Format price with appropriate precision."""
        if value >= 1000:
            return f"${value:,.2f}"
        elif value >= 1:
            return f"${value:.2f}"
        else:
            return f"${value:.4f}"

    @staticmethod
    def format_dollars(value: float, colored: bool = True) -> str:
        """Format dollar amounts with sign and optional color."""
        prefix = "+" if value > 0 else ""
        formatted = f"{prefix}${value:,.2f}"

        if not colored:
            return formatted

        if value > 0:
            return f"{Fore.GREEN}{formatted}{Style.RESET_ALL}"
        elif value < 0:
            return f"{Fore.RED}{formatted}{Style.RESET_ALL}"
        return formatted

    @staticmethod
    def format_quantity(value: float) -> str:
        """Format quantity with appropriate precision."""
        if value >= 1:
            return f"{value:,.4f}"
        else:
            return f"{value:.6f}"

    def create_crypto_table(self, data: list[dict], colored: bool = True, show_portfolio: bool = False) -> str:
        """Create formatted table for crypto data."""
        if show_portfolio:
            headers = ["Symbol", "Price", "Qty", "Value", "Gain/Loss $", "Gain/Loss %"]
        else:
            headers = ["Symbol", "Price", "24h", "7d", "30d", "1yr"]

        rows = []
        portfolio_totals = None

        for item in data:
            if "error" in item:
                if show_portfolio:
                    rows.append([item["symbol"], f"Error: {item['error']}", "-", "-", "-", "-"])
                else:
                    rows.append([item["symbol"], f"Error: {item['error']}", "-", "-", "-", "-"])
            else:
                if show_portfolio:
                    metrics = item.get("portfolio_metrics")
                    if metrics:
                        rows.append([
                            item["symbol"],
                            self.format_price(item["price"]),
                            self.format_quantity(metrics["quantity"]),
                            self.format_price(metrics["current_value"]),
                            self.format_dollars(metrics["gain_loss_dollars"], colored),
                            self.format_change(metrics["gain_loss_percent"], colored)
                        ])
                else:
                    rows.append([
                        item["symbol"],
                        self.format_price(item["price"]),
                        self.format_change(item["change_24h"], colored),
                        self.format_change(item["change_7d"], colored),
                        self.format_change(item["change_30d"], colored),
                        self.format_change(item["change_1yr"], colored)
                    ])

        # Add totals row if showing portfolio
        if show_portfolio and rows:
            portfolio_totals = PortfolioCalculator.calculate_portfolio_totals(data)
            if portfolio_totals['num_holdings'] > 0:
                rows.append(["-" * 6] * 6)  # Separator
                rows.append([
                    "TOTAL",
                    "",
                    "",
                    self.format_price(portfolio_totals["total_value"]),
                    self.format_dollars(portfolio_totals["total_gain_loss_dollars"], colored),
                    self.format_change(portfolio_totals["total_gain_loss_percent"], colored)
                ])

        return tabulate(rows, headers=headers, tablefmt="simple")

    def create_stock_table(self, data: list[dict], colored: bool = True, show_portfolio: bool = False) -> str:
        """Create formatted table for stock data."""
        if show_portfolio:
            headers = ["Ticker", "Price", "Qty", "Value", "Gain/Loss $", "Gain/Loss %"]
        else:
            headers = ["Ticker", "Price", "24h", "7d", "3mo", "1yr"]

        rows = []

        for item in data:
            if "error" in item:
                if show_portfolio:
                    rows.append([item["ticker"], f"Error: {item['error']}", "-", "-", "-", "-"])
                else:
                    rows.append([item["ticker"], f"Error: {item['error']}", "-", "-", "-", "-"])
            else:
                if show_portfolio:
                    metrics = item.get("portfolio_metrics")
                    if metrics:
                        rows.append([
                            item["ticker"],
                            self.format_price(item["price"]),
                            self.format_quantity(metrics["quantity"]),
                            self.format_price(metrics["current_value"]),
                            self.format_dollars(metrics["gain_loss_dollars"], colored),
                            self.format_change(metrics["gain_loss_percent"], colored)
                        ])
                else:
                    rows.append([
                        item["ticker"],
                        self.format_price(item["price"]),
                        self.format_change(item["change_24h"], colored),
                        self.format_change(item["change_7d"], colored),
                        self.format_change(item["change_3mo"], colored),
                        self.format_change(item["change_1yr"], colored)
                    ])

        # Add totals row if showing portfolio
        if show_portfolio and rows:
            portfolio_totals = PortfolioCalculator.calculate_portfolio_totals(data)
            if portfolio_totals['num_holdings'] > 0:
                rows.append(["-" * 6] * 6)  # Separator
                rows.append([
                    "TOTAL",
                    "",
                    "",
                    self.format_price(portfolio_totals["total_value"]),
                    self.format_dollars(portfolio_totals["total_gain_loss_dollars"], colored),
                    self.format_change(portfolio_totals["total_gain_loss_percent"], colored)
                ])

        return tabulate(rows, headers=headers, tablefmt="simple")


class BriefingLogger:
    """Handles log file output."""

    def __init__(self):
        LOGS_DIR.mkdir(parents=True, exist_ok=True)

    def get_log_path(self) -> Path:
        """Generate log file path with date."""
        date_str = datetime.now().strftime("%Y-%m-%d")
        return LOGS_DIR / f"markets-{date_str}.log"

    def write(self, content: str) -> Path:
        """Write content to log file."""
        log_path = self.get_log_path()
        with open(log_path, "w") as f:
            f.write(content)
        return log_path


def create_briefing_output(
    crypto_data: list[dict] | None,
    stock_data: dict[str, list[dict]] | None,
    colored: bool = True,
    show_portfolio: bool = False
) -> str:
    """Create the full briefing output."""
    formatter = OutputFormatter()
    lines = []

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if show_portfolio:
        header = f"PORTFOLIO - {timestamp}"
    else:
        header = f"MARKETS - {timestamp}"
    separator = "=" * 60

    lines.append(separator)
    lines.append(header.center(60))
    lines.append(separator)
    lines.append("")

    if crypto_data:
        lines.append("CRYPTOCURRENCIES")
        lines.append("-" * 60)
        lines.append(formatter.create_crypto_table(crypto_data, colored, show_portfolio))
        lines.append("")

    if stock_data:
        # Stock category display names
        category_labels = {
            "index_funds": "STOCKS - INDEX FUNDS",
            "etfs": "STOCKS - ETFS",
            "individual": "STOCKS - INDIVIDUAL"
        }

        for category in ["index_funds", "etfs", "individual"]:
            if category in stock_data and stock_data[category]:
                lines.append(category_labels[category])
                lines.append("-" * 60)
                lines.append(formatter.create_stock_table(stock_data[category], colored, show_portfolio))
                lines.append("")

    # Add grand total if showing portfolio
    if show_portfolio and (crypto_data or stock_data):
        all_assets = []
        if crypto_data:
            all_assets.extend(crypto_data)
        if stock_data:
            for category_data in stock_data.values():
                all_assets.extend(category_data)

        grand_totals = PortfolioCalculator.calculate_portfolio_totals(all_assets)
        if grand_totals['num_holdings'] > 0:
            lines.append("PORTFOLIO SUMMARY")
            lines.append("-" * 60)
            lines.append(f"Total Value:      {formatter.format_price(grand_totals['total_value'])}")
            lines.append(f"Total Cost:       {formatter.format_price(grand_totals['total_cost'])}")
            lines.append(f"Total Gain/Loss:  {formatter.format_dollars(grand_totals['total_gain_loss_dollars'], colored)}")
            lines.append(f"Total Return:     {formatter.format_change(grand_totals['total_gain_loss_percent'], colored)}")
            lines.append(f"Holdings:         {grand_totals['num_holdings']}")
            lines.append("")

    lines.append(separator)

    return "\n".join(lines)


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Display financial briefing for tracked assets"
    )
    parser.add_argument(
        "--no-log",
        action="store_true",
        help="Skip writing to log file"
    )
    parser.add_argument(
        "--show-config",
        action="store_true",
        help="Display config file path and exit"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output in JSON format instead of table"
    )
    parser.add_argument(
        "--crypto-only",
        action="store_true",
        help="Only show cryptocurrency data"
    )
    parser.add_argument(
        "--stocks-only",
        action="store_true",
        help="Only show stock data"
    )
    parser.add_argument(
        "--portfolio",
        action="store_true",
        help="Show portfolio holdings, values, and returns"
    )
    parser.add_argument(
        "--portfolio-only",
        action="store_true",
        help="Show only assets with holdings (implies --portfolio)"
    )
    return parser.parse_args()


def _fetch_crypto_task(cryptos: list[dict]) -> list[dict] | None:
    """Task function for fetching crypto data."""
    try:
        crypto_fetcher = CryptoFetcher()
        return crypto_fetcher.fetch_prices(cryptos)
    except APIError as e:
        print(f"{Fore.RED}Error fetching crypto data: {e}{Style.RESET_ALL}")
        return None


def _fetch_stocks_task(stocks_config: dict | list) -> dict[str, list[dict]] | None:
    """Task function for fetching stock data."""
    try:
        stock_fetcher = StockFetcher()

        # Handle both old flat array format and new categorized format
        if isinstance(stocks_config, list):
            # Legacy flat format - treat as individual stocks
            return {"individual": stock_fetcher.fetch_prices(stocks_config)}
        else:
            # New categorized format - collect all stocks for batch fetch
            all_stocks = []
            ticker_to_category = {}

            for category in ["index_funds", "etfs", "individual"]:
                category_stocks = stocks_config.get(category, [])
                for stock in category_stocks:
                    all_stocks.append(stock)
                    ticker_to_category[stock["ticker"]] = category

            if not all_stocks:
                return {}

            # Batch fetch all stocks at once
            all_results = stock_fetcher.fetch_prices(all_stocks)

            # Split results back into categories
            stock_data = {"index_funds": [], "etfs": [], "individual": []}
            for result in all_results:
                category = ticker_to_category.get(result["ticker"], "individual")
                stock_data[category].append(result)

            # Remove empty categories
            return {k: v for k, v in stock_data.items() if v}

    except Exception as e:
        print(f"{Fore.RED}Error fetching stock data: {e}{Style.RESET_ALL}")
        return None


def main():
    """Main entry point."""
    colorama_init()
    args = parse_args()

    if args.show_config:
        print(f"Watchlist config: {WATCHLIST_PATH}")
        print(f"Logs directory:   {LOGS_DIR}")
        sys.exit(0)

    watchlist = load_watchlist()

    # Portfolio-only mode implies portfolio mode
    show_portfolio = args.portfolio or args.portfolio_only

    crypto_data = None
    stock_data = None

    # Prepare fetch parameters
    cryptos = watchlist.get("cryptocurrencies", []) if not args.stocks_only else []
    stocks_config = watchlist.get("stocks", {}) if not args.crypto_only else {}

    # Filter to only assets with holdings if --portfolio-only is set
    if args.portfolio_only:
        cryptos = [c for c in cryptos if c.get("holdings")]
        if isinstance(stocks_config, dict):
            stocks_config = {
                cat: [s for s in stocks if s.get("holdings")]
                for cat, stocks in stocks_config.items()
            }
        else:
            stocks_config = [s for s in stocks_config if s.get("holdings")]

    # Calculate totals for status message
    crypto_count = len(cryptos)
    if isinstance(stocks_config, list):
        stock_count = len(stocks_config)
    else:
        stock_count = sum(len(stocks_config.get(cat, [])) for cat in ["index_funds", "etfs", "individual"])

    # Print status
    if crypto_count > 0 and stock_count > 0:
        print(f"Fetching data for {crypto_count} cryptos and {stock_count} stocks in parallel...")
    elif crypto_count > 0:
        print(f"Fetching crypto data for {crypto_count} assets...")
    elif stock_count > 0:
        print(f"Fetching stock data for {stock_count} tickers...")

    # Fetch crypto and stocks concurrently
    if crypto_count > 0 and stock_count > 0:
        with ThreadPoolExecutor(max_workers=2) as executor:
            crypto_future = executor.submit(_fetch_crypto_task, cryptos)
            stock_future = executor.submit(_fetch_stocks_task, stocks_config)

            crypto_data = crypto_future.result()
            stock_data = stock_future.result()
    else:
        # Only one type to fetch, no need for parallelism
        if crypto_count > 0:
            crypto_data = _fetch_crypto_task(cryptos)
        if stock_count > 0:
            stock_data = _fetch_stocks_task(stocks_config)

    print()  # Blank line before output

    # Output
    if args.json:
        output = json.dumps({
            "timestamp": datetime.now().isoformat(),
            "crypto": crypto_data,
            "stocks": stock_data
        }, indent=2)
        print(output)
    else:
        # Terminal output (colored)
        terminal_output = create_briefing_output(crypto_data, stock_data, colored=True, show_portfolio=show_portfolio)
        print(terminal_output)

    # Log file (plain text)
    if not args.no_log:
        logger = BriefingLogger()
        plain_output = create_briefing_output(crypto_data, stock_data, colored=False, show_portfolio=show_portfolio)
        log_path = logger.write(plain_output)
        print(f"Log saved to: {log_path}")


if __name__ == "__main__":
    main()
