import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Key, Eye, EyeOff, Plus, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

export default function GlobalAPIKeys() {
  const navigate = useNavigate();
  const { isSuperAdmin, isLoading } = useUserRole();

  if (!isLoading && !isSuperAdmin) {
    navigate('/settings');
    return null;
  }

  // Placeholder credentials list
  const credentials = [
    { id: 'meta_oauth', name: 'Meta OAuth', type: 'OAuth 2.0', status: 'configured' },
    { id: 'apple_api', name: 'Apple Search Ads API', type: 'API Key + Certificate', status: 'configured' },
    { id: 'appsflyer_api', name: 'AppsFlyer API', type: 'API Key', status: 'configured' },
    { id: 'moloco_api', name: 'Moloco API', type: 'API Key', status: 'not_configured' },
    { id: 'google_play', name: 'Google Play Console', type: 'Service Account', status: 'configured' },
    { id: 'trustpilot_api', name: 'Trustpilot API', type: 'API Key + Secret', status: 'not_configured' },
    { id: 'mixpanel_api', name: 'Mixpanel API', type: 'API Secret', status: 'not_configured' },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">API Keys & OAuth</h1>
        <p className="text-muted-foreground">
          Manage global API credentials and OAuth configurations for all organizations.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">API Credentials</CardTitle>
            <CardDescription>Global credentials used by backend functions to communicate with partner APIs.</CardDescription>
          </div>
          <Button size="sm" onClick={() => toast.info('Add credential coming soon')}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Credential
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {credentials.map(cred => (
                <TableRow key={cred.id}>
                  <TableCell className="font-medium">{cred.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{cred.type}</TableCell>
                  <TableCell>
                    {cred.status === 'configured' ? (
                      <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                        Configured
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                        Not Configured
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info('Credential management coming soon')}
                    >
                      <Key className="h-3.5 w-3.5 mr-1.5" />
                      Configure
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
