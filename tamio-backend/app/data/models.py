"""Database models for Tamio manual data entry system."""
from sqlalchemy import Column, String, DateTime, Date, Numeric, Boolean, Integer, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import secrets


def generate_id(prefix: str) -> str:
    """Generate a unique ID with a prefix."""
    return f"{prefix}_{secrets.token_hex(6)}"


class User(Base):
    """User model - represents an individual using Tamio."""

    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: generate_id("user"))
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=True)  # Nullable for Xero-only users
    has_completed_onboarding = Column(Boolean, nullable=False, default=False)
    base_currency = Column(String, nullable=False, default="USD")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    cash_accounts = relationship("CashAccount", back_populates="user", cascade="all, delete-orphan")
    clients = relationship("Client", back_populates="user", cascade="all, delete-orphan")
    expense_buckets = relationship("ExpenseBucket", back_populates="user", cascade="all, delete-orphan")
    cash_events = relationship("CashEvent", back_populates="user", cascade="all, delete-orphan")
    obligation_agreements = relationship("ObligationAgreement", back_populates="user", cascade="all, delete-orphan")
    payment_events = relationship("PaymentEvent", back_populates="user", cascade="all, delete-orphan")


class CashAccount(Base):
    """Cash Account model - Page 1: Current Cash Position."""

    __tablename__ = "cash_accounts"

    id = Column(String, primary_key=True, default=lambda: generate_id("acct"))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    account_name = Column(String, nullable=False)
    balance = Column(Numeric(precision=15, scale=2), nullable=False)
    currency = Column(String, nullable=False, default="USD")
    as_of_date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="cash_accounts")
    payment_events = relationship("PaymentEvent", back_populates="account", cascade="all, delete-orphan")


class Client(Base):
    """Client model - Page 2: Cash In (Revenue Sources)."""

    __tablename__ = "clients"

    id = Column(String, primary_key=True, default=lambda: generate_id("client"))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Core Info
    name = Column(String, nullable=False)
    client_type = Column(String, nullable=False)  # "retainer" | "project" | "usage" | "mixed"
    currency = Column(String, nullable=False, default="USD")
    status = Column(String, nullable=False, default="active")  # "active" | "paused" | "deleted"

    # Risk Indicators
    payment_behavior = Column(String, nullable=True)  # "on_time" | "delayed" | "unknown"
    churn_risk = Column(String, nullable=True)  # "low" | "medium" | "high"
    scope_risk = Column(String, nullable=True)  # "low" | "medium" | "high"

    # Billing Configuration (JSONB - adapts by client_type)
    billing_config = Column(JSONB, nullable=False, default=dict)

    # Metadata
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="clients")
    cash_events = relationship("CashEvent", back_populates="client", cascade="all, delete-orphan")


class ExpenseBucket(Base):
    """Expense Bucket model - Page 3: Cash Out."""

    __tablename__ = "expense_buckets"

    id = Column(String, primary_key=True, default=lambda: generate_id("bucket"))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Bucket Info
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # "payroll" | "rent" | "contractor" | "software" | "marketing" | "other"
    bucket_type = Column(String, nullable=False)  # "fixed" | "variable"

    # From Form
    monthly_amount = Column(Numeric(precision=15, scale=2), nullable=False)
    currency = Column(String, nullable=False, default="USD")
    priority = Column(String, nullable=False)  # "high" | "medium" | "low" or "essential" | "important" | "discretionary"
    is_stable = Column(Boolean, nullable=False, default=True)

    # Payment timing
    due_day = Column(Integer, nullable=True, default=15)  # Day of month (1-28)
    frequency = Column(String, nullable=True, default="monthly")  # "monthly" | "weekly" | "quarterly"

    # Optional metadata
    employee_count = Column(Integer, nullable=True)  # For payroll buckets
    notes = Column(Text, nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="expense_buckets")
    cash_events = relationship("CashEvent", back_populates="expense_bucket", cascade="all, delete-orphan")


