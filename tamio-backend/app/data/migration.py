"""
Data migration utilities for backfilling canonical client structure.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.data.models import Client
from app.data.client_utils import ensure_client_has_canonical_structure


async def backfill_client_canonical_structure(
    db: AsyncSession,
    user_id: str = None
) -> dict:
    """
    Backfill canonical structure on existing clients.

    Ensures all clients have:
    - payment_behavior (defaults to "unknown")
    - churn_risk (defaults to "low")
    - scope_risk (defaults to "low")
    - billing_config with proper structure and "source" field

    Args:
        db: Database session
        user_id: Optional user ID to limit migration to specific user

    Returns:
        Dictionary with migration statistics
    """
    stats = {
        "total_clients": 0,
        "clients_updated": 0,
        "errors": []
    }

    try:
        # Build query
        query = select(Client)
        if user_id:
            query = query.where(Client.user_id == user_id)

        # Get all clients
        result = await db.execute(query)
        clients = result.scalars().all()
        stats["total_clients"] = len(clients)

        # Update each client
        for client in clients:
            try:
                # Check if client needs updates
                needs_update = (
                    client.payment_behavior is None or
                    client.churn_risk is None or
                    client.scope_risk is None or
                    not client.billing_config or
                    "source" not in (client.billing_config or {})
                )

                if needs_update:
                    ensure_client_has_canonical_structure(client)
                    stats["clients_updated"] += 1

            except Exception as e:
                stats["errors"].append(f"Client {client.id}: {str(e)}")

        # Commit changes
        await db.commit()

    except Exception as e:
        stats["errors"].append(f"Migration failed: {str(e)}")
        await db.rollback()

    return stats
