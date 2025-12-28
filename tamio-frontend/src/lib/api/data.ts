// ============================================================================
// Data API - Cash Position, Clients, Expenses
// ============================================================================

import api from './client';
import type {
  CashPositionResponse,
  CashAccountInput,
  Client,
  ClientCreate,
  ClientWithEventsResponse,
  ExpenseBucket,
  ExpenseBucketCreate,
  ExpenseBucketWithEventsResponse,
} from './types';

// Cash Position / Accounts
export async function getCashPosition(userId: string): Promise<CashPositionResponse> {
  return api.get<CashPositionResponse>('/data/cash-position', { user_id: userId });
}

export async function createCashPosition(
  userId: string,
  accounts: CashAccountInput[]
): Promise<CashPositionResponse> {
  return api.post<CashPositionResponse>('/data/cash-position', {
    user_id: userId,
    accounts,
  });
}

export async function updateCashAccounts(
  userId: string,
  accounts: CashAccountInput[]
): Promise<CashPositionResponse> {
  return api.put<CashPositionResponse>(`/data/cash-accounts/${userId}`, {
    user_id: userId,
    accounts,
  });
}

// Clients
export async function getClients(userId: string): Promise<Client[]> {
  return api.get<Client[]>('/data/clients', { user_id: userId });
}

export async function createClient(client: ClientCreate): Promise<ClientWithEventsResponse> {
  return api.post<ClientWithEventsResponse>('/data/clients', client);
}

export async function updateClient(
  clientId: string,
  updates: Partial<ClientCreate>
): Promise<ClientWithEventsResponse> {
  return api.put<ClientWithEventsResponse>(`/data/clients/${clientId}`, updates);
}

export async function deleteClient(clientId: string): Promise<{ message: string }> {
  return api.delete<{ message: string }>(`/data/clients/${clientId}`);
}

// Expense Buckets
export async function getExpenses(userId: string): Promise<ExpenseBucket[]> {
  return api.get<ExpenseBucket[]>('/data/expenses', { user_id: userId });
}

export async function createExpense(
  expense: ExpenseBucketCreate
): Promise<ExpenseBucketWithEventsResponse> {
  return api.post<ExpenseBucketWithEventsResponse>('/data/expenses', expense);
}

export async function updateExpense(
  bucketId: string,
  updates: Partial<ExpenseBucketCreate>
): Promise<ExpenseBucketWithEventsResponse> {
  return api.put<ExpenseBucketWithEventsResponse>(`/data/expenses/${bucketId}`, updates);
}

export async function deleteExpense(bucketId: string): Promise<{ message: string }> {
  return api.delete<{ message: string }>(`/data/expenses/${bucketId}`);
}

// Regenerate Events
export async function regenerateEvents(userId: string): Promise<{
  message: string;
  total_events: number;
  clients_processed: number;
  expenses_processed: number;
}> {
  return api.post(`/data/regenerate-events?user_id=${userId}`);
}
