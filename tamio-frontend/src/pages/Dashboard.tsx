import { useEffect, useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { getForecast } from '@/lib/api/forecast';
import { getCashPosition } from '@/lib/api/data';
import { getScenarioSuggestions, getRules } from '@/lib/api/scenarios';
import type { ForecastResponse, CashPositionResponse, ScenarioSuggestion, FinancialRule } from '@/lib/api/types';

const chartConfig = {
  endingBalance: {
    label: 'Ending Balance',
    color: 'var(--chart-1)',
  },
  cashBuffer: {
    label: 'Cash Buffer (Minimum)',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [cashPosition, setCashPosition] = useState<CashPositionResponse | null>(null);
  const [suggestions, setSuggestions] = useState<ScenarioSuggestion[]>([]);
  const [rules, setRules] = useState<FinancialRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [forecastData, cashData, suggestionsData, rulesData] = await Promise.all([
          getForecast(user.id),
          getCashPosition(user.id),
          getScenarioSuggestions(user.id).catch(() => ({ suggestions: [] })),
          getRules(user.id).catch(() => []),
        ]);

        setForecast(forecastData);
        setCashPosition(cashData);
        setSuggestions(suggestionsData.suggestions || []);
        setRules(rulesData);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Calculate KPIs
  const totalIncome30D = forecast?.weeks.slice(0, 4).reduce(
    (sum, week) => sum + parseFloat(week.cash_in || '0'),
    0
  ) || 0;

  const totalExpenses30D = forecast?.weeks.slice(0, 4).reduce(
    (sum, week) => sum + parseFloat(week.cash_out || '0'),
    0
  ) || 0;

  const availableCash = parseFloat(cashPosition?.total_starting_cash || '0');

  // Get buffer rule threshold
  const bufferRule = rules.find((r) => r.rule_type === 'minimum_cash_buffer');
  const bufferMonths = (bufferRule?.threshold_config as { months?: number })?.months || 3;
  const monthlyExpenses = totalExpenses30D;
  const bufferAmount = monthlyExpenses * bufferMonths;

  // Determine buffer status
  const lowestBalance = forecast?.summary.lowest_cash_amount
    ? parseFloat(forecast.summary.lowest_cash_amount)
    : availableCash;
  const isAtRisk = lowestBalance > 0 && lowestBalance < bufferAmount;
  const isBreach = lowestBalance <= 0;

  // Chart data
  const chartData = forecast?.weeks.map((week) => ({
    week: `Week ${week.week_number}`,
    endingBalance: parseFloat(week.ending_balance),
    cashBuffer: bufferAmount,
  })) || [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const toggleWeek = (weekNumber: number) => {
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekNumber]: !prev[weekNumber],
    }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company Name Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{user?.email?.split('@')[0] || 'Dashboard'}</h1>
        <Button
          onClick={() => navigate('/tami')}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          TAMI
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Income (30D)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-lime" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(totalIncome30D)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Expenses (30D)
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-tomato" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(totalExpenses30D)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Available Cash
            </CardTitle>
            <DollarSign className="h-4 w-4 text-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(availableCash)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>13 Week Forecast</CardTitle>
          <Badge
            variant={isBreach ? 'destructive' : isAtRisk ? 'secondary' : 'default'}
            className={
              isBreach
                ? 'bg-tomato text-white'
                : isAtRisk
                ? 'bg-mimi-pink text-foreground'
                : 'bg-lime text-foreground'
            }
          >
            {isBreach ? 'Buffer Breach' : isAtRisk ? 'At Risk' : 'Cash Buffer Safe'}
          </Badge>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis
                    dataKey="week"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatCurrency(value as number)}
                      />
                    }
                  />
                  <ReferenceLine
                    y={bufferAmount}
                    stroke="var(--chart-3)"
                    strokeDasharray="5 5"
                    label={{
                      value: 'Cash Buffer (Minimum)',
                      position: 'right',
                      fill: 'var(--chart-3)',
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="endingBalance"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={{ r: 4, fill: 'var(--chart-1)' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No forecast data available. Add clients and expenses to generate a forecast.
            </div>
          )}
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[var(--chart-1)]" />
              <span>Ending Balance</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 border-b-2 border-dashed border-[var(--chart-3)]" />
              <span>Cash Buffer (Minimum)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenario Suggestions */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Scenarios to run
              <span className="text-sm font-normal text-muted-foreground">by TAMI</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {suggestions.slice(0, 3).map((suggestion, index) => (
                <Card
                  key={index}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(`/scenarios?type=${suggestion.scenario_type}`)}
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
                    <h4 className="font-medium">{suggestion.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Week</TableHead>
                <TableHead className="text-right">Starting</TableHead>
                <TableHead className="text-right text-lime">Income</TableHead>
                <TableHead className="text-right text-tomato">Costs</TableHead>
                <TableHead className="text-right">Ending</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forecast?.weeks.map((week) => (
                <Fragment key={week.week_number}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleWeek(week.week_number)}
                  >
                    <TableCell className="font-medium">
                      Week {week.week_number}
                      <div className="text-xs text-muted-foreground">
                        {new Date(week.week_start).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(parseFloat(week.starting_balance))}
                    </TableCell>
                    <TableCell className="text-right text-lime">
                      +{formatCurrency(parseFloat(week.cash_in))}
                    </TableCell>
                    <TableCell className="text-right text-tomato">
                      -{formatCurrency(parseFloat(week.cash_out))}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(parseFloat(week.ending_balance))}
                    </TableCell>
                    <TableCell>
                      {expandedWeeks[week.week_number] ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedWeeks[week.week_number] && week.events.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/30 p-4">
                        <div className="space-y-2">
                          {week.events.map((event) => (
                            <div
                              key={event.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={
                                    event.direction === 'in'
                                      ? 'border-lime/50 text-lime'
                                      : 'border-tomato/50 text-tomato'
                                  }
                                >
                                  {event.direction === 'in' ? 'IN' : 'OUT'}
                                </Badge>
                                <span>{event.category}</span>
                                {event.confidence !== 'high' && (
                                  <Badge variant="secondary" className="text-xs">
                                    {event.confidence}
                                  </Badge>
                                )}
                              </div>
                              <span
                                className={
                                  event.direction === 'in' ? 'text-lime' : 'text-tomato'
                                }
                              >
                                {event.direction === 'in' ? '+' : '-'}
                                {formatCurrency(parseFloat(event.amount))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
