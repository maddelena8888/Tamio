import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { NeuroCard, NeuroCardContent, NeuroCardHeader, NeuroCardTitle } from '@/components/ui/neuro-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Users,
  UserPlus,
  UserMinus,
  TrendingUp,
  TrendingDown,
  Clock,
  Building,
  X,
  Save,
  CheckCircle2,
  Link2,
  Bot,
  User,
  Send,
  MessageCircle,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  getScenarios,
  getScenarioSuggestions,
  createScenario,
  buildScenario,
  getScenarioForecast,
  saveScenario,
  deleteScenario,
  addScenarioLayer,
  getRules,
} from '@/lib/api/scenarios';
import { getClients, getExpenses } from '@/lib/api/data';
import { getForecast } from '@/lib/api/forecast';
import { sendChatMessageStreaming, formatConversationHistory } from '@/lib/api/tami';
import type {
  Scenario,
  ScenarioType,
  ScenarioSuggestion,
  ScenarioComparisonResponse,
  ForecastResponse,
  Client,
  ExpenseBucket,
  FinancialRule,
  ChatMode,
  SuggestedAction,
} from '@/lib/api/types';

const scenarioTypeConfig: Record<ScenarioType, { label: string; icon: React.ElementType; description: string }> = {
  client_loss: { label: 'Client Loss', icon: UserMinus, description: 'Model losing a client' },
  client_gain: { label: 'Client Gain', icon: UserPlus, description: 'Model gaining a new client' },
  client_change: { label: 'Client Change', icon: Users, description: 'Model upsell/downsell' },
  hiring: { label: 'Hiring', icon: UserPlus, description: 'Model adding headcount' },
  firing: { label: 'Firing', icon: UserMinus, description: 'Model reducing headcount' },
  contractor_gain: { label: 'Contractor Gain', icon: Building, description: 'Model adding a contractor' },
  contractor_loss: { label: 'Contractor Loss', icon: Building, description: 'Model losing a contractor' },
  increased_expense: { label: 'Increased Expense', icon: TrendingUp, description: 'Model expense increase' },
  decreased_expense: { label: 'Decreased Expense', icon: TrendingDown, description: 'Model expense reduction' },
  payment_delay_in: { label: 'Payment Delay (In)', icon: Clock, description: 'Model delayed client payment' },
  payment_delay_out: { label: 'Payment Delay (Out)', icon: Clock, description: 'Model delayed vendor payment' },
};

const chartConfig = {
  base: { label: 'Base Forecast', color: 'var(--chart-1)' },
  scenario: { label: 'Scenario Forecast', color: 'var(--lime)' },
  buffer: { label: 'Cash Buffer', color: 'var(--tomato)' },
} satisfies ChartConfig;

interface TamiMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  mode?: ChatMode;
  suggestedActions?: SuggestedAction[];
  isStreaming?: boolean;
}

