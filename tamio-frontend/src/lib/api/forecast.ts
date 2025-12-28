// ============================================================================
// Forecast API
// ============================================================================

import api from './client';
import type { ForecastResponse } from './types';

export async function getForecast(userId: string): Promise<ForecastResponse> {
  return api.get<ForecastResponse>('/forecast', { user_id: userId });
}
