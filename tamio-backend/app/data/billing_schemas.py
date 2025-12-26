"""
Billing configuration schemas for different client types.

These schemas define the canonical structure for billing_config JSONB field
to ensure consistency across all entry points (manual, Xero, dashboard, scenarios).
"""
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from decimal import Decimal


class MilestoneConfig(BaseModel):
    """Configuration for a project milestone."""
    name: str = Field(..., description="Milestone name (e.g., Deposit, Phase 1, Final)")
    amount: Decimal = Field(..., gt=0, description="Milestone payment amount")
    expected_date: Optional[str] = Field(None, description="Expected payment date (YYYY-MM-DD)")
    trigger_type: Literal["date", "delivery"] = Field("date", description="When milestone is triggered")
    payment_terms: str = Field("net_7", description="Payment terms (net_7, net_14, net_30, etc.)")
    status: Literal["pending", "completed", "paid"] = Field("pending", description="Milestone status")


class RetainerBillingConfig(BaseModel):
    """Billing configuration for retainer clients."""
    frequency: Literal["monthly", "quarterly"] = Field(..., description="Billing frequency")
    invoice_day: int = Field(..., ge=1, le=31, description="Day of month for invoicing (1-31)")
    amount: Decimal = Field(..., gt=0, description="Retainer amount per billing cycle")
    payment_terms: str = Field("net_30", description="Payment terms (net_7, net_14, net_30, etc.)")
    source: str = Field("manual", description="Source of data (manual, xero_sync)")

    # Optional Xero metadata
    xero_contact_id: Optional[str] = None
    xero_repeating_invoice_id: Optional[str] = None


class ProjectBillingConfig(BaseModel):
    """Billing configuration for project clients."""
    total_value: Optional[Decimal] = Field(None, gt=0, description="Total project value (optional)")
    payment_structure: Literal["one_off", "milestone"] = Field(..., description="Payment structure type")
    milestones: List[MilestoneConfig] = Field(default_factory=list, description="Project milestones")
    source: str = Field("manual", description="Source of data (manual, xero_sync)")

    # Optional Xero metadata
    xero_contact_id: Optional[str] = None


class UsageBillingConfig(BaseModel):
    """Billing configuration for usage-based clients."""
    settlement_frequency: Literal["weekly", "bi_weekly", "monthly"] = Field(..., description="Settlement frequency")
    typical_amount: Decimal = Field(..., gt=0, description="Typical settlement amount (estimate)")
    payment_terms: str = Field("net_30", description="Payment terms (net_7, net_14, net_30, etc.)")
    source: str = Field("manual", description="Source of data (manual, xero_sync)")

    # Optional Xero metadata
    xero_contact_id: Optional[str] = None


class MixedBillingConfig(BaseModel):
    """Billing configuration for mixed revenue clients."""
    composition: Dict[str, float] = Field(
        ...,
        description="Revenue composition percentages (e.g., {'retainer': 60, 'project': 40})"
    )
    dominant_type: Literal["retainer", "project", "usage"] = Field(
        ...,
        description="Dominant billing type for defaults"
    )
    retainer: Optional[RetainerBillingConfig] = None
    project: Optional[ProjectBillingConfig] = None
    usage: Optional[UsageBillingConfig] = None
    source: str = Field("manual", description="Source of data (manual, xero_sync)")

    # Optional Xero metadata
    xero_contact_id: Optional[str] = None


def get_default_billing_config(client_type: str) -> Dict[str, Any]:
    """
    Get default billing configuration for a client type.

    Args:
        client_type: One of "retainer", "project", "usage", "mixed"

    Returns:
        Default billing config dictionary
    """
    defaults = {
        "retainer": {
            "frequency": "monthly",
            "invoice_day": 1,
            "amount": 0,
            "payment_terms": "net_30",
            "source": "manual"
        },
        "project": {
            "total_value": None,
            "payment_structure": "milestone",
            "milestones": [],
            "source": "manual"
        },
        "usage": {
            "settlement_frequency": "monthly",
            "typical_amount": 0,
            "payment_terms": "net_30",
            "source": "manual"
        },
        "mixed": {
            "composition": {},
            "dominant_type": "retainer",
            "source": "manual"
        }
    }

    return defaults.get(client_type, {"source": "manual"})


def validate_billing_config(client_type: str, billing_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate and normalize billing configuration for a client type.

    Args:
        client_type: One of "retainer", "project", "usage", "mixed"
        billing_config: Billing configuration dictionary

    Returns:
        Validated billing config dictionary

    Raises:
        ValueError: If billing config is invalid for the client type
    """
    if not billing_config:
        return get_default_billing_config(client_type)

    try:
        if client_type == "retainer":
            validated = RetainerBillingConfig(**billing_config)
        elif client_type == "project":
            validated = ProjectBillingConfig(**billing_config)
        elif client_type == "usage":
            validated = UsageBillingConfig(**billing_config)
        elif client_type == "mixed":
            validated = MixedBillingConfig(**billing_config)
        else:
            raise ValueError(f"Unknown client type: {client_type}")

        return validated.model_dump(exclude_none=True)
    except Exception as e:
        raise ValueError(f"Invalid billing config for {client_type}: {str(e)}")
