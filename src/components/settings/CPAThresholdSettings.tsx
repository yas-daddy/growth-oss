import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCPAThresholds } from '@/hooks/useCPAThresholds';
import { Skeleton } from '@/components/ui/skeleton';
import { Gauge } from 'lucide-react';

export function CPAThresholdSettings() {
  const { thresholds, isLoading, updateThresholds, isUpdating } = useCPAThresholds();
  
  const [minCpa, setMinCpa] = useState('');
  const [maxCpa, setMaxCpa] = useState('');
  const [targetCpa, setTargetCpa] = useState('');
  const [greenThreshold, setGreenThreshold] = useState('');
  const [orangeThreshold, setOrangeThreshold] = useState('');
  
  // Initialize form values when data loads
  useEffect(() => {
    if (thresholds) {
      setMinCpa(thresholds.min_cpa?.toString() ?? '20');
      setMaxCpa(thresholds.max_cpa?.toString() ?? '55');
      setTargetCpa(thresholds.target_cpa?.toString() ?? '35');
      setGreenThreshold(thresholds.green_threshold?.toString() ?? '42');
      setOrangeThreshold(thresholds.orange_threshold?.toString() ?? '48');
    }
  }, [thresholds]);
  
  const handleSave = () => {
    const min = parseFloat(minCpa);
    const max = parseFloat(maxCpa);
    const target = parseFloat(targetCpa);
    const green = parseFloat(greenThreshold);
    const orange = parseFloat(orangeThreshold);
    
    // Validation
    if (isNaN(min) || isNaN(max) || isNaN(target) || isNaN(green) || isNaN(orange)) {
      return;
    }
    
    if (min >= max) {
      return;
    }
    
    updateThresholds({
      min_cpa: min,
      max_cpa: max,
      target_cpa: target,
      green_threshold: green,
      orange_threshold: orange,
    });
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-muted-foreground" />
          <CardTitle>CPA Thermometer</CardTitle>
        </div>
        <CardDescription>
          Configure the CPA visualization scale and color thresholds
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Scale Settings */}
        <div>
          <h4 className="text-sm font-medium mb-3">Scale Range</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min-cpa">Minimum (£)</Label>
              <Input
                id="min-cpa"
                type="number"
                step="1"
                min="0"
                value={minCpa}
                onChange={(e) => setMinCpa(e.target.value)}
                placeholder="20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-cpa">Target (£)</Label>
              <Input
                id="target-cpa"
                type="number"
                step="1"
                min="0"
                value={targetCpa}
                onChange={(e) => setTargetCpa(e.target.value)}
                placeholder="35"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-cpa">Maximum (£)</Label>
              <Input
                id="max-cpa"
                type="number"
                step="1"
                min="0"
                value={maxCpa}
                onChange={(e) => setMaxCpa(e.target.value)}
                placeholder="55"
              />
            </div>
          </div>
        </div>
        
        {/* Color Thresholds */}
        <div>
          <h4 className="text-sm font-medium mb-3">Color Thresholds</h4>
          <p className="text-xs text-muted-foreground mb-3">
            CPA values below the green threshold appear green, between green and orange appear orange, and above orange appear red.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="green-threshold" className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                Green threshold (£)
              </Label>
              <Input
                id="green-threshold"
                type="number"
                step="1"
                min="0"
                value={greenThreshold}
                onChange={(e) => setGreenThreshold(e.target.value)}
                placeholder="42"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orange-threshold" className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-orange-500" />
                Orange threshold (£)
              </Label>
              <Input
                id="orange-threshold"
                type="number"
                step="1"
                min="0"
                value={orangeThreshold}
                onChange={(e) => setOrangeThreshold(e.target.value)}
                placeholder="48"
              />
            </div>
          </div>
        </div>
        
        <Button onClick={handleSave} disabled={isUpdating}>
          {isUpdating ? 'Saving...' : 'Save Changes'}
        </Button>
      </CardContent>
    </Card>
  );
}
