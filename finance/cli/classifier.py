"""Statement file classifier.

Routes PDF files to the correct parser based on content detection.
"""

from parsers.sofi_apex import is_sofi_apex_statement
from parsers.chase_cc import is_chase_cc_statement


STATEMENT_TYPE_SOFI_APEX = "sofi_apex"
STATEMENT_TYPE_CHASE_CC = "chase_cc"
STATEMENT_TYPE_UNKNOWN = "unknown"


def classify_statement(pdf_path: str) -> str:
    """Classify a PDF statement by type.

    Returns one of: 'sofi_apex', 'chase_cc', 'unknown'.
    """
    try:
        if is_sofi_apex_statement(pdf_path):
            return STATEMENT_TYPE_SOFI_APEX
    except Exception:
        pass

    try:
        if is_chase_cc_statement(pdf_path):
            return STATEMENT_TYPE_CHASE_CC
    except Exception:
        pass

    return STATEMENT_TYPE_UNKNOWN
