// ============================================================================
// API Module Exports
// ============================================================================

// Client
export { api as default, setAccessToken, getAccessToken, clearAuth, ApiClientError } from './client';

// Auth
export {
  login,
  signup,
  getCurrentUser,
  refreshToken,
  completeOnboarding,
  logout,
  getStoredUser,
  isAuthenticated,
} from './auth';

// Data
export * from './data';

// Forecast
export * from './forecast';

// Scenarios
export {
  getRules,
  createRule,
  updateRule,
  deleteRule,
  getScenarios,
  getScenario,
  createScenario,
  updateScenario,
  deleteScenario,
  buildScenario,
  addScenarioLayer,
  saveScenario,
  getScenarioForecast,
  getScenarioSuggestions,
  evaluateBaseRules,
  seedScenario,
  submitScenarioAnswers,
  getScenarioPipelineStatus,
  commitScenario,
  discardScenario,
} from './scenarios';

// TAMI
export {
  sendChatMessage,
  createOrUpdateScenarioLayer,
  iterateScenarioLayer,
  discardScenarioLayer,
  planGoal,
  getTamiContext,
  formatConversationHistory,
} from './tami';

// Xero
export * from './xero';

// Onboarding
export * from './onboarding';

// Types
export * from './types';
