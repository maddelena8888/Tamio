import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Link2,
  Unlink,
  RefreshCw,
  Check,
  AlertTriangle,
  Settings as SettingsIcon,
  Shield,
  Loader2,
} from 'lucide-react';
import {
  getXeroStatus,
  getXeroConnectUrl,
  disconnectXero,
  syncXero,
} from '@/lib/api/xero';
import { getRules, createRule, updateRule } from '@/lib/api/scenarios';
import type { XeroConnectionStatus, FinancialRule } from '@/lib/api/types';

export default function Settings() {
  const { user, logout } = useAuth();
  const [xeroStatus, setXeroStatus] = useState<XeroConnectionStatus | null>(null);
  const [rules, setRules] = useState<FinancialRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [bufferMonths, setBufferMonths] = useState('3');
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [statusData, rulesData] = await Promise.all([
          getXeroStatus(user.id).catch(() => null),
          getRules(user.id).catch(() => []),
        ]);

        setXeroStatus(statusData);
        setRules(rulesData);

        // Set buffer months from existing rule
        const bufferRule = rulesData.find((r) => r.rule_type === 'minimum_cash_buffer');
        if (bufferRule) {
          const months = (bufferRule.threshold_config as { months?: number })?.months;
          if (months) setBufferMonths(months.toString());
        }
      } catch (error) {
        console.error('Failed to fetch settings data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Check URL for Xero callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('xero_connected') === 'true') {
      fetchData();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user]);

  const handleConnectXero = async () => {
    if (!user) return;
    setIsConnecting(true);
    try {
      const { auth_url } = await getXeroConnectUrl(user.id);
      window.location.href = auth_url;
    } catch (error) {
      console.error('Failed to get Xero auth URL:', error);
      setIsConnecting(false);
    }
  };

  const handleDisconnectXero = async () => {
    if (!user) return;
    try {
      await disconnectXero(user.id);
      setXeroStatus({ ...xeroStatus!, is_connected: false });
      setShowDisconnectDialog(false);
    } catch (error) {
      console.error('Failed to disconnect Xero:', error);
    }
  };

  const handleSyncXero = async () => {
    if (!user) return;
    setIsSyncing(true);
    setSyncMessage('');
    try {
      const result = await syncXero(user.id, 'full');
      setSyncMessage(
        `Sync complete: ${result.records_created} created, ${result.records_updated} updated`
      );
      // Refresh status
      const statusData = await getXeroStatus(user.id);
      setXeroStatus(statusData);
    } catch (error) {
      console.error('Failed to sync Xero:', error);
      setSyncMessage('Sync failed. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateBufferRule = async () => {
    if (!user) return;
    try {
      const existingRule = rules.find((r) => r.rule_type === 'minimum_cash_buffer');
      if (existingRule) {
        await updateRule(existingRule.id, {
          threshold_config: { months: parseInt(bufferMonths) },
        });
      } else {
        await createRule({
          user_id: user.id,
          rule_type: 'minimum_cash_buffer',
          name: 'Minimum Cash Buffer',
          description: `Maintain at least ${bufferMonths} months of operating expenses`,
          threshold_config: { months: parseInt(bufferMonths) },
          is_active: true,
          evaluation_scope: 'all',
        });
      }
      setSyncMessage('Buffer rule updated successfully');
    } catch (error) {
      console.error('Failed to update buffer rule:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {syncMessage && (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertDescription>{syncMessage}</AlertDescription>
        </Alert>
      )}

      {/* Xero Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Xero Integration
          </CardTitle>
          <CardDescription>
            Connect your Xero account to automatically sync financial data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {xeroStatus?.is_connected ? (
            <>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#13B5EA] flex items-center justify-center">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">{xeroStatus.tenant_name || 'Connected'}</p>
                    <p className="text-sm text-muted-foreground">
                      Last synced:{' '}
                      {xeroStatus.last_sync_at
                        ? new Date(xeroStatus.last_sync_at).toLocaleDateString()
                        : 'Never'}
                    </p>
                  </div>
                </div>
                <Badge className="bg-lime text-foreground">Connected</Badge>
              </div>

              {xeroStatus.sync_error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{xeroStatus.sync_error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button onClick={handleSyncXero} disabled={isSyncing}>
                  {isSyncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync Now
                    </>
                  )}
                </Button>
                <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Unlink className="mr-2 h-4 w-4" />
                      Disconnect
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Disconnect Xero</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to disconnect your Xero account? Your existing data
                        will remain, but automatic syncing will stop.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowDisconnectDialog(false)}>
                        Cancel
                      </Button>
                      <Button variant="destructive" onClick={handleDisconnectXero}>
                        Disconnect
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect Xero to automatically import your clients, invoices, bills, and bank
                balances.
              </p>
              <Button
                onClick={handleConnectXero}
                disabled={isConnecting}
                className="bg-[#13B5EA] hover:bg-[#0fa3d4] text-white"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    Connect to Xero
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cash Buffer Rule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Cash Buffer Rule
          </CardTitle>
          <CardDescription>
            Set your minimum runway threshold for safety alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label>Minimum Months of Runway</Label>
              <Select value={bufferMonths} onValueChange={setBufferMonths}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 month</SelectItem>
                  <SelectItem value="2">2 months</SelectItem>
                  <SelectItem value="3">3 months (recommended)</SelectItem>
                  <SelectItem value="4">4 months</SelectItem>
                  <SelectItem value="6">6 months</SelectItem>
                  <SelectItem value="12">12 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleUpdateBufferRule}>Save Rule</Button>
          </div>
          <p className="text-sm text-muted-foreground">
            You'll see a warning when your forecast shows cash falling below{' '}
            <span className="font-medium">{bufferMonths} months</span> of operating expenses.
          </p>
        </CardContent>
      </Card>

      {/* Account Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Account
          </CardTitle>
          <CardDescription>Manage your account settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ''} disabled />
          </div>
          <div className="space-y-2">
            <Label>Base Currency</Label>
            <Input value={user?.base_currency || 'USD'} disabled />
          </div>
          <div className="pt-4 border-t">
            <Button variant="destructive" onClick={logout}>
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
