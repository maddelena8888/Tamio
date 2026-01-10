# Tamio Data Architecture

This document describes the canonical data architecture for Tamio's cash flow forecasting system.

## Architecture Principles

1. **Single Source of Truth**: ObligationAgreement is the canonical source for all committed cash flows
2. **Separation of Concerns**: User input (Client/ExpenseBucket) → Obligation → Forecast
3. **Audit Trail**: All changes are logged for debugging and compliance
4. **Gradual Migration**: Feature flags enable safe transition between old and new systems
5. **Integration Agnostic**: IntegrationMapping decouples entities from specific integrations

## Entity Relationship Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER INPUT LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐                         ┌──────────────────┐             │
│   │    Client    │                         │  ExpenseBucket   │             │
│   │  (Revenue)   │                         │   (Expenses)     │             │
│   └──────┬───────┘                         └────────┬─────────┘             │
│          │                                          │                       │
│          │  One-to-Many                             │  One-to-Many          │
│          ▼                                          ▼                       │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                           │
                    ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OBLIGATION LAYER (Source of Truth)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                     ┌────────────────────────┐                              │
│                     │  ObligationAgreement   │  ← WHY: Contract/Agreement   │
│                     │  - client_id (FK)      │                              │
│                     │  - expense_bucket_id   │                              │
│                     │  - obligation_type     │                              │
│                     │  - base_amount         │                              │
│                     │  - frequency           │                              │
│                     └───────────┬────────────┘                              │
│                                 │                                           │
│                                 │  One-to-Many                              │
│                                 ▼                                           │
│                     ┌────────────────────────┐                              │
│                     │  ObligationSchedule    │  ← WHEN: Payment schedule    │
│                     │  - due_date            │                              │
│                     │  - estimated_amount    │                              │
│                     │  - status              │                              │
│                     └───────────┬────────────┘                              │
│                                 │                                           │
│                                 │  One-to-Many                              │
│                                 ▼                                           │
│                     ┌────────────────────────┐                              │
│                     │    PaymentEvent        │  ← REALITY: Actual payment   │
│                     │  - amount              │                              │
│                     │  - payment_date        │                              │
│                     │  - status              │                              │
│                     └────────────────────────┘                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OUTPUT LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────────┐                    ┌────────────────────────────┐   │
│   │    CashEvent     │                    │     ForecastEvent          │   │
│   │ (Stored, Audit)  │ ◄──────────────►   │ (Computed on-the-fly)      │   │
│   │ - schedule_id FK │                    │ - From ObligationSchedule  │   │
│   └──────────────────┘                    └────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Creating a Client/Expense

```
1. User creates Client or ExpenseBucket via API
2. Routes call ObligationService.create_obligation_from_*()
3. ObligationService creates ObligationAgreement with client_id or expense_bucket_id FK
4. ObligationService generates ObligationSchedules for next 3 months
5. (Optional) CashEvents generated from schedules for audit trail
```

### Computing a Forecast

```
1. API calls calculate_forecast_v2()
2. If USE_OBLIGATION_FOR_FORECAST=True:
   - Query ObligationSchedules in date range
   - Convert to ForecastEvents on-the-fly
3. If USE_OBLIGATION_FOR_FORECAST=False (legacy):
   - Query Clients and ExpenseBuckets
   - Compute ForecastEvents from billing_config
4. Build weekly forecast with confidence scoring
```

### Syncing with Xero

```
1. Push: SyncService.push_client_to_xero()
   - Update Client.xero_contact_id (legacy field)
   - Create/update IntegrationMapping (new architecture)
   - Log sync to AuditLog

2. Pull: SyncService.pull_clients_from_xero()
   - Create/update Client records
   - Set source="xero", locked_fields=["name"]
   - Create IntegrationMapping
```

## Feature Flags

Located in `app/config.py`:

| Flag | Default | Description |
|------|---------|-------------|
| `USE_OBLIGATION_SYSTEM` | `True` | Create ObligationAgreements from Clients/ExpenseBuckets |
| `USE_OBLIGATION_FOR_FORECAST` | `False` | Use ObligationSchedules for forecast computation |
| `DEPRECATE_DIRECT_CASH_EVENTS` | `False` | Stop generating CashEvents directly from Client/ExpenseBucket |

### Migration Path

1. **Phase 1** (Current): `USE_OBLIGATION_SYSTEM=True`
   - Dual-write: Both legacy CashEvents AND ObligationSchedules created
   - Forecasts still use legacy Client/ExpenseBucket data

2. **Phase 2**: `USE_OBLIGATION_FOR_FORECAST=True`
   - Forecasts now read from ObligationSchedules
   - Legacy CashEvent generation continues for audit

3. **Phase 3**: `DEPRECATE_DIRECT_CASH_EVENTS=True`
   - Stop generating legacy CashEvents
   - All forecasts from ObligationSchedules
   - CashEvents only from schedule-to-event generator

## Key Tables

### Core Domain

| Table | Purpose |
|-------|---------|
| `users` | User accounts with base_currency preference |
| `clients` | Revenue sources (customers) |
| `expense_buckets` | Expense categories |
| `cash_accounts` | Bank accounts with balances |

### Obligation System