class CashEvent(Base):
    """Cash Event model - Generated from Clients & Buckets."""

    __tablename__ = "cash_events"

    id = Column(String, primary_key=True, default=lambda: generate_id("evt"))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Core Fields
    date = Column(Date, nullable=False, index=True)
    week_number = Column(Integer, nullable=False, default=0)
    amount = Column(Numeric(precision=15, scale=2), nullable=False)
    direction = Column(String, nullable=False)  # "in" | "out"

    # Classification
    event_type = Column(String, nullable=False)  # "expected_revenue" | "expected_expense"
    category = Column(String, nullable=True)

    # Relationships
    client_id = Column(String, ForeignKey("clients.id", ondelete="CASCADE"), nullable=True, index=True)
    bucket_id = Column(String, ForeignKey("expense_buckets.id", ondelete="CASCADE"), nullable=True, index=True)

    # Confidence
    confidence = Column(String, nullable=False, default="high")  # "high" | "medium" | "low"
    confidence_reason = Column(String, nullable=True)

    # Recurrence
    is_recurring = Column(Boolean, nullable=False, default=False)
    recurrence_pattern = Column(String, nullable=True)  # "weekly" | "monthly" | "quarterly"

    # Metadata
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="cash_events")
    client = relationship("Client", back_populates="cash_events")
    expense_bucket = relationship("ExpenseBucket", back_populates="cash_events")

    # Indexes
    __table_args__ = (
        Index("ix_cash_events_user_date", "user_id", "date"),
        Index("ix_cash_events_client_id", "client_id"),
        Index("ix_cash_events_bucket_id", "bucket_id"),
    )


class ObligationAgreement(Base):
    """
    Obligation Agreement - Layer 1: WHY

    Defines the structural reason for committed cash-out.
    This is the "agreement" or "contract" that creates the obligation.
    """

    __tablename__ = "obligation_agreements"

    id = Column(String, primary_key=True, default=lambda: generate_id("obl"))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # What kind of obligation is this?
    obligation_type = Column(String, nullable=False)
    # Options:
    # - "vendor_bill": One-time or recurring bill from vendor
    # - "subscription": Recurring SaaS/software subscription
    # - "payroll": Employee salary/wages
    # - "contractor": Contractor payment
    # - "loan_payment": Loan repayment
    # - "tax_obligation": Tax payment
    # - "lease": Rent or lease payment
    # - "other": Custom obligation

    # Amount Structure
    amount_type = Column(String, nullable=False)
    # Options:
    # - "fixed": Same amount every period (e.g., $5000/month salary)
    # - "variable": Amount changes (e.g., usage-based, commission)
    # - "milestone": Triggered by delivery/date (projects)

    amount_source = Column(String, nullable=False)
    # Options:
    # - "manual_entry": User entered manually
    # - "xero_sync": Synced from Xero invoice/bill
    # - "repeating_invoice": From Xero repeating invoice
    # - "contract_upload": Extracted from contract document

    base_amount = Column(Numeric(precision=15, scale=2), nullable=True)
    # Base amount (for fixed) or typical amount (for variable)

    variability_rule = Column(JSONB, nullable=True)
    # For variable obligations, defines how amount is calculated
    # Example: {"type": "hourly_rate", "rate": 150, "estimated_hours": 40}
    # Example: {"type": "commission", "rate": 0.10, "base_sales": 50000}

    currency = Column(String, nullable=False, default="USD")

    # Timing
    frequency = Column(String, nullable=True)
    # Options: "one_time", "weekly", "bi_weekly", "monthly", "quarterly", "annually"

    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)  # Null = ongoing

    # Categorization
    category = Column(String, nullable=False)
    # Options: "payroll", "rent", "contractors", "software", "marketing", "other"

    # Link to cash account where payment is made from
    account_id = Column(String, ForeignKey("cash_accounts.id", ondelete="SET NULL"), nullable=True)

    # Confidence in this obligation
    confidence = Column(String, nullable=False, default="high")
    # Options: "high", "medium", "low"

    # Metadata
    vendor_name = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Xero Integration Fields
    xero_contact_id = Column(String, nullable=True)
    xero_invoice_id = Column(String, nullable=True)
    xero_repeating_invoice_id = Column(String, nullable=True)

    # Relationships
    user = relationship("User", back_populates="obligation_agreements")
    account = relationship("CashAccount")
    schedules = relationship("ObligationSchedule", back_populates="obligation", cascade="all, delete-orphan")
    payment_events = relationship("PaymentEvent", back_populates="obligation", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index("ix_obligation_agreements_user_id", "user_id"),
        Index("ix_obligation_agreements_category", "category"),
        Index("ix_obligation_agreements_type", "obligation_type"),
    )


