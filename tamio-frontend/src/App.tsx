import { RouterProvider } from 'react-router-dom';
import { router } from '@/router';
import { AuthProvider } from '@/contexts/AuthContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster />
      </TooltipProvider>
    </AuthProvider>
  );
}

export default App;