export default function Scenarios() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [savedScenarios, setSavedScenarios] = useState<Scenario[]>([]);
  const [suggestions, setSuggestions] = useState<ScenarioSuggestion[]>([]);
  const [baseForecast, setBaseForecast] = useState<ForecastResponse | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [expenses, setExpenses] = useState<ExpenseBucket[]>([]);
  const [rules, setRules] = useState<FinancialRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savedScenariosDialogOpen, setSavedScenariosDialogOpen] = useState(false);
  const [appliedScenarios, setAppliedScenarios] = useState<string[]>([]);

  // Scenario builder state
  const [, setIsBuilding] = useState(false);
  const [scenarioType, setScenarioType] = useState<ScenarioType | ''>('');
  const [scenarioName, setScenarioName] = useState('');
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [comparison, setComparison] = useState<ScenarioComparisonResponse | null>(null);

  // Parent scenario state for second-order effects
  const [parentScenario, setParentScenario] = useState<Scenario | null>(null);
  const [parentComparison, setParentComparison] = useState<ScenarioComparisonResponse | null>(null);

  // Form fields for different scenario types
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedExpense, setSelectedExpense] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [amount, setAmount] = useState('');
  const [delayDays, setDelayDays] = useState('');
  const [isBuildingScenario, setIsBuildingScenario] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  // TAMI chat state
  const [tamiMessages, setTamiMessages] = useState<TamiMessage[]>([]);
  const [tamiInput, setTamiInput] = useState('');
  const [isTamiLoading, setIsTamiLoading] = useState(false);
  const [isTamiDialogOpen, setIsTamiDialogOpen] = useState(false);
  const tamiScrollRef = useRef<HTMLDivElement>(null);
  const tamiInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [scenariosData, suggestionsData, forecastData, clientsData, expensesData, rulesData] = await Promise.all([
          getScenarios(user.id, 'saved').catch(() => []),
          getScenarioSuggestions(user.id).catch(() => ({ suggestions: [] })),
          getForecast(user.id).catch(() => null),
          getClients(user.id).catch(() => []),
          getExpenses(user.id).catch(() => []),
          getRules(user.id).catch(() => []),
        ]);

        setSavedScenarios(scenariosData);
        setSuggestions(suggestionsData.suggestions || []);
        setBaseForecast(forecastData);
        setClients(clientsData.filter((c) => c.status === 'active'));
        setExpenses(expensesData);
        setRules(rulesData);

        // Check if there's a type in URL params
        const typeParam = searchParams.get('type');
        if (typeParam && typeParam in scenarioTypeConfig) {
          setScenarioType(typeParam as ScenarioType);
          setIsBuilding(true);
        }
      } catch (error) {
        console.error('Failed to fetch scenario data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, searchParams]);

  // Auto-scroll TAMI chat
  useEffect(() => {
    if (tamiScrollRef.current) {
      tamiScrollRef.current.scrollTop = tamiScrollRef.current.scrollHeight;
    }
  }, [tamiMessages]);

  const handleStartScenario = (type: ScenarioType, suggestion?: ScenarioSuggestion, isSecondOrder = false) => {
    if (isSecondOrder && activeScenario && comparison) {
      setParentScenario(activeScenario);
      setParentComparison(comparison);
    }

    setScenarioType(type);
    setScenarioName(suggestion?.name || `${scenarioTypeConfig[type].label} Scenario`);
    setIsBuilding(true);
    setComparison(null);

    if (suggestion?.prefill_params) {
      const params = suggestion.prefill_params as Record<string, unknown>;
      if (params.client_id) setSelectedClient(params.client_id as string);
      if (params.effective_date) setEffectiveDate(params.effective_date as string);
      if (params.amount) setAmount(String(params.amount));
      if (params.delay_days) setDelayDays(String(params.delay_days));
    } else {
      setSelectedClient('');
      setEffectiveDate('');
      setAmount('');
      setDelayDays('');
    }
  };

  const handleBuildScenario = async () => {
    if (!user || !scenarioType) return;

    setIsBuildingScenario(true);
    setBuildError(null);

    // Build scope_config based on scenario type
    const buildScopeConfig = () => {
      if (selectedClient) return { client_id: selectedClient };
      if (selectedExpense) return { bucket_id: selectedExpense };
      return {};
    };

    try {
      if (parentScenario) {
        await addScenarioLayer(parentScenario.id, {
          layer_type: scenarioType,
          layer_name: scenarioName,
          parameters: {
            effective_date: effectiveDate || new Date().toISOString().split('T')[0],
            amount,
            delay_days: delayDays ? parseInt(delayDays) : undefined,
            client_id: selectedClient || undefined,
            bucket_id: selectedExpense || undefined,
          },
        });

        const comparisonData = await getScenarioForecast(parentScenario.id);
        setComparison(comparisonData);
        setActiveScenario(parentScenario);
      } else {
        const scenario = await createScenario({
          user_id: user.id,
          name: scenarioName,
          scenario_type: scenarioType,
          entry_path: 'user_defined',
          scope_config: buildScopeConfig(),
          parameters: {
            effective_date: effectiveDate || new Date().toISOString().split('T')[0],
            amount,
            delay_days: delayDays ? parseInt(delayDays) : undefined,
          },
        });

        setActiveScenario(scenario);
        await buildScenario(scenario.id);
        const comparisonData = await getScenarioForecast(scenario.id);
        setComparison(comparisonData);
      }
    } catch (error) {
      console.error('Failed to build scenario:', error);
      setBuildError(error instanceof Error ? error.message : 'Failed to build scenario. Please try again.');
    } finally {
      setIsBuildingScenario(false);
    }
  };

  const handleSaveScenario = async () => {
    if (!activeScenario) return;

    try {
      await saveScenario(activeScenario.id);
      setSavedScenarios([...savedScenarios, { ...activeScenario, status: 'saved' }]);
      setIsBuilding(false);
      setActiveScenario(null);
      setComparison(null);
      resetForm();
    } catch (error) {
      console.error('Failed to save scenario:', error);
    }
  };

  const handleDiscardScenario = async () => {
    if (activeScenario) {
      await deleteScenario(activeScenario.id).catch(() => {});
    }
    setIsBuilding(false);
    setActiveScenario(null);
    setComparison(null);
    resetForm();
  };

  const resetForm = () => {
    setScenarioType('');
    setScenarioName('');
    setSelectedClient('');
    setSelectedExpense('');
    setEffectiveDate('');
    setAmount('');
    setDelayDays('');
    setParentScenario(null);
    setParentComparison(null);
  };

  const toggleAppliedScenario = (scenarioId: string) => {
    setAppliedScenarios((prev) =>
      prev.includes(scenarioId) ? prev.filter((id) => id !== scenarioId) : [...prev, scenarioId]
    );
  };

  // TAMI handlers
  const handleTamiSend = async (messageText?: string) => {
    const text = messageText || tamiInput.trim();
    if (!text || !user) return;

    const userMessage: TamiMessage = {
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setTamiMessages((prev) => [...prev, userMessage]);
    setTamiInput('');
    setIsTamiLoading(true);

    // Add streaming placeholder message
    const streamingMessage: TamiMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };
    setTamiMessages((prev) => [...prev, streamingMessage]);

    const conversationHistory = formatConversationHistory(
      tamiMessages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }))
    );

    await sendChatMessageStreaming(
      {
        user_id: user.id,
        message: text,
        conversation_history: conversationHistory,
        active_scenario_id: activeScenario?.id || null,
      },
      // onChunk
      (chunk) => {
        setTamiMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, content: lastMsg.content + chunk }
            ];
          }
          return prev;
        });
      },
      // onDone
      (event) => {
        setTamiMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              {
                ...lastMsg,
                isStreaming: false,
                mode: event.mode,
                suggestedActions: event.ui_hints?.suggested_actions,
              }
            ];
          }
          return prev;
        });
        setIsTamiLoading(false);
        tamiInputRef.current?.focus();
      },
      // onError
      (error) => {
        console.error('Streaming error:', error);
        setTamiMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
            return [
              ...prev.slice(0, -1),
              {
                ...lastMsg,
                content: 'I encountered an error processing your request. Please try again.',
                isStreaming: false,
                mode: 'clarify' as const,
              }
            ];
          }
          return prev;
        });
        setIsTamiLoading(false);
        tamiInputRef.current?.focus();
      }
    );
  };

  const getInferredClientAmount = (): string | null => {
    if (scenarioType !== 'client_loss' || !selectedClient) return null;
    const client = clients.find((c) => c.id === selectedClient);
    if (!client?.billing_config?.amount) return null;
    return client.billing_config.amount;
  };

  const getAmountLabel = (): string => {
    switch (scenarioType) {
      case 'client_gain':
      case 'hiring':
      case 'contractor_gain':
      case 'increased_expense':
        return 'Monthly Amount ($)';
      case 'client_change':
        return 'Change Amount (+/-)';
      case 'firing':
      case 'contractor_loss':
      case 'decreased_expense':
        return 'Monthly Reduction ($)';
      default:
        return 'Amount ($)';
    }
  };

  const requiresAmountInput = (): boolean => {
    return [
      'client_gain',
      'hiring',
      'contractor_gain',
      'increased_expense',
      'client_change',
      'firing',
      'contractor_loss',
      'decreased_expense',
    ].includes(scenarioType);
  };

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Generate suggested scenarios based on client data (matching Dashboard logic)
  const generateSuggestedScenarios = (): ScenarioSuggestion[] => {
    const generatedSuggestions: ScenarioSuggestion[] = [];

    // Calculate total income from clients
    const totalClientIncome = clients.reduce((sum, client) => {
      const amount = parseFloat(client.billing_config?.amount || '0');
      return sum + amount;
    }, 0);

    // Check for high concentration clients (>40%)
    clients.forEach((client) => {
      const clientAmount = parseFloat(client.billing_config?.amount || '0');
      const concentration = totalClientIncome > 0 ? (clientAmount / totalClientIncome) * 100 : 0;

      if (concentration > 40) {
        generatedSuggestions.push({
          scenario_type: 'payment_delay_in',
          name: `Late payment from ${client.name}`,
          description: `${client.name} represents ${concentration.toFixed(0)}% of your income. A late payment could significantly impact cash flow.`,
          prefill_params: { client_id: client.id, delay_days: 30 },
          priority: 'high',
        });

        generatedSuggestions.push({
          scenario_type: 'client_loss',
          name: `Lose ${client.name}`,
          description: `What happens if you lose your largest client who accounts for ${concentration.toFixed(0)}% of revenue?`,
          prefill_params: { client_id: client.id },
          priority: 'high',
        });
      } else if (concentration > 25) {
        generatedSuggestions.push({
          scenario_type: 'payment_delay_in',
          name: `Late payment from ${client.name}`,
          description: `${client.name} is ${concentration.toFixed(0)}% of income. Explore the impact of delayed payment.`,
          prefill_params: { client_id: client.id, delay_days: 14 },
          priority: 'medium',
        });
      }
    });

    // Check for clients with high churn risk
    clients.filter(c => c.churn_risk === 'high').forEach((client) => {
      if (!generatedSuggestions.find(s => s.prefill_params?.client_id === client.id && s.scenario_type === 'client_loss')) {
        generatedSuggestions.push({
          scenario_type: 'client_loss',
          name: `Lose ${client.name}`,
          description: `${client.name} has high churn risk. Plan for potential loss.`,
          prefill_params: { client_id: client.id },
          priority: 'high',
        });
      }
    });

    // Check for clients with payment delays
    clients.filter(c => c.payment_behavior === 'delayed').forEach((client) => {
      if (!generatedSuggestions.find(s => s.prefill_params?.client_id === client.id && s.scenario_type === 'payment_delay_in')) {
        generatedSuggestions.push({
          scenario_type: 'payment_delay_in',
          name: `Extended delay from ${client.name}`,
          description: `${client.name} has a history of late payments. Model an extended delay.`,
          prefill_params: { client_id: client.id, delay_days: 30 },
          priority: 'medium',
        });
      }
    });

    // Add default scenarios if we don't have enough
    const defaultScenarios: ScenarioSuggestion[] = [
      {
        scenario_type: 'increased_expense',
        name: 'Increase in operating costs',
        description: 'Model a 10% increase in your monthly operating expenses.',
        prefill_params: {},
        priority: 'medium',
      },
      {
        scenario_type: 'hiring',
        name: 'New hire',
        description: 'Model the impact of adding a new team member.',
        prefill_params: {},
        priority: 'low',
      },
      {
        scenario_type: 'decreased_expense',
        name: 'Reduce expenses by 15%',
        description: 'Model cutting costs to improve runway.',
        prefill_params: {},
        priority: 'low',
      },
    ];

    // Fill up to 3 scenarios with defaults if needed
    while (generatedSuggestions.length < 3 && defaultScenarios.length > 0) {
      const defaultScenario = defaultScenarios.shift();
      if (defaultScenario && !generatedSuggestions.find(s => s.scenario_type === defaultScenario.scenario_type)) {
        generatedSuggestions.push(defaultScenario);
      }
    }

    return generatedSuggestions.slice(0, 3); // Limit to 3 suggestions for TAMI sidebar
  };

  // Combine API suggestions with generated ones
  const allSuggestions = suggestions.length > 0 ? suggestions : generateSuggestedScenarios();

  // Calculate buffer amount from base forecast (matching Dashboard logic)
  const bufferRule = rules.find((r) => r.rule_type === 'minimum_cash_buffer');
  const bufferMonths = (bufferRule?.threshold_config as { months?: number })?.months || 3;
  const monthlyExpenses = baseForecast
    ? baseForecast.weeks.slice(0, 4).reduce((sum, week) => sum + parseFloat(week.cash_out || '0'), 0)
    : 30000;
  const bufferAmount = monthlyExpenses * bufferMonths;

  // Chart data - combine base and scenario if available
  const chartData = comparison
    ? comparison.base_forecast?.weeks.map((baseWeek, index) => {
        const scenarioWeek = comparison.scenario_forecast?.weeks[index];
        return {
          week: `Week ${baseWeek.week_number}`,
          base: parseFloat(baseWeek.ending_balance),
          scenario: scenarioWeek ? parseFloat(scenarioWeek.ending_balance) : parseFloat(baseWeek.ending_balance),
          buffer: bufferAmount,
        };
      })
    : baseForecast?.weeks.map((week) => ({
        week: `Week ${week.week_number}`,
        base: parseFloat(week.ending_balance),
        scenario: null,
        buffer: bufferAmount,
      })) || [];

  // Determine buffer status
  const isBufferSafe = comparison
    ? !comparison.rule_evaluations?.some((r) => !r.passed)
    : baseForecast
    ? parseFloat(baseForecast.summary.lowest_cash_amount) > bufferAmount
    : true;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Skeleton className="lg:col-span-3 h-[500px]" />
          <Skeleton className="h-[500px]" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold tracking-tight">Scenario Analysis</h1>

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column - Chart */}
        <div className="lg:col-span-3">
          <NeuroCard>
            <NeuroCardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <NeuroCardTitle>13 Week Forecast</NeuroCardTitle>
                <div className="flex items-center gap-3">
                  {/* Apply Saved Scenarios Button */}
                  <Dialog open={savedScenariosDialogOpen} onOpenChange={setSavedScenariosDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="bg-lime/20 border-lime hover:bg-lime/30">
                        Apply Saved Scenarios
                        {appliedScenarios.length > 0 && (
                          <Badge className="ml-2 bg-lime text-foreground">{appliedScenarios.length}</Badge>
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Saved Scenarios</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-2 mt-4">
                        {savedScenarios.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No saved scenarios yet. Build and save a scenario to see it here.
                          </p>
                        ) : (
                          savedScenarios.map((scenario) => (
                            <div
                              key={scenario.id}
                              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                                appliedScenarios.includes(scenario.id)
                                  ? 'bg-lime/10 border-lime'
                                  : 'hover:bg-muted'
                              }`}
                              onClick={() => toggleAppliedScenario(scenario.id)}
                            >
                              <div>
                                <p className="font-medium">{scenario.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {scenarioTypeConfig[scenario.scenario_type]?.label}
                                </p>
                              </div>
                              {appliedScenarios.includes(scenario.id) && (
                                <CheckCircle2 className="h-5 w-5 text-lime" />
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Status Badge */}
                  <Badge
                    className={`px-4 py-1.5 text-sm ${
                      isBufferSafe ? 'bg-lime text-foreground' : 'bg-tomato text-white'
                    }`}
                  >
                    {isBufferSafe ? 'Cash Buffer Safe' : 'Buffer At Risk'}
                  </Badge>
                </div>
              </div>
            </NeuroCardHeader>
            <NeuroCardContent>
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mb-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[var(--chart-1)]" />
                  <span>Base Forecast</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-lime" />
                  <span>Scenario Forecast</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-0.5 border-b-2 border-dashed border-tomato" />
                  <span>Cash Buffer (Minimum)</span>
                </div>
              </div>

              {/* Chart */}
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="week"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)},000`}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-background p-3 shadow-xl">
                            <p className="font-medium mb-2">{label}</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between gap-4">
                                <span style={{ color: 'var(--chart-1)' }}>Base:</span>
                                <span className="font-medium" style={{ color: 'var(--chart-1)' }}>{formatCurrency(data.base)}</span>
                              </div>
                              {data.scenario !== null && (
                                <>
                                  <div className="flex justify-between gap-4">
                                    <span className="text-lime">Scenario:</span>
                                    <span className="font-medium text-lime">
                                      {formatCurrency(data.scenario)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-4 pt-1 border-t">
                                    <span className="text-muted-foreground">Difference:</span>
                                    <span
                                      className={`font-medium ${
                                        data.scenario - data.base >= 0 ? 'text-lime' : 'text-tomato'
                                      }`}
                                    >
                                      {data.scenario - data.base >= 0 ? '+' : ''}
                                      {formatCurrency(data.scenario - data.base)}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <defs>
                    <linearGradient id="fillBase" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="fillScenario" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--lime)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--lime)" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  {/* Base forecast area - matches Dashboard style */}
                  <Area
                    type="monotone"
                    dataKey="base"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#fillBase)"
                    fillOpacity={0.4}
                  />
                  {/* Scenario forecast area - lime green */}
                  {comparison && (
                    <Area
                      type="monotone"
                      dataKey="scenario"
                      stroke="var(--lime)"
                      strokeWidth={2}
                      fill="url(#fillScenario)"
                      fillOpacity={0.4}
                    />
                  )}
                  {/* Cash buffer reference line */}
                  <ReferenceLine
                    y={bufferAmount}
                    stroke="var(--tomato)"
                    strokeDasharray="8 4"
                    strokeWidth={2}
                    label={{
                      value: 'Cash Buffer',
                      position: 'insideTopRight',
                      fill: 'var(--tomato)',
                      fontSize: 11,
                    }}
                  />
                </AreaChart>
              </ChartContainer>
            </NeuroCardContent>
          </NeuroCard>
        </div>

        {/* Right Column - Suggested Scenarios Sidebar */}
        <div className="lg:col-span-1 flex flex-col">
          <NeuroCard className="flex-1">
            <NeuroCardHeader className="pb-4">
              <NeuroCardTitle>Suggested Scenarios</NeuroCardTitle>
            </NeuroCardHeader>
            <NeuroCardContent className="space-y-3">
              {/* Show suggested scenarios - Elegant icon-free cards */}
              {allSuggestions.slice(0, 3).map((suggestion, index) => {
                const priority = suggestion.priority || 'medium';

                // Risk level styling with coral for high risk
                const riskStyles: Record<string, { gradient: string; border: string; badge: string; badgeText: string }> = {
                  high: {
                    gradient: 'from-[#FF4F3F]/10 via-[#FF4F3F]/5 to-transparent',
                    border: 'border-l-4 border-l-[#FF4F3F]',
                    badge: 'bg-[#FF4F3F]/10 border-[#FF4F3F]/30',
                    badgeText: 'text-[#FF4F3F]',
                  },
                  medium: {
                    gradient: 'from-yellow-400/10 via-yellow-500/5 to-transparent',
                    border: 'border-l-4 border-l-yellow-500',
                    badge: 'bg-yellow-500/10 border-yellow-500/30',
                    badgeText: 'text-yellow-700',
                  },
                  low: {
                    gradient: 'from-lime/10 via-lime/5 to-transparent',
                    border: 'border-l-4 border-l-lime',
                    badge: 'bg-lime/10 border-lime/30',
                    badgeText: 'text-lime-700',
                  },
                };

                const style = riskStyles[priority] || riskStyles.medium;

                return (
                  <div
                    key={index}
                    onClick={() => handleStartScenario(suggestion.scenario_type, suggestion)}
                    className={`relative cursor-pointer min-h-[72px] bg-gradient-to-r ${style.gradient} backdrop-blur-sm ${style.border} rounded-lg p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 group`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-heading font-bold text-base text-gray-900 mb-1 group-hover:text-[#FF4F3F] transition-colors">
                          {suggestion.name}
                        </h3>
                        {suggestion.description && (
                          <p className="text-xs text-gray-600 line-clamp-1">
                            {suggestion.description}
                          </p>
                        )}
                      </div>

                      {/* Risk Badge */}
                      <div className={`flex-shrink-0 px-2.5 py-1 rounded-md text-xs font-heading font-semibold border ${style.badge} ${style.badgeText}`}>
                        {priority === 'high' ? 'High' : priority === 'medium' ? 'Medium' : 'Low'}
                      </div>
                    </div>

                    {/* Hover Arrow Indicator */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">
                      <svg className="w-4 h-4 text-[#FF4F3F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                );
              })}

              {/* Chat with TAMI Button */}
              <Dialog open={isTamiDialogOpen} onOpenChange={setIsTamiDialogOpen}>
                <DialogTrigger asChild>
                  <div className="cursor-pointer rounded-xl p-3 bg-lime/10 border border-lime/30 hover:bg-lime/20 transition-all mt-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-lime flex items-center justify-center">
                        <MessageCircle className="h-4 w-4 text-gunmetal" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Chat with TAMI</p>
                        <p className="text-xs text-gray-500">Get help with scenarios</p>
                      </div>
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0 gap-0">
              <DialogHeader className="p-4 border-b">
                <DialogTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-lime flex items-center justify-center">
                    <Bot className="h-5 w-5 text-gunmetal" />
                  </div>
                  <div>
                    <span className="block">Chat with TAMI</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {comparison ? `Analyzing: ${scenarioName}` : 'Scenario Assistant'}
                    </span>
                  </div>
                </DialogTitle>
              </DialogHeader>

              {/* Scenario Context Banner */}
              {comparison && (
                <div className="px-4 py-3 bg-lime/10 border-b border-lime/20">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Active Scenario</p>
                  <p className="font-semibold text-sm">{scenarioName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {scenarioTypeConfig[scenarioType as ScenarioType]?.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs ${isBufferSafe ? 'bg-lime/20 border-lime/50' : 'bg-tomato/20 border-tomato/50'}`}
                    >
                      {isBufferSafe ? 'Safe' : 'At Risk'}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Chat Messages */}
              <ScrollArea className="flex-1 p-4" ref={tamiScrollRef}>
                {tamiMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-lime/20 flex items-center justify-center mb-4">
                      <Bot className="h-6 w-6 text-lime-700" />
                    </div>
                    <h3 className="font-semibold mb-1">How can I help?</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {comparison
                        ? 'Ask me about this scenario\'s impact on your business.'
                        : 'Ask me to help you explore scenarios or understand risks.'}
                    </p>
                    <div className="flex flex-col gap-2 w-full max-w-xs">
                      {comparison ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => handleTamiSend('What is the cash impact of this scenario?')}
                          >
                            What's the cash impact?
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => handleTamiSend('What actions should I take?')}
                          >
                            What actions should I take?
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => handleTamiSend('How does this affect my runway?')}
                          >
                            How does this affect runway?
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => handleTamiSend('What scenarios should I run?')}
                          >
                            What scenarios should I run?
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => handleTamiSend('What are my biggest risks?')}
                          >
                            What are my biggest risks?
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tamiMessages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {message.role === 'assistant' && (
                          <Avatar className="h-7 w-7 border border-lime/30">
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              <Bot className="h-3.5 w-3.5" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={`max-w-[85%] ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3 py-2 text-sm shadow-sm'
                              : 'space-y-2'
                          }`}
                        >
                          {message.role === 'assistant' ? (
                            message.isStreaming && message.content === '' ? (
                              <div className="flex items-center gap-1 py-1">
                                <span className="w-1.5 h-1.5 bg-lime rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-1.5 h-1.5 bg-lime rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-1.5 h-1.5 bg-lime rounded-full animate-bounce" />
                              </div>
                            ) : (
                              <div className="prose prose-sm dark:prose-invert max-w-none text-sm prose-p:leading-relaxed prose-p:my-1">
                                <ReactMarkdown>{message.content}</ReactMarkdown>
                              </div>
                            )
                          ) : (
                            <p className="leading-relaxed">{message.content}</p>
                          )}
                        </div>
                        {message.role === 'user' && (
                          <Avatar className="h-7 w-7 border border-muted">
                            <AvatarFallback className="bg-muted">
                              <User className="h-3.5 w-3.5" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Chat Input */}
              <div className="p-4 border-t bg-muted/30">
                <div className="flex gap-2">
                  <Input
                    ref={tamiInputRef}
                    value={tamiInput}
                    onChange={(e) => setTamiInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleTamiSend();
                      }
                    }}
                    placeholder={comparison ? 'Ask about this scenario...' : 'Ask anything...'}
                    disabled={isTamiLoading}
                    className="flex-1 text-sm h-10 rounded-xl"
                  />
                  <Button
                    size="icon"
                    onClick={() => handleTamiSend()}
                    disabled={!tamiInput.trim() || isTamiLoading}
                    className="h-10 w-10 rounded-xl"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                  </div>
                </div>
                </DialogContent>
              </Dialog>
            </NeuroCardContent>
          </NeuroCard>
        </div>
      </div>

      {/* Scenario Builder Form */}
      <NeuroCard>
        <NeuroCardHeader>
          <NeuroCardTitle>Run a New Scenario</NeuroCardTitle>
          {scenarioType && (
            <p className="text-sm text-muted-foreground">
              {scenarioTypeConfig[scenarioType as ScenarioType]?.description}
            </p>
          )}
        </NeuroCardHeader>
        <NeuroCardContent>
          {/* Scenario Result Summary */}
          {comparison && (
            <div className="mb-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{scenarioName}</h3>
                <Badge variant={isBufferSafe ? 'default' : 'destructive'}>
                  {isBufferSafe ? 'Buffer Safe' : 'Buffer At Risk'}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Impact at Week 13</p>
                  <p
                    className={`text-xl font-bold ${
                      parseFloat(comparison.scenario_forecast.weeks[12]?.ending_balance || '0') -
                        parseFloat(comparison.base_forecast.weeks[12]?.ending_balance || '0') >=
                      0
                        ? 'text-lime'
                        : 'text-tomato'
                    }`}
                  >
                    {formatCurrency(
                      parseFloat(comparison.scenario_forecast.weeks[12]?.ending_balance || '0') -
                        parseFloat(comparison.base_forecast.weeks[12]?.ending_balance || '0')
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Base Position</p>
                  <p className="text-xl font-semibold">
                    {formatCurrency(comparison.base_forecast.weeks[12]?.ending_balance || '0')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Scenario Position</p>
                  <p className="text-xl font-semibold">
                    {formatCurrency(comparison.scenario_forecast.weeks[12]?.ending_balance || '0')}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button onClick={handleSaveScenario} className="bg-lime text-foreground hover:bg-lime/90">
                  <Save className="h-4 w-4 mr-2" />
                  Save Scenario
                </Button>
                <Button variant="destructive" onClick={handleDiscardScenario}>
                  <X className="h-4 w-4 mr-2" />
                  Discard
                </Button>
              </div>

              {/* Second-Order Effects */}
              {comparison.suggested_scenarios && comparison.suggested_scenarios.length > 0 && (
                <div className="mt-6 pt-5 border-t">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 rounded-md bg-primary/10">
                      <Link2 className="h-4 w-4 text-primary" />
                    </div>
                    <p className="font-medium">Add Second-Order Effect</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {comparison.suggested_scenarios.slice(0, 4).map((suggestion, index) => (
                      <NeuroCard
                        key={index}
                        className="cursor-pointer group p-4 hover:shadow-xl hover:border-lime/50"
                        onClick={() => handleStartScenario(suggestion.scenario_type, suggestion, true)}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div
                              className={`p-1.5 rounded-md ${
                                suggestion.priority === 'high'
                                  ? 'bg-tomato/10'
                                  : suggestion.priority === 'medium'
                                  ? 'bg-amber-500/10'
                                  : 'bg-lime/10'
                              }`}
                            >
                              <Link2
                                className={`h-3.5 w-3.5 ${
                                  suggestion.priority === 'high'
                                    ? 'text-tomato'
                                    : suggestion.priority === 'medium'
                                    ? 'text-amber-500'
                                    : 'text-lime'
                                }`}
                              />
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0.5 ${
                                suggestion.priority === 'high'
                                  ? 'bg-tomato/10 border-tomato/30 text-tomato'
                                  : suggestion.priority === 'medium'
                                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-600'
                                  : 'bg-lime/10 border-lime/30 text-lime-foreground'
                              }`}
                            >
                              {suggestion.priority}
                            </Badge>
                          </div>
                          <p className="text-sm font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-1">
                            {suggestion.name}
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                            {suggestion.description}
                          </p>
                          <div className="mt-3 pt-3 border-t border-dashed">
                            <span className="text-xs text-primary font-medium group-hover:underline">
                              Add to scenario →
                            </span>
                          </div>
                        </div>
                      </NeuroCard>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form */}
          {!comparison && (
            <div className="space-y-4">
              {/* Parent Scenario Indicator */}
              {parentScenario && parentComparison && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Building on</p>
                  <p className="font-medium">{parentScenario.name}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Scenario Name</Label>
                  <Input
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder="Client Loss Scenario"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Scenario Type</Label>
                  <Select value={scenarioType} onValueChange={(v) => setScenarioType(v as ScenarioType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(scenarioTypeConfig).map(([type, config]) => (
                        <SelectItem key={type} value={type}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Client selector */}
                {['client_loss', 'client_change', 'payment_delay_in'].includes(scenarioType) && (
                  <div className="space-y-2">
                    <Label>Client Name</Label>
                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Expense selector for payment_delay_out */}
                {scenarioType === 'payment_delay_out' && (
                  <div className="space-y-2">
                    <Label>Expense / Vendor</Label>
                    <Select value={selectedExpense} onValueChange={setSelectedExpense}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select expense to delay" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenses.map((expense) => (
                          <SelectItem key={expense.id} value={expense.id}>
                            {expense.name} ({formatCurrency(parseFloat(expense.monthly_amount))}/mo)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Effective Date</Label>
                  <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                </div>

                {/* Inferred amount for client_loss */}
                {scenarioType === 'client_loss' && selectedClient && (
                  <div className="space-y-2">
                    <Label>Monthly Impact</Label>
                    <div className="h-10 px-3 py-2 border rounded-md bg-muted text-muted-foreground flex items-center">
                      {getInferredClientAmount()
                        ? formatCurrency(parseFloat(getInferredClientAmount()!))
                        : 'Select a client'}
                    </div>
                  </div>
                )}

                {/* Amount input */}
                {requiresAmountInput() && (
                  <div className="space-y-2">
                    <Label>{getAmountLabel()}</Label>
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="10000"
                    />
                  </div>
                )}

                {/* Delay days */}
                {['payment_delay_in', 'payment_delay_out'].includes(scenarioType) && (
                  <div className="space-y-2">
                    <Label>Delay (days)</Label>
                    <Input
                      type="number"
                      value={delayDays}
                      onChange={(e) => setDelayDays(e.target.value)}
                      placeholder="14"
                    />
                  </div>
                )}
              </div>

              {buildError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                  {buildError}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleDiscardScenario} disabled={isBuildingScenario}>
                  Cancel
                </Button>
                <Button
                  onClick={handleBuildScenario}
                  disabled={isBuildingScenario || !scenarioType}
                  className="bg-primary"
                >
                  {isBuildingScenario ? 'Building...' : 'Build Scenario'}
                </Button>
              </div>
            </div>
          )}
        </NeuroCardContent>
      </NeuroCard>
    </div>
  );
}
