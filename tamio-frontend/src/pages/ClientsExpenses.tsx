import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';
import { getClients, createClient, updateClient, deleteClient } from '@/lib/api/data';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '@/lib/api/data';
import type {
  Client,
  ExpenseBucket,
  ClientType,
  PaymentBehavior,
  RiskLevel,
  ExpenseCategory,
  BucketType,
  Priority,
  Frequency,
} from '@/lib/api/types';

export default function ClientsExpenses() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [expenses, setExpenses] = useState<ExpenseBucket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('clients');

  // Client form state
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState({
    name: '',
    client_type: 'retainer' as ClientType,
    amount: '',
    frequency: 'monthly' as Frequency,
    payment_behavior: 'on_time' as PaymentBehavior,
    churn_risk: 'low' as RiskLevel,
    scope_risk: 'low' as RiskLevel,
  });

  // Expense form state
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseBucket | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    name: '',
    category: 'other' as ExpenseCategory,
    bucket_type: 'fixed' as BucketType,
    monthly_amount: '',
    priority: 'medium' as Priority,
    employee_count: '',
  });

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [clientsData, expensesData] = await Promise.all([
          getClients(user.id),
          getExpenses(user.id),
        ]);
        setClients(clientsData);
        setExpenses(expensesData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Client handlers
  const handleOpenClientDialog = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setClientForm({
        name: client.name,
        client_type: client.client_type,
        amount: client.billing_config.amount || '',
        frequency: (client.billing_config.frequency as Frequency) || 'monthly',
        payment_behavior: client.payment_behavior,
        churn_risk: client.churn_risk,
        scope_risk: client.scope_risk,
      });
    } else {
      setEditingClient(null);
      setClientForm({
        name: '',
        client_type: 'retainer',
        amount: '',
        frequency: 'monthly',
        payment_behavior: 'on_time',
        churn_risk: 'low',
        scope_risk: 'low',
      });
    }
    setIsClientDialogOpen(true);
  };

  const handleSaveClient = async () => {
    if (!user) return;

    try {
      if (editingClient) {
        const response = await updateClient(editingClient.id, {
          name: clientForm.name,
          client_type: clientForm.client_type,
          payment_behavior: clientForm.payment_behavior,
          churn_risk: clientForm.churn_risk,
          scope_risk: clientForm.scope_risk,
          billing_config: {
            amount: clientForm.amount,
            frequency: clientForm.frequency,
            day_of_month: 1,
          },
        });
        setClients(clients.map((c) => (c.id === editingClient.id ? response.client : c)));
      } else {
        const response = await createClient({
          user_id: user.id,
          name: clientForm.name,
          client_type: clientForm.client_type,
          currency: 'USD',
          status: 'active',
          payment_behavior: clientForm.payment_behavior,
          churn_risk: clientForm.churn_risk,
          scope_risk: clientForm.scope_risk,
          billing_config: {
            amount: clientForm.amount,
            frequency: clientForm.frequency,
            day_of_month: 1,
          },
        });
        setClients([...clients, response.client]);
      }
      setIsClientDialogOpen(false);
    } catch (error) {
      console.error('Failed to save client:', error);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      await deleteClient(clientId);
      setClients(clients.filter((c) => c.id !== clientId));
    } catch (error) {
      console.error('Failed to delete client:', error);
    }
  };

  // Expense handlers
  const handleOpenExpenseDialog = (expense?: ExpenseBucket) => {
    if (expense) {
      setEditingExpense(expense);
      setExpenseForm({
        name: expense.name,
        category: expense.category,
        bucket_type: expense.bucket_type,
        monthly_amount: expense.monthly_amount,
        priority: expense.priority as Priority,
        employee_count: expense.employee_count?.toString() || '',
      });
    } else {
      setEditingExpense(null);
      setExpenseForm({
        name: '',
        category: 'other',
        bucket_type: 'fixed',
        monthly_amount: '',
        priority: 'medium',
        employee_count: '',
      });
    }
    setIsExpenseDialogOpen(true);
  };

  const handleSaveExpense = async () => {
    if (!user) return;

    try {
      if (editingExpense) {
        const response = await updateExpense(editingExpense.id, {
          name: expenseForm.name,
          category: expenseForm.category,
          bucket_type: expenseForm.bucket_type,
          monthly_amount: expenseForm.monthly_amount,
          priority: expenseForm.priority,
          employee_count: expenseForm.employee_count
            ? parseInt(expenseForm.employee_count)
            : undefined,
        });
        setExpenses(expenses.map((e) => (e.id === editingExpense.id ? response.bucket : e)));
      } else {
        const response = await createExpense({
          user_id: user.id,
          name: expenseForm.name,
          category: expenseForm.category,
          bucket_type: expenseForm.bucket_type,
          monthly_amount: expenseForm.monthly_amount,
          currency: 'USD',
          priority: expenseForm.priority,
          is_stable: expenseForm.bucket_type === 'fixed',
          due_day: 15,
          frequency: 'monthly',
          employee_count: expenseForm.employee_count
            ? parseInt(expenseForm.employee_count)
            : undefined,
        });
        setExpenses([...expenses, response.bucket]);
      }
      setIsExpenseDialogOpen(false);
    } catch (error) {
      console.error('Failed to save expense:', error);
    }
  };

  const handleDeleteExpense = async (bucketId: string) => {
    try {
      await deleteExpense(bucketId);
      setExpenses(expenses.filter((e) => e.id !== bucketId));
    } catch (error) {
      console.error('Failed to delete expense:', error);
    }
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients & Expenses</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        {/* Clients Tab */}
        <TabsContent value="clients" className="space-y-4">
          {clients.filter((c) => c.status !== 'deleted').map((client) => (
            <Card key={client.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">{client.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Type: {client.client_type} | {client.currency} | {client.status}
                    </p>
                    <p className="text-lg font-medium">
                      {formatCurrency(client.billing_config.amount || 0)}/
                      {client.billing_config.frequency}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                      <span>
                        Payment:{' '}
                        <span
                          className={
                            client.payment_behavior === 'delayed'
                              ? 'text-tomato'
                              : 'text-foreground'
                          }
                        >
                          {client.payment_behavior}
                        </span>
                      </span>
                      <span>
                        Churn risk:{' '}
                        <span
                          className={
                            client.churn_risk === 'high'
                              ? 'text-tomato'
                              : client.churn_risk === 'medium'
                              ? 'text-mimi-pink'
                              : ''
                          }
                        >
                          {client.churn_risk}
                        </span>
                      </span>
                      <span>
                        Scope risk:{' '}
                        <span
                          className={
                            client.scope_risk === 'high'
                              ? 'text-tomato'
                              : client.scope_risk === 'medium'
                              ? 'text-mimi-pink'
                              : ''
                          }
                        >
                          {client.scope_risk}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenClientDialog(client)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClient(client.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add Client Form */}
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add New Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client Name</Label>
                  <Input
                    placeholder="e.g., Acme Corp"
                    value={clientForm.name}
                    onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client Type</Label>
                  <Select
                    value={clientForm.client_type}
                    onValueChange={(v: ClientType) =>
                      setClientForm({ ...clientForm, client_type: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retainer">Retainer</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="usage">Usage-based</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Behavior</Label>
                  <Select
                    value={clientForm.payment_behavior}
                    onValueChange={(v: PaymentBehavior) =>
                      setClientForm({ ...clientForm, payment_behavior: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on_time">On Time</SelectItem>
                      <SelectItem value="delayed">Delayed</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Churn Risk</Label>
                  <Select
                    value={clientForm.churn_risk}
                    onValueChange={(v: RiskLevel) =>
                      setClientForm({ ...clientForm, churn_risk: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Billing Frequency</Label>
                  <Select
                    value={clientForm.frequency}
                    onValueChange={(v: Frequency) =>
                      setClientForm({ ...clientForm, frequency: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={clientForm.amount}
                    onChange={(e) => setClientForm({ ...clientForm, amount: e.target.value })}
                  />
                </div>
              </div>
              <Button className="mt-4" onClick={handleSaveClient}>
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-4">
          {expenses.map((expense) => (
            <Card key={expense.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{expense.name}</h3>
                      <Badge variant="outline">{expense.category}</Badge>
                      <Badge
                        variant={expense.bucket_type === 'fixed' ? 'secondary' : 'outline'}
                      >
                        {expense.bucket_type}
                      </Badge>
                    </div>
                    <p className="text-lg font-medium">
                      {formatCurrency(expense.monthly_amount)}/{expense.frequency}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                      <span>
                        Priority:{' '}
                        <span
                          className={
                            expense.priority === 'essential' || expense.priority === 'high'
                              ? 'text-foreground font-medium'
                              : ''
                          }
                        >
                          {expense.priority}
                        </span>
                      </span>
                      {expense.employee_count && (
                        <span>Employees: {expense.employee_count}</span>
                      )}
                      <span>
                        Stability:{' '}
                        {expense.is_stable ? 'Stable' : 'Varies'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenExpenseDialog(expense)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteExpense(expense.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add Expense Form */}
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add New Expense
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    placeholder="e.g., Payroll"
                    value={expenseForm.name}
                    onChange={(e) => setExpenseForm({ ...expenseForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={expenseForm.category}
                    onValueChange={(v: ExpenseCategory) =>
                      setExpenseForm({ ...expenseForm, category: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payroll">Payroll</SelectItem>
                      <SelectItem value="rent">Rent / Office</SelectItem>
                      <SelectItem value="contractors">Contractors</SelectItem>
                      <SelectItem value="software">Software & Tools</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Monthly Amount</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={expenseForm.monthly_amount}
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, monthly_amount: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={expenseForm.bucket_type}
                    onValueChange={(v: BucketType) =>
                      setExpenseForm({ ...expenseForm, bucket_type: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed (hard to change)</SelectItem>
                      <SelectItem value="variable">Variable (adjustable)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={expenseForm.priority}
                    onValueChange={(v: Priority) =>
                      setExpenseForm({ ...expenseForm, priority: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="essential">Essential</SelectItem>
                      <SelectItem value="important">Important</SelectItem>
                      <SelectItem value="discretionary">Discretionary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {expenseForm.category === 'payroll' && (
                  <div className="space-y-2">
                    <Label>Number of Employees</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={expenseForm.employee_count}
                      onChange={(e) =>
                        setExpenseForm({ ...expenseForm, employee_count: e.target.value })
                      }
                    />
                  </div>
                )}
              </div>
              <Button className="mt-4" onClick={handleSaveExpense}>
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Client Edit Dialog */}
      <Dialog open={isClientDialogOpen && !!editingClient} onOpenChange={setIsClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update client information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Client Name</Label>
              <Input
                value={clientForm.name}
                onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={clientForm.amount}
                  onChange={(e) => setClientForm({ ...clientForm, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={clientForm.frequency}
                  onValueChange={(v: Frequency) =>
                    setClientForm({ ...clientForm, frequency: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" onClick={handleSaveClient}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expense Edit Dialog */}
      <Dialog open={isExpenseDialogOpen && !!editingExpense} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Update expense information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={expenseForm.name}
                onChange={(e) => setExpenseForm({ ...expenseForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monthly Amount</Label>
                <Input
                  type="number"
                  value={expenseForm.monthly_amount}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, monthly_amount: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={expenseForm.priority}
                  onValueChange={(v: Priority) =>
                    setExpenseForm({ ...expenseForm, priority: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="essential">Essential</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                    <SelectItem value="discretionary">Discretionary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" onClick={handleSaveExpense}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
