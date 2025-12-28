// ============================================================================
// TAMI Chat API - Following exact contract from specification
// ============================================================================

import api from './client';
import type { ChatRequest, ChatResponse, ChatMessage } from './types';

/**
 * Send a message to TAMI chat
 *
 * IMPORTANT: Follow the contract exactly:
 * - Response contains message_markdown, mode, and ui_hints
 * - mode determines UI behavior (explain_forecast, suggest_scenarios, build_scenario, goal_planning, clarify)
 * - ui_hints.suggested_actions are rendered as buttons
 * - Frontend never applies scenarios directly - all changes flow through TAMI
 */
export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  return api.post<ChatResponse>('/tami/chat', request);
}

/**
 * Create or update a scenario layer via TAMI
 */
export async function createOrUpdateScenarioLayer(params: {
  user_id: string;
  scenario_type: string;
  scope: Record<string, unknown>;
  params: Record<string, unknown>;
  linked_changes?: Record<string, unknown> | null;
  name: string;
}): Promise<unknown> {
  return api.post('/tami/scenario/layer/create_or_update', params);
}

/**
 * Iterate on an existing scenario layer
 */
export async function iterateScenarioLayer(params: {
  scenario_id: string;
  patch: Record<string, unknown>;
}): Promise<unknown> {
  return api.post('/tami/scenario/layer/iterate', params);
}

/**
 * Discard a scenario layer
 */
export async function discardScenarioLayer(params: {
  scenario_id: string;
}): Promise<unknown> {
  return api.post('/tami/scenario/layer/discard', params);
}

/**
 * Get scenario suggestions
 */
export async function getScenarioSuggestions(userId: string): Promise<unknown> {
  return api.get('/tami/scenario/suggestions', { user_id: userId });
}

/**
 * Build scenarios to achieve a financial goal
 */
export async function planGoal(params: {
  user_id: string;
  goal: string;
  constraints: Record<string, unknown>;
}): Promise<unknown> {
  return api.post('/tami/plan/goal', params);
}

/**
 * Get TAMI context (debugging)
 */
export async function getTamiContext(userId: string): Promise<unknown> {
  return api.get('/tami/context', { user_id: userId });
}

// Helper function to format conversation history
export function formatConversationHistory(
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: Date }>
): ChatMessage[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp?.toISOString(),
  }));
}
