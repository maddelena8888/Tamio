"""
Xero account code to Tamio expense category mapping.

This module provides automatic categorization of Xero invoices
based on their account codes from the chart of accounts.
"""
import re
from typing import Optional, Dict

# Default mapping patterns: Xero account name pattern → Tamio category
DEFAULT_ACCOUNT_PATTERNS = {
    r"payroll|wages?|salaries|salary": "payroll",
    r"rent|lease": "rent",
    r"contractor|subcontractor|freelance": "contractors",
    r"software|saas|subscription|hosting|cloud": "software",
    r"marketing|advertising|ads": "marketing",
    r"insurance": "other",
    r"utilities|phone|internet|telecom": "other",
    r"legal|accounting|professional\s*fees": "other",
    r"office|supplies|equipment": "other",
    r"travel|transportation": "other",
    r"tax|vat|gst": "other",
}


def categorize_account_code(
    account_code: str,
    account_name: str,
    account_type: Optional[str] = None,
    custom_mappings: Optional[Dict[str, str]] = None
) -> str:
    """
    Categorize a Xero account code to a Tamio expense category.

    Args:
        account_code: Xero account code (e.g., "400", "450")
        account_name: Xero account name (e.g., "Wages & Salaries")
        account_type: Xero account type (e.g., "EXPENSE", "DIRECTCOSTS")
        custom_mappings: Optional user-defined mappings {account_code: category}

    Returns:
        Tamio expense category (payroll, rent, contractors, software, marketing, or other)

    Examples:
        >>> categorize_account_code("400", "Wages & Salaries")
        'payroll'
        >>> categorize_account_code("450", "Office Rent")
        'rent'
        >>> categorize_account_code("500", "Freelance Contractors")
        'contractors'
    """
    # 1. Check custom user mappings first (if provided)
    if custom_mappings and account_code in custom_mappings:
        return custom_mappings[account_code]

    # 2. Try pattern matching on account name
    account_name_lower = account_name.lower()

    for pattern, category in DEFAULT_ACCOUNT_PATTERNS.items():
        if re.search(pattern, account_name_lower):
            return category

    # 3. Default to "other" for unmatched accounts
    return "other"


def get_category_from_line_items(line_items: list) -> str:
    """
    Determine expense category from invoice line items.

    Uses the first line item's account code for categorization.
    If multiple line items map to different categories, uses the
    category of the largest line item.

    Args:
        line_items: List of invoice line items with account_code

    Returns:
        Tamio expense category
    """
    if not line_items:
        return "other"

    # If single line item, use its category
    if len(line_items) == 1:
        account_code = line_items[0].get("account_code")
        account_name = line_items[0].get("description", "")
        if account_code:
            return categorize_account_code(account_code, account_name)
        return "other"

    # Multiple line items: use category of largest amount
    largest_item = max(line_items, key=lambda x: x.get("line_amount", 0))
    account_code = largest_item.get("account_code")
    account_name = largest_item.get("description", "")

    if account_code:
        return categorize_account_code(account_code, account_name)

    return "other"
