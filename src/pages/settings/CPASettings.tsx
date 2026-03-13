import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CPAThresholdSettings } from '@/components/settings/CPAThresholdSettings';

export default function CPASettings() {
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CPA Targets</h1>
          <p className="text-muted-foreground">Configure CPA thermometer thresholds</p>
        </div>
      </div>
      <CPAThresholdSettings />
    </div>
  );
}