class ObligationSchedule(Base):
    """
    Obligation Schedule - Layer 2: WHEN

    Defines the timing of expected cash outflows for an obligation.
    Each schedule entry represents one expected payment.
    """

    __tablename__ = "obligation_schedules"

    id = Column(String, primary_key=True, default=lambda: generate_id("sched"))
    obligation_id = Column(String, ForeignKey("obligation_agreements.id", ondelete="CASCADE"), nullable=False, index=True)

    # When is payment due?
    due_date = Column(Date, nullable=False, index=True)

    # What period does this cover?
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)

    # How much do we expect to pay?
    estimated_amount = Column(Numeric(precision=15, scale=2), nullable=False)

    # How was estimate determined?
    estimate_source = Column(String, nullable=False)
    # Options:
    # - "fixed_agreement": From fixed agreement (e.g., monthly retainer)
    # - "historical_average": Based on past payments
    # - "manual_estimate": User provided estimate
    # - "xero_invoice": From Xero invoice amount

    # Confidence in this estimate
    confidence = Column(String, nullable=False, default="medium")
    # Options: "high", "medium", "low"

    # Status
    status = Column(String, nullable=False, default="scheduled")
    # Options:
    # - "scheduled": Future payment, not yet due
    # - "due": Payment is due now
    # - "paid": Payment has been made (linked to PaymentEvent)
    # - "overdue": Payment missed due date
    # - "cancelled": Obligation cancelled

    # Metadata
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    obligation = relationship("ObligationAgreement", back_populates="schedules")
    payment_events = relationship("PaymentEvent", back_populates="schedule", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index("ix_obligation_schedules_obligation_id", "obligation_id"),
        Index("ix_obligation_schedules_due_date", "due_date"),
        Index("ix_obligation_schedules_status", "status"),
    )


class PaymentEvent(Base):
    """
    Payment Event - Layer 3: REALITY

    Represents actual confirmed cash-out from bank account.
    Links to ObligationSchedule to reconcile expectations vs reality.
    """

    __tablename__ = "payment_events"

    id = Column(String, primary_key=True, default=lambda: generate_id("pay"))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Link to what this payment is for
    obligation_id = Column(String, ForeignKey("obligation_agreements.id", ondelete="SET NULL"), nullable=True, index=True)
    schedule_id = Column(String, ForeignKey("obligation_schedules.id", ondelete="SET NULL"), nullable=True, index=True)

    # Payment Details
    amount = Column(Numeric(precision=15, scale=2), nullable=False)
    currency = Column(String, nullable=False, default="USD")
    payment_date = Column(Date, nullable=False, index=True)

    # Which account did payment come from?
    account_id = Column(String, ForeignKey("cash_accounts.id", ondelete="SET NULL"), nullable=True)

    # Payment Status
    status = Column(String, nullable=False, default="completed")
    # Options:
    # - "pending": Initiated but not yet cleared
    # - "completed": Payment cleared
    # - "failed": Payment failed
    # - "reversed": Payment was reversed/refunded

    # Source
    source = Column(String, nullable=False)
    # Options:
    # - "manual_entry": User entered manually
    # - "xero_sync": Synced from Xero bank transaction
    # - "bank_feed": From bank feed integration
    # - "csv_import": Imported from CSV

    # Reconciliation
    is_reconciled = Column(Boolean, nullable=False, default=False)
    reconciled_at = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    vendor_name = Column(String, nullable=True)
    payment_method = Column(String, nullable=True)  # "bank_transfer", "card", "check", etc.
    reference = Column(String, nullable=True)  # Invoice number, transaction ID, etc.
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Xero Integration
    xero_payment_id = Column(String, nullable=True)
    xero_bank_transaction_id = Column(String, nullable=True)

    # Relationships
    user = relationship("User", back_populates="payment_events")
    obligation = relationship("ObligationAgreement", back_populates="payment_events")
    schedule = relationship("ObligationSchedule", back_populates="payment_events")
    account = relationship("CashAccount", back_populates="payment_events")

    # Indexes
    __table_args__ = (
        Index("ix_payment_events_user_id", "user_id"),
        Index("ix_payment_events_payment_date", "payment_date"),
        Index("ix_payment_events_obligation_id", "obligation_id"),
        Index("ix_payment_events_schedule_id", "schedule_id"),
        Index("ix_payment_events_account_id", "account_id"),
    )
