import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFootballFixtures } from "@/hooks/useFootballFixtures";
import { useFootballTeams } from "@/hooks/useFootballTeams";
import { useGeneratedAds } from "@/hooks/useGeneratedAds";
import { useAdTemplates } from "@/hooks/useAdTemplates";
import { format } from "date-fns";
import { RefreshCw, Play, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function FixturesPreview() {
  const { fixtures, syncFixtures, isLoading, isSyncing } = useFootballFixtures();
  const { teams } = useFootballTeams();
  const { generateAd, isGenerating } = useGeneratedAds();
  const { templates } = useAdTemplates();
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const getTeam = (teamId: string | null) => {
    if (!teamId) return null;
    return teams.find(t => t.id === teamId);
  };

  const isEligible = (homeTeamId: string | null, awayTeamId: string | null) => {
    const homeTeam = getTeam(homeTeamId);
    const awayTeam = getTeam(awayTeamId);
    return homeTeam?.image_url && awayTeam?.image_url;
  };

  const eligibleCount = fixtures.filter(f => isEligible(f.home_team_id, f.away_team_id)).length;

  // Get the active template (or first template if none active)
  const activeTemplate = templates.find(t => t.is_active) || templates[0];

  const handleGenerateAd = async (fixtureId: string) => {
    setGeneratingId(fixtureId);
    try {
      await generateAd({ 
        fixtureId, 
        templateId: activeTemplate?.id 
      });
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Upcoming Fixtures</CardTitle>
              <CardDescription>
                Upcoming fixtures from Premier League, FA Cup & Champions League.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={eligibleCount > 0 ? "default" : "secondary"}>
                {eligibleCount} eligible fixtures
              </Badge>
              <Button onClick={syncFixtures} disabled={isSyncing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Fixtures'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : fixtures.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No fixtures available. Click "Sync Fixtures" to fetch upcoming Premier League matches.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Home</TableHead>
                  <TableHead className="text-center">VS</TableHead>
                  <TableHead>Away</TableHead>
                  <TableHead>Odds</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fixtures.map((fixture) => {
                  const homeTeam = getTeam(fixture.home_team_id);
                  const awayTeam = getTeam(fixture.away_team_id);
                  const eligible = isEligible(fixture.home_team_id, fixture.away_team_id);

                  return (
                    <TableRow key={fixture.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {format(new Date(fixture.match_date), 'EEE, d MMM')}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(fixture.match_date), 'HH:mm')}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {homeTeam?.image_url ? (
                            <img 
                              src={homeTeam.image_url} 
                              alt={homeTeam.name} 
                              className="h-6 w-6 object-contain"
                            />
                          ) : (
                            <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                              <AlertCircle className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium">{homeTeam?.short_name || 'TBD'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">vs</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {awayTeam?.image_url ? (
                            <img 
                              src={awayTeam.image_url} 
                              alt={awayTeam.name} 
                              className="h-6 w-6 object-contain"
                            />
                          ) : (
                            <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                              <AlertCircle className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium">{awayTeam?.short_name || 'TBD'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {fixture.home_odds && fixture.draw_odds && fixture.away_odds ? (
                          <div className="text-sm space-x-2">
                            <span className="text-green-600">{fixture.home_odds}</span>
                            <span className="text-muted-foreground">{fixture.draw_odds}</span>
                            <span className="text-blue-600">{fixture.away_odds}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No odds</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {eligible ? (
                          <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Ready
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Missing images
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={eligible ? "default" : "outline"}
                          disabled={!eligible || generatingId === fixture.id}
                          onClick={() => handleGenerateAd(fixture.id)}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          {generatingId === fixture.id ? 'Generating...' : 'Generate'}
                        </Button>
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
