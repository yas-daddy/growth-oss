import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useReviewSettings, useUpdateReviewSettings } from '@/hooks/useReviewSettings';
import { useFootballTeams } from '@/hooks/useFootballTeams';
import { useFootballTeamScores } from '@/hooks/useFootballTeamScores';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Bell, Loader2, Search, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

export default function PushSettings() {
  const { toast } = useToast();
  const { data: reviewSettings } = useReviewSettings();
  const updateSettingsMutation = useUpdateReviewSettings();
  const { teams, isLoading: teamsLoading, syncTeams, isSyncing } = useFootballTeams();
  const { getTeamScore, updateScore, isLoading: scoresLoading } = useFootballTeamScores();
  const [pushPrompt, setPushPrompt] = useState('');
  const [brazeCanvasId, setBrazeCanvasId] = useState('');
  const [teamSearch, setTeamSearch] = useState('');

  const filteredTeams = useMemo(() => {
    if (!teamSearch.trim()) return teams;
    const q = teamSearch.toLowerCase();
    return teams.filter(t => t.name.toLowerCase().includes(q) || t.short_name?.toLowerCase().includes(q) || t.tla?.toLowerCase().includes(q));
  }, [teams, teamSearch]);

  useEffect(() => {
    if (reviewSettings?.push_notification_prompt) setPushPrompt(reviewSettings.push_notification_prompt);
    if (reviewSettings?.braze_canvas_id) setBrazeCanvasId(reviewSettings.braze_canvas_id);
  }, [reviewSettings]);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Push Notifications</h1>
          <p className="text-muted-foreground">Configure Braze and AI copy generation</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Braze Canvas ID</CardTitle>
          </div>
          <CardDescription>The Canvas ID from Braze used for API-triggered push notifications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={brazeCanvasId} onChange={(e) => setBrazeCanvasId(e.target.value)} placeholder="Enter your Braze Canvas ID..." className="font-mono text-sm" />
            <Button
              onClick={async () => {
                try {
                  await updateSettingsMutation.mutateAsync({ brazeCanvasId });
                  toast({ title: "Saved", description: "Braze Canvas ID updated" });
                } catch {
                  toast({ title: "Error", description: "Failed to save Canvas ID", variant: "destructive" });
                }
              }}
              disabled={updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Copy Instructions</CardTitle>
          <CardDescription>These instructions are appended to the AI system prompt when generating push notification copy.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={pushPrompt} onChange={(e) => setPushPrompt(e.target.value)} placeholder="e.g. Always mention the odds. Keep tone casual and fun..." rows={4} className="font-mono text-sm" />
          <div className="flex items-center gap-2">
            <Button
              onClick={async () => {
                try {
                  await updateSettingsMutation.mutateAsync({ pushNotificationPrompt: pushPrompt });
                  toast({ title: "Saved", description: "Push notification prompt updated" });
                } catch {
                  toast({ title: "Error", description: "Failed to save prompt", variant: "destructive" });
                }
              }}
              disabled={updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Prompt'}
            </Button>
            <Button variant="outline" onClick={() => setPushPrompt('')}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {/* Team Score Directory */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Team Score Directory</CardTitle>
          </div>
          <CardDescription>Assign a score (1-10) to each team. Match scores are the sum of both teams' scores, used for filtering high-value fixtures.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {teams.length === 0 && (
              <Button variant="outline" size="sm" onClick={syncTeams} disabled={isSyncing}>
                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Sync Teams
              </Button>
            )}
          </div>

          {teamsLoading || scoresLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filteredTeams.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">
              {teams.length === 0 ? 'No teams found. Sync fixtures to populate teams.' : 'No teams match your search.'}
            </p>
          ) : (
            <div className="divide-y max-h-[400px] overflow-y-auto rounded-md border">
              {filteredTeams.map((team) => {
                const currentScore = getTeamScore(team.id);
                return (
                  <div key={team.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm truncate">{team.name}</span>
                      {team.tla && <span className="text-xs text-muted-foreground">({team.tla})</span>}
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={currentScore}
                      onChange={(e) => {
                        const val = Math.min(10, Math.max(1, parseInt(e.target.value) || 1));
                        updateScore(team.id, val);
                      }}
                      className="w-16 h-8 text-center text-sm"
                    />
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {teams.length} teams · Unscored teams default to 1
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
