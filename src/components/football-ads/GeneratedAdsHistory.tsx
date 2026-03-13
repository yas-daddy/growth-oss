import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGeneratedAds } from "@/hooks/useGeneratedAds";
import { useFootballFixtures } from "@/hooks/useFootballFixtures";
import { useFootballTeams } from "@/hooks/useFootballTeams";
import { format } from "date-fns";
import { CheckCircle, AlertCircle, Clock, ExternalLink, Image as ImageIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export function GeneratedAdsHistory() {
  const { generatedAds, isLoading } = useGeneratedAds();
  const { fixtures } = useFootballFixtures();
  const { teams } = useFootballTeams();

  const getFixture = (fixtureId: string | null) => {
    if (!fixtureId) return null;
    return fixtures.find(f => f.id === fixtureId);
  };

  const getTeam = (teamId: string | null) => {
    if (!teamId) return null;
    return teams.find(t => t.id === teamId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'generated':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30"><ImageIcon className="h-3 w-3 mr-1" />Generated</Badge>;
      case 'published':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Published</Badge>;
      case 'paused':
        return <Badge variant="outline">Paused</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generated Ads History</CardTitle>
          <CardDescription>
            Track all automatically generated football betting ads and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : generatedAds.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                No ads generated yet. Use the Template Editor to create a template, upload team images, and generate ads for upcoming fixtures.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fixture</TableHead>
                  <TableHead>Match Date</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Meta Ad ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generatedAds.map((ad) => {
                  const fixture = getFixture(ad.fixture_id);
                  const homeTeam = fixture ? getTeam(fixture.home_team_id) : null;
                  const awayTeam = fixture ? getTeam(fixture.away_team_id) : null;

                  return (
                    <TableRow key={ad.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {homeTeam?.image_url && (
                            <img src={homeTeam.image_url} alt="" className="h-5 w-5 object-contain" />
                          )}
                          <span className="font-medium">
                            {homeTeam?.short_name || '?'} vs {awayTeam?.short_name || '?'}
                          </span>
                          {awayTeam?.image_url && (
                            <img src={awayTeam.image_url} alt="" className="h-5 w-5 object-contain" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {fixture ? format(new Date(fixture.match_date), 'EEE, d MMM HH:mm') : '-'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(ad.created_at), 'd MMM yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(ad.status)}
                        {ad.error_message && (
                          <p className="text-xs text-destructive mt-1">{ad.error_message}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {ad.meta_ad_id ? (
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">{ad.meta_ad_id}</code>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {ad.generated_image_url && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={ad.generated_image_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
