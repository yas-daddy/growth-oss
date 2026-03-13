import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Link2, Copy, Check, Loader2, Download } from 'lucide-react';
import { 
  useGenerateAffiliateLinks, 
  useAffiliateLinks,
  parseCampaignNames,
  getInvalidCampaignNames,
  type GeneratedLink,
} from '@/hooks/useAffiliateLinks';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface AffiliateDetailLinkGeneratorProps {
  affiliateId: string;
  affiliateName: string;
  channel: string;
}

export function AffiliateDetailLinkGenerator({ 
  affiliateId, 
  affiliateName, 
  channel 
}: AffiliateDetailLinkGeneratorProps) {
  const [campaignInput, setCampaignInput] = useState('');
  const [generatedLinks, setGeneratedLinks] = useState<GeneratedLink[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { data: recentLinks } = useAffiliateLinks(affiliateId);
  const generateLinks = useGenerateAffiliateLinks();

  const handleGenerate = async () => {
    const campaignNames = parseCampaignNames(campaignInput);
    
    if (campaignNames.length === 0) {
      toast.error('Please enter at least one campaign name');
      return;
    }

    const invalidNames = getInvalidCampaignNames(campaignNames);
    if (invalidNames.length > 0) {
      setValidationError(`Invalid names (only letters, numbers, underscores, hyphens): ${invalidNames.join(', ')}`);
      return;
    }

    setValidationError(null);

    try {
      const result = await generateLinks.mutateAsync({
        affiliate_id: affiliateId,
        campaign_names: campaignNames,
      });
      setGeneratedLinks(result.links);
      setCampaignInput('');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleCopy = async (url: string, index: number) => {
    await navigator.clipboard.writeText(url);
    setCopiedIndex(index);
    toast.success('Link copied!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyAll = async () => {
    const allUrls = generatedLinks.map(link => link.url).join('\n');
    await navigator.clipboard.writeText(allUrls);
    setCopiedAll(true);
    toast.success('All links copied to clipboard!');
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDownloadCsv = () => {
    const csvContent = [
      'Campaign Name,URL',
      ...generatedLinks.map(link => `${link.campaign_name},${link.url}`),
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${affiliateName.toLowerCase().replace(/\s+/g, '_')}_tracking_links.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('CSV downloaded!');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Generate Tracking Links
        </CardTitle>
        <CardDescription>
          Create tracking links for your campaigns. Media source{' '}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{channel}</code>{' '}
          will be set automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="campaign-detail">Campaign Names</Label>
          <Textarea
            id="campaign-detail"
            placeholder="summer_promo_2024&#10;winter_sale&#10;new_user_bonus"
            value={campaignInput}
            onChange={(e) => {
              setCampaignInput(e.target.value);
              setValidationError(null);
            }}
            rows={4}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Enter campaign names separated by commas or line breaks. Use letters, numbers, underscores, or hyphens only.
          </p>
          {validationError && (
            <p className="text-xs text-destructive">{validationError}</p>
          )}
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!campaignInput.trim() || generateLinks.isPending}
        >
          {generateLinks.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Link2 className="mr-2 h-4 w-4" />
              Generate Links
            </>
          )}
        </Button>

        {generatedLinks.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">
                Generated Links ({generatedLinks.length})
              </h4>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAll}
                  className="gap-1.5"
                >
                  {copiedAll ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadCsv}
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </Button>
              </div>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Campaign</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generatedLinks.map((link, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium font-mono text-sm">
                        {link.campaign_name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[300px]">
                        {link.url}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleCopy(link.url, index)}
                        >
                          {copiedIndex === index ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {recentLinks && recentLinks.length > 0 && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-3">Recent Links</h4>
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
                      onClick={() => {
                        navigator.clipboard.writeText(link.short_url);
                        toast.success('Copied!');
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
