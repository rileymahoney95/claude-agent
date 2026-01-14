"""
Terminal formatting helpers for the finance CLI.
"""

from colorama import Fore, Style, init as colorama_init

# Initialize colorama
colorama_init()


def format_dollars(value: float, width: int = 12) -> str:
    """Format a dollar value with color (green for positive)."""
    formatted = f"${value:>{width},.2f}"
    if value > 0:
        return f"{Fore.GREEN}{formatted}{Style.RESET_ALL}"
    return formatted


def format_pct(value: float, width: int = 6) -> str:
    """Format a percentage value."""
    return f"{value:>{width}.1f}%"


def format_header(text: str) -> str:
    """Format a section header."""
    return f"{Fore.CYAN}{Style.BRIGHT}{text}{Style.RESET_ALL}"


def format_label(text: str) -> str:
    """Format a label (dimmed)."""
    return f"{Style.DIM}{text}{Style.RESET_ALL}"


def format_success(text: str) -> str:
    """Format success message."""
    return f"{Fore.GREEN}\u2713{Style.RESET_ALL} {text}"


def format_error(text: str) -> str:
    """Format error message."""
    return f"{Fore.RED}\u2717{Style.RESET_ALL} {text}"