| Table | Purpose |
|-------|---------|
| `obligation_agreements` | Contracts/agreements (source of truth) |
| `obligation_schedules` | Expected payment dates |
| `payment_events` | Actual payments |
| `cash_events` | Materialized forecast events (audit trail) |

### Integration System

| Table | Purpose |
|-------|---------|
| `integration_mappings` | Links entities to external IDs |
| `integration_connections` | OAuth tokens per user/integration |
| `xero_connections` | (Legacy) Xero-specific connections |
| `xero_sync_logs` | (Legacy) Xero sync history |

### Support Tables

| Table | Purpose |
|-------|---------|
| `exchange_rates` | Currency conversion rates |
| `audit_logs` | All data changes |

## Currency Handling

### Multi-Currency Support

- Each entity stores both `currency` and `base_currency_amount`
- `base_currency_amount` = amount converted to user's base currency
- `exchange_rate_used` = rate at time of conversion
- Forecasts aggregate using `base_currency_amount` for consistency

### Conversion Flow

```python
# When creating/updating with non-base currency:
if entity.currency != user.base_currency:
    converted, rate, date = await convert_amount(
        db, amount, entity.currency, user.base_currency
    )
    entity.base_currency_amount = converted
    entity.exchange_rate_used = rate
    entity.exchange_rate_date = date
```

## IntegrationMapping vs Legacy Fields

### Legacy Approach (Deprecated)
```python
class Client:
    xero_contact_id = Column(String)  # Scattered across entities
    quickbooks_customer_id = Column(String)
```

### New Approach
```python
class IntegrationMapping:
    entity_type = "client"
    entity_id = "client_abc123"
    integration_type = "xero"
    external_id = "xero_contact_xyz"
    external_type = "contact"
    sync_status = "synced"
```

### Benefits
- Add new integrations without schema changes
- Query entities by external ID efficiently
- Centralized sync status tracking
- Support multiple mappings per entity

## Audit Trail

All data changes are logged to `audit_logs`:

```python
# Example: Creating a client
audit = AuditService(db, user_id=current_user.id)
await audit.log_create("client", client.id, {"name": "Acme Corp"})

# Example: Updating a client
await audit.log_update("client", client.id, {
    "name": ("Old Name", "New Name"),
    "status": ("active", "paused")
})

# Example: Sync operation
await audit.log_sync("client", client.id, "xero", "push", {
    "contact_id": result["contact_id"]
})
```

## Common Queries

### Get all obligations for a client
```python
obligations = await db.execute(
    select(ObligationAgreement)
    .where(ObligationAgreement.client_id == client_id)
)
```

### Get upcoming payments
```python
schedules = await db.execute(
    select(ObligationSchedule)
    .join(ObligationAgreement)
    .where(
        ObligationAgreement.user_id == user_id,
        ObligationSchedule.due_date >= date.today(),
        ObligationSchedule.status == "scheduled"
    )
    .order_by(ObligationSchedule.due_date)
)
```

### Find entity by Xero ID
```python
mapping = await db.execute(
    select(IntegrationMapping)
    .where(
        IntegrationMapping.integration_type == "xero",
        IntegrationMapping.external_id == xero_contact_id,
        IntegrationMapping.external_type == "contact"
    )
)
entity_type = mapping.entity_type  # "client" or "expense_bucket"
entity_id = mapping.entity_id
```

## File Structure

```
tamio-backend/
├── app/
│   ├── audit/
│   │   ├── __init__.py
│   │   ├── models.py          # AuditLog model
│   │   └── services.py        # AuditService
│   │
│   ├── data/
│   │   ├── clients/           # Client model & routes
│   │   ├── expenses/          # ExpenseBucket model & routes
│   │   ├── obligations/       # 3-layer obligation models
│   │   ├── events/            # CashEvent model
│   │   ├── exchange_rates/    # ExchangeRate model & routes
│   │   └── event_generator.py # CashEvent generation
│   │
│   ├── forecast/
│   │   └── engine_v2.py       # Forecast computation
│   │
│   ├── integrations/
│   │   ├── models.py          # IntegrationMapping, IntegrationConnection
│   │   ├── services.py        # IntegrationMappingService
│   │   ├── base.py            # IntegrationAdapter interface
│   │   └── confidence.py      # Confidence scoring
│   │
│   ├── services/
│   │   ├── obligations.py     # ObligationService
│   │   └── exchange_rates.py  # Currency conversion
│   │
│   ├── xero/                  # Xero-specific integration
│   └── config.py              # Feature flags
│
└── migrations/versions/
    ├── 20260105_0001-add_client_expense_fks_to_obligations.py
    ├── 20260105_0002-add_schedule_fk_to_cash_events.py
    ├── 20260105_0003-add_integration_mappings_table.py
    ├── 20260105_0004-add_base_currency_amounts.py
    └── 20260105_0005-add_audit_logs_table.py
```

## Common Pitfalls

1. **Forgetting to create obligations**: Always call `ObligationService` when creating/updating clients or expenses

2. **Using wrong forecast flag**: Check `USE_OBLIGATION_FOR_FORECAST` when debugging forecast discrepancies

3. **Currency conversion timing**: Convert at write-time, not read-time, to ensure consistent exchange rates

4. **IntegrationMapping vs legacy fields**: Both are written during transition - read from IntegrationMapping, write to both

5. **Audit log transactions**: Don't commit inside AuditService - let the caller manage the transaction
