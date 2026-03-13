import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AutoResponseSettings } from '@/components/ratings/AutoResponseSettings';

export default function AutoResponsesSettings() {
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auto-Response Rules</h1>
          <p className="text-muted-foreground">Configure automated review response settings</p>
        </div>
      </div>
      <AutoResponseSettings />
    </div>
  );
}
