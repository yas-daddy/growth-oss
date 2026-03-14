import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Plug, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useProviderConnections } from '@/hooks/useProviderConnections';

interface ConnectProvidersAlertProps {
  /** If set, only check this specific provider instead of any provider */
  requiredProvider?: string;
  /** Custom message to show */
  message?: string;
}

export function ConnectProvidersAlert({ requiredProvider, message }: ConnectProvidersAlertProps = {}) {
  const { data: connections, isLoading } = useProviderConnections();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || isLoading) return null;

  if (requiredProvider) {
    const isConnected = connections?.some(c => c.provider === requiredProvider && c.status === 'connected');
    if (isConnected) return null;
  } else {
    const hasConnected = connections?.some(c => c.status === 'connected');
    if (hasConnected) return null;
  }

  return (
    <Alert className="border-primary/30 bg-primary/5">
      <Plug className="h-4 w-4 text-primary" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span className="text-sm">
          {message || 'Connect your ad platforms and data sources to start seeing data.'}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button asChild size="sm" variant="default">
            <Link to="/settings/connections">Connect APIs</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setDismissed(true)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
