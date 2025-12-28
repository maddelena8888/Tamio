import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import {
  AlertTriangle,
  Users,
  UserPlus,
  UserMinus,
  TrendingUp,
  TrendingDown,
  Clock,
  Building,
  X,
  Save,
  Eye,
  Link2,
} from 'lucide-react';
import {
  getScenarios,
  getScenarioSuggestions,
  createScenario,
  buildScenario,
  getScenarioForecast,
  saveScenario,
  deleteScenario,
} from '@/lib/api/scenarios';
import { getClients } from '@/lib/api/data';
import { getForecast } from '@/lib/api/forecast';
import type {
  Scenario,
  ScenarioType,
  ScenarioSuggestion,
  ScenarioComparisonResponse,
  ForecastResponse,
  Client,
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
  base: { label: 'Base Forecast', color: 'var(--muted-foreground)' },
  scenario: { label: 'Scenario Forecast', color: 'var(--chart-1)' },
  buffer: { label: 'Cash Buffer', color: 'var(--chart-3)' },
} satisfies ChartConfig;

export default function Scenarios() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [savedScenarios, setSavedScenarios] = useState<Scenario[]>([]);
  const [suggestions, setSuggestions] = useState<ScenarioSuggestion[]>([]);
  const [_baseForecast, setBaseForecast] = useState<ForecastResponse | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Scenario builder state
  const [isBuilding, setIsBuilding] = useState(false);
  const [scenarioType, setScenarioType] = useState<ScenarioType | ''>('');
  const [scenarioName, setScenarioName] = useState('');
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [comparison, setComparison] = useState<ScenarioComparisonResponse | null>(null);

  // Form fields for different scenario types
  const [selectedClient, setSelectedClient] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [amount, setAmount] = useState('');
  const [delayDays, setDelayDays] = useState('');

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [scenariosData, suggestionsData, forecastData, clientsData] = await Promise.all([
          getScenarios(user.id, 'saved').catch(() => []),
          getScenarioSuggestions(user.id).catch(() => ({ suggestions: [] })),
          getForecast(user.id).catch(() => null),
          getClients(user.id).catch(() => []),
        ]);

        setSavedScenarios(scenariosData);
        setSuggestions(suggestionsData.suggestions || []);
        setBaseForecast(forecastData);
        setClients(clientsData.filter((c) => c.status === 'active'));

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

  const handleStartScenario = (type: ScenarioType, suggestion?: ScenarioSuggestion) => {
    setScenarioType(type);
    setScenarioName(suggestion?.name || `${scenarioTypeConfig[type].label} Scenario`);
    setIsBuilding(true);
    setComparison(null);

    // Pre-fill from suggestion if available
    if (suggestion?.prefill_params) {
      const params = suggestion.prefill_params as Record<string, string>;
      if (params.client_id) setSelectedClient(params.client_id);
      if (params.effective_date) setEffectiveDate(params.effective_date);
      if (params.amount) setAmount(params.amount);
    }
  };

  const handleBuildScenario = async () => {
    if (!user || !scenarioType) return;

    try {
      // Create scenario
      const scenario = await createScenario({
        user_id: user.id,
        name: scenarioName,
        scenario_type: scenarioType,
        entry_path: 'user_defined',
        scope_config: selectedClient ? { client_id: selectedClient } : {},
        parameters: {
          effective_date: effectiveDate || new Date().toISOString().split('T')[0],
          amount,
          delay_days: delayDays ? parseInt(delayDays) : undefined,
        },
      });

      setActiveScenario(scenario);

      // Build scenario
      await buildScenario(scenario.id);

      // Get comparison
      const comparisonData = await getScenarioForecast(scenario.id);
      setComparison(comparisonData);
    } catch (error) {
      console.error('Failed to build scenario:', error);
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
    setEffectiveDate('');
    setAmount('');
    setDelayDays('');
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

  // Chart data
  const chartData =
    comparison?.base_forecast?.weeks.map((baseWeek, index) => {
      const scenarioWeek = comparison?.scenario_forecast?.weeks[index];
      return {
        week: `Week ${baseWeek.week_number}`,
        base: parseFloat(baseWeek.ending_balance),
        scenario: scenarioWeek ? parseFloat(scenarioWeek.ending_balance) : parseFloat(baseWeek.ending_balance),
      };
    }) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Scenario Analysis</h1>
        <Button
          onClick={() => navigate('/tami')}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          TAMI
        </Button>
      </div>

      {/* Saved Scenarios */}
      {savedScenarios.length > 0 && !isBuilding && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Saved Scenarios</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {savedScenarios.map((scenario) => (
              <Card
                key={scenario.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
              >
                <CardContent className="p-4">
                  <h3 className="font-medium">{scenario.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {scenarioTypeConfig[scenario.scenario_type]?.label}
                  </p>
                  <Badge variant="outline" className="mt-2">
                    Saved
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Scenario Builder */}
      {isBuilding ? (
        <div className="space-y-6">
          {/* Comparison Chart */}
          {comparison && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>13 Week Forecast</CardTitle>
                  <CardDescription>Base vs Scenario comparison</CardDescription>
                </div>
                <Badge
                  className={
                    comparison.rule_evaluations.some((r) => !r.passed)
                      ? 'bg-tomato text-white'
                      : 'bg-lime text-foreground'
                  }
                >
                  {comparison.rule_evaluations.some((r) => !r.passed)
                    ? 'Buffer At Risk'
                    : 'Cash Buffer Safe'}
                </Badge>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                      <YAxis
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="base"
                        stroke="var(--muted-foreground)"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="scenario"
                        stroke="var(--chart-1)"
                        strokeWidth={2}
                        dot={{ r: 4, fill: 'var(--chart-1)' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-0.5 border-b-2 border-dashed border-muted-foreground" />
                    <span>Base Forecast</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[var(--chart-1)]" />
                    <span>Scenario Forecast</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Impact Summary */}
          {comparison && (
            <Card>
              <CardHeader>
                <CardTitle>{scenarioName}</CardTitle>
                <CardDescription>Type: {scenarioTypeConfig[scenarioType as ScenarioType]?.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Impact on Week 13:</p>
                    <p
                      className={`text-2xl font-bold ${
                        parseFloat(comparison.scenario_forecast.summary.lowest_cash_amount) <
                        parseFloat(comparison.base_forecast.summary.lowest_cash_amount)
                          ? 'text-tomato'
                          : 'text-lime'
                      }`}
                    >
                      {formatCurrency(
                        parseFloat(comparison.scenario_forecast.weeks[12]?.ending_balance || '0') -
                          parseFloat(comparison.base_forecast.weeks[12]?.ending_balance || '0')
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Base: {formatCurrency(comparison.base_forecast.weeks[12]?.ending_balance || '0')} →
                      Scenario: {formatCurrency(comparison.scenario_forecast.weeks[12]?.ending_balance || '0')}
                    </p>
                  </div>

                  {/* Related Scenarios */}
                  {comparison.suggested_scenarios?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Related Scenarios to Consider
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {comparison.suggested_scenarios.slice(0, 4).map((suggestion, index) => (
                          <Card
                            key={index}
                            className="cursor-pointer hover:border-primary/50"
                            onClick={() => handleStartScenario(suggestion.scenario_type, suggestion)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge
                                  variant="outline"
                                  className={
                                    suggestion.priority === 'high'
                                      ? 'border-tomato text-tomato'
                                      : ''
                                  }
                                >
                                  {suggestion.priority}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium">{suggestion.name}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {suggestion.description}
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <Button variant="outline" onClick={() => navigate('/')}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Full Forecast
                  </Button>
                  <Button onClick={handleSaveScenario} className="bg-lime text-foreground hover:bg-lime/90">
                    <Save className="h-4 w-4 mr-2" />
                    Save Scenario
                  </Button>
                  <Button variant="destructive" onClick={handleDiscardScenario}>
                    <X className="h-4 w-4 mr-2" />
                    Discard
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scenario Form */}
          {!comparison && (
            <Card>
              <CardHeader>
                <CardTitle>Run a New Scenario</CardTitle>
                <CardDescription>
                  {scenarioTypeConfig[scenarioType as ScenarioType]?.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Scenario Name</Label>
                    <Input
                      value={scenarioName}
                      onChange={(e) => setScenarioName(e.target.value)}
                      placeholder="e.g., Hire 2 Engineers"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Scenario Type</Label>
                    <Select
                      value={scenarioType}
                      onValueChange={(v) => setScenarioType(v as ScenarioType)}
                    >
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

                  {/* Client selector for relevant scenarios */}
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

                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                    />
                  </div>

                  {/* Amount for relevant scenarios */}
                  {['client_gain', 'hiring', 'contractor_gain', 'increased_expense'].includes(
                    scenarioType
                  ) && (
                    <div className="space-y-2">
                      <Label>Monthly Amount ($)</Label>
                      <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="10000"
                      />
                    </div>
                  )}

                  {/* Delay days for payment delay scenarios */}
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

                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleDiscardScenario}>
                    Cancel
                  </Button>
                  <Button onClick={handleBuildScenario}>Build Scenario</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <>
          {/* Suggested Scenarios */}
          {suggestions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">
                Suggested Scenarios <span className="text-sm font-normal text-muted-foreground">by TAMI</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {suggestions.slice(0, 3).map((suggestion, index) => (
                  <Card
                    key={index}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => handleStartScenario(suggestion.scenario_type, suggestion)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <AlertTriangle
                          className={`h-4 w-4 ${
                            suggestion.priority === 'high'
                              ? 'text-tomato'
                              : suggestion.priority === 'medium'
                              ? 'text-mimi-pink'
                              : 'text-muted-foreground'
                          }`}
                        />
                        <Badge
                          variant="outline"
                          className={
                            suggestion.priority === 'high'
                              ? 'border-tomato text-tomato'
                              : suggestion.priority === 'medium'
                              ? 'border-mimi-pink text-foreground'
                              : ''
                          }
                        >
                          {suggestion.priority}
                        </Badge>
                      </div>
                      <h3 className="font-medium">{suggestion.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Create Scenario Form */}
          <Card>
            <CardHeader>
              <CardTitle>Run a New Scenario</CardTitle>
              <CardDescription>
                Choose a scenario type to model what-if situations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(scenarioTypeConfig).map(([type, config]) => {
                  const Icon = config.icon;
                  return (
                    <Card
                      key={type}
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => handleStartScenario(type as ScenarioType)}
                    >
                      <CardContent className="p-4 text-center">
                        <Icon className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm font-medium">{config.label}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
