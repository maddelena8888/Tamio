import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link2, FileSpreadsheet, ArrowRight } from 'lucide-react';
import { getXeroConnectUrl } from '@/lib/api/xero';

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isConnectingXero, setIsConnectingXero] = useState(false);

  const handleConnectXero = async () => {
    if (!user) return;
    setIsConnectingXero(true);
    try {
      const { auth_url } = await getXeroConnectUrl(user.id);
      window.location.href = auth_url;
    } catch (error) {
      console.error('Failed to get Xero auth URL:', error);
      setIsConnectingXero(false);
    }
  };

  const handleManualSetup = () => {
    navigate('/onboarding/manual');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground">TAMIO</h1>
          <h2 className="text-2xl font-semibold mt-6 text-foreground">
            How would you like to get started?
          </h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Connect your accounting software for automatic data sync, or set up your forecast manually.
          </p>
        </div>

        {/* Options */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Xero Option */}
          <Card className="relative hover:border-primary/50 transition-colors cursor-pointer group">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-[#13B5EA]/10 flex items-center justify-center mb-4">
                <Link2 className="w-6 h-6 text-[#13B5EA]" />
              </div>
              <CardTitle className="text-xl">Connect Xero</CardTitle>
              <CardDescription className="text-base">
                Automatically sync your accounting data for an instant, accurate forecast.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-lime mt-0.5">+</span>
                  Import clients, invoices, and bills automatically
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-lime mt-0.5">+</span>
                  Sync bank balances in real-time
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-lime mt-0.5">+</span>
                  Analyze payment behavior patterns
                </li>
              </ul>
              <Button
                onClick={handleConnectXero}
                className="w-full bg-[#13B5EA] hover:bg-[#0fa3d4] text-white"
                disabled={isConnectingXero}
              >
                {isConnectingXero ? 'Connecting...' : 'Connect Xero'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Manual Option */}
          <Card className="relative hover:border-primary/50 transition-colors cursor-pointer group">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-6 h-6 text-foreground" />
              </div>
              <CardTitle className="text-xl">Enter Manually</CardTitle>
              <CardDescription className="text-base">
                Build your forecast from scratch with a simple guided setup.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">+</span>
                  Quick 5-minute setup process
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">+</span>
                  Add clients and expenses as you go
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">+</span>
                  Connect Xero later if needed
                </li>
              </ul>
              <Button
                onClick={handleManualSetup}
                variant="outline"
                className="w-full"
              >
                Start Manual Setup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
