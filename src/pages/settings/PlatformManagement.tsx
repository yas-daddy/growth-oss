import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Image, Trash2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

export default function PlatformManagement() {
  const navigate = useNavigate();
  const { isSuperAdmin, isLoading } = useUserRole();

  if (!isLoading && !isSuperAdmin) {
    navigate('/settings');
    return null;
  }

  // Placeholder platform list — in the future this would be backed by a DB table
  const platforms = [
    { id: 'meta', name: 'Meta Ads', hasIcon: true },
    { id: 'apple', name: 'Apple Search Ads', hasIcon: true },
    { id: 'appsflyer', name: 'AppsFlyer', hasIcon: true },
    { id: 'moloco', name: 'Moloco', hasIcon: false },
    { id: 'google_play', name: 'Google Play', hasIcon: true },
    { id: 'trustpilot', name: 'Trustpilot', hasIcon: false },
    { id: 'mixpanel', name: 'Mixpanel', hasIcon: false },
    { id: 'typeform', name: 'Typeform', hasIcon: false },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Management</h1>
        <p className="text-muted-foreground">
          Upload icons and manage partner API branding across the application.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Partner Platforms</CardTitle>
          <CardDescription>Manage icons and display settings for each integration partner.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Icon</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {platforms.map(platform => (
                <TableRow key={platform.id}>
                  <TableCell className="font-medium">{platform.name}</TableCell>
                  <TableCell>
                    {platform.hasIcon ? (
                      <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                        Uploaded
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Missing
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info('Icon upload coming soon')}
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Upload
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
