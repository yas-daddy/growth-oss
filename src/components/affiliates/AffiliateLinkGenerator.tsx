import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Link2, Copy, Check, Loader2, ExternalLink } from 'lucide-react';
import { useAffiliates } from '@/hooks/useAffiliates';
import { useGenerateAffiliateLink, useAffiliateLinks } from '@/hooks/useAffiliateLinks';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export function AffiliateLinkGenerator() {
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string>('');
  const [campaignName, setCampaignName] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: affiliates, isLoading: affiliatesLoading } = useAffiliates();
  const { data: recentLinks } = useAffiliateLinks(selectedAffiliateId || undefined);
  const generateLink = useGenerateAffiliateLink();

  const selectedAffiliate = affiliates?.find(a => a.id === selectedAffiliateId);

  const handleGenerate = async () => {
    if (!selectedAffiliateId || !campaignName.trim()) {
      toast.error('Please select an affiliate and enter a campaign name');
      return;
    }

    // Validate campaign name
    const campaignNameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!campaignNameRegex.test(campaignName)) {
      toast.error('Campaign name can only contain letters, numbers, underscores, and hyphens');
      return;
    }

    try {
      const result = await generateLink.mutateAsync({
        affiliate_id: selectedAffiliateId,
        campaign_name: campaignName,
      });
      setGeneratedLink(result.short_url);
      setCampaignName('');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleCopy = async () => {
    if (generatedLink) {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Generate Tracking Link
          </CardTitle>
          <CardDescription>
            Create a unique tracking link for your campaign. The media source will be automatically set based on the affiliate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="affiliate">Affiliate</Label>
              <Select
                value={selectedAffiliateId}
                onValueChange={setSelectedAffiliateId}
                disabled={affiliatesLoading}
              >
                <SelectTrigger id="affiliate">
                  <SelectValue placeholder="Select affiliate" />
                </SelectTrigger>
                <SelectContent>
                  {affiliates?.filter(a => a.status === 'active').map((affiliate) => (
                    <SelectItem key={affiliate.id} value={affiliate.id}>
                      {affiliate.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAffiliate && (
                <p className="text-xs text-muted-foreground">
                  Media Source: <code className="bg-muted px-1 py-0.5 rounded">{selectedAffiliate.channel}</code>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign">Campaign Name</Label>
              <Input
                id="campaign"
                placeholder="e.g. summer_promo_2024"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              />
              <p className="text-xs text-muted-foreground">
                Use letters, numbers, underscores, or hyphens only
              </p>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!selectedAffiliateId || !campaignName.trim() || generateLink.isPending}
            className="w-full sm:w-auto"
          >
            {generateLink.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Link2 className="mr-2 h-4 w-4" />
                Generate Link
              </>
            )}
          </Button>

          {generatedLink && (
            <div className="mt-4 p-4 bg-muted rounded-lg border">
              <Label className="text-sm font-medium">Generated Link</Label>
              <div className="flex items-center gap-2 mt-2">
                <code className="flex-1 p-2 bg-background rounded border text-sm break-all">
                  {generatedLink}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  asChild
                  className="shrink-0"
                >
                  <a href={generatedLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedAffiliateId && recentLinks && recentLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Links</CardTitle>
            <CardDescription>
              Previously generated links for {selectedAffiliate?.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentLinks.slice(0, 5).map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{link.campaign_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{link.short_url}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(link.created_at), { addSuffix: true })}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={async () => {
                        await navigator.clipboard.writeText(link.short_url);
                        toast.success('Copied!');
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
