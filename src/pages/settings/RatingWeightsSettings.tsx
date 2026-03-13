import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useChannelWeights, useUpdateChannelWeights } from '@/hooks/useChannelWeights';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Scale, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function RatingWeightsSettings() {
  const { toast } = useToast();
  const { data: channelWeights } = useChannelWeights();
  const updateWeightsMutation = useUpdateChannelWeights();
  const [appStoreWeight, setAppStoreWeight] = useState(1);
  const [googlePlayWeight, setGooglePlayWeight] = useState(1);
  const [trustpilotWeight, setTrustpilotWeight] = useState(1);
  const [typeformWeight, setTypeformWeight] = useState(1);

  useEffect(() => {
    if (channelWeights) {
      setAppStoreWeight(channelWeights.app_store_weight);
      setGooglePlayWeight(channelWeights.google_play_weight);
      setTrustpilotWeight(channelWeights.trustpilot_weight);
      setTypeformWeight(channelWeights.typeform_weight ?? 1);
    }
  }, [channelWeights]);

  const handleSaveWeights = async () => {
    try {
      await updateWeightsMutation.mutateAsync({
        app_store_weight: appStoreWeight,
        google_play_weight: googlePlayWeight,
        trustpilot_weight: trustpilotWeight,
        typeform_weight: typeformWeight,
      });
      toast({ title: "Saved", description: "Channel weights have been updated" });
    } catch {
      toast({ title: "Error", description: "Failed to save weights", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rating Weights</h1>
          <p className="text-muted-foreground">Adjust how each channel contributes to your overall rating</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Channel Weights</CardTitle>
          </div>
          <CardDescription>Higher weight = more influence on the overall rating score.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="app-store-weight">App Store</Label>
              <Input id="app-store-weight" type="number" min="0" step="0.1" value={appStoreWeight} onChange={(e) => setAppStoreWeight(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="google-play-weight">Google Play</Label>
              <Input id="google-play-weight" type="number" min="0" step="0.1" value={googlePlayWeight} onChange={(e) => setGooglePlayWeight(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trustpilot-weight">Trustpilot</Label>
              <Input id="trustpilot-weight" type="number" min="0" step="0.1" value={trustpilotWeight} onChange={(e) => setTrustpilotWeight(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="typeform-weight">Typeform</Label>
              <Input id="typeform-weight" type="number" min="0" step="0.1" value={typeformWeight} onChange={(e) => setTypeformWeight(Number(e.target.value))} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Example: App Store (2) + Google Play (1) + Trustpilot (1) + Typeform (1) means App Store counts twice as much.
          </p>
          <div className="flex items-center gap-2">
            <Button onClick={handleSaveWeights} disabled={updateWeightsMutation.isPending}>
              {updateWeightsMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Weights'}
            </Button>
            <Button variant="outline" onClick={() => { setAppStoreWeight(1); setGooglePlayWeight(1); setTrustpilotWeight(1); setTypeformWeight(1); }}>
              Reset to Default
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
