// ============================================================================
// Xero Integration API
// ============================================================================

import api from './client';
import type { XeroConnectionStatus, XeroAuthUrl, XeroSyncResult } from './types';

export async function getXeroStatus(userId: string): Promise<XeroConnectionStatus> {
  return api.get<XeroConnectionStatus>('/xero/status', { user_id: userId });
}

export async function getXeroConnectUrl(userId: string): Promise<XeroAuthUrl> {
  return api.get<XeroAuthUrl>('/xero/connect', { user_id: userId });
}

export async function disconnectXero(userId: string): Promise<{ success: boolean; message: string }> {
  return api.post(`/xero/disconnect?user_id=${userId}`);
}

export async function syncXero(
  userId: string,
  syncType: 'full' | 'incremental' | 'invoices' | 'contacts' = 'full'
): Promise<XeroSyncResult> {
  return api.post<XeroSyncResult>('/xero/sync', {
    user_id: userId,
    sync_type: syncType,
  });
}

export async function getXeroPreview(userId: string): Promise<{
  organisation: Record<string, unknown>;
  summary: {
    contacts: number;
    outstanding_invoices: number;
    receivables_count: number;
    receivables_total: number;
    payables_count: number;
    payables_total: number;
    repeating_invoices: number;
  };
  bank_summary: Record<string, unknown>;
  contacts: unknown[];
  invoices: unknown[];
  bills: unknown[];
  repeating_invoices: unknown[];
}> {
  return api.get('/xero/preview', { user_id: userId });
}

export async function getPaymentAnalysis(userId: string): Promise<unknown> {
  return api.get('/xero/payment-analysis', { user_id: userId });
}

export async function getSyncHistory(
  userId: string,
  limit: number = 10
): Promise<unknown[]> {
  return api.get('/xero/sync-history', { user_id: userId, limit: String(limit) });
}
