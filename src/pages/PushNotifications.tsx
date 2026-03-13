import { useState, useMemo, useCallback } from "react";
import stakemateLogo from "@/assets/stakemate-logo.png";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useFootballFixtures } from "@/hooks/useFootballFixtures";
import { useFootballTeams } from "@/hooks/useFootballTeams";
import { useFootballTeamScores } from "@/hooks/useFootballTeamScores";
import { usePushNotifications, PushNotificationSchedule } from "@/hooks/usePushNotifications";
import { format } from "date-fns";
import { Bell, Send, XCircle, Clock, CheckCircle, AlertCircle, RefreshCw, History, Loader2, ChevronLeft, ChevronRight, CalendarIcon, Filter, Trophy, HelpCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FIXTURES_PER_PAGE = 10;

const SCORE_BANDS = [
  { label: "Low", range: [1, 4] as const, color: "bg-muted text-muted-foreground" },
  { label: "Medium", range: [5, 8] as const, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  { label: "Good", range: [9, 12] as const, color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30" },
  { label: "High", range: [13, 16] as const, color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30" },
  { label: "Top", range: [17, 20] as const, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
];

function getScoreBadgeColor(score: number): string {
  const band = SCORE_BANDS.find(b => score >= b.range[0] && score <= b.range[1]);
  return band?.color ?? "bg-muted text-muted-foreground";
}

export default function PushNotifications() {
  const { fixtures, isLoading: fixturesLoading, syncFixtures, isSyncing } = useFootballFixtures();
  const { teams } = useFootballTeams();
  const { getMatchScore } = useFootballTeamScores();
  const { schedules, isLoading: schedulesLoading, generateCopy, schedulePush, cancelPush, getScheduleForFixture } = usePushNotifications();

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<PushNotificationSchedule | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Filtering & pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [competitionFilter, setCompetitionFilter] = useState<string>("all");
  const [selectedScoreBands, setSelectedScoreBands] = useState<Set<string>>(new Set());

  // Bulk scheduling state
  const [selectedFixtureIds, setSelectedFixtureIds] = useState<Set<string>>(new Set());
  const [bulkQueue, setBulkQueue] = useState<string[]>([]);
  const [bulkIndex, setBulkIndex] = useState(0);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkCancelDialogOpen, setBulkCancelDialogOpen] = useState(false);

  // Derive unique competitions from fixtures
  const competitions = useMemo(() => {
    const comps = new Set(fixtures.map(f => f.competition).filter(Boolean));
    return Array.from(comps).sort();
  }, [fixtures]);

  // Filter fixtures
  const filteredFixtures = useMemo(() => {
    let result = fixtures;

    if (competitionFilter && competitionFilter !== "all") {
      result = result.filter(f => f.competition === competitionFilter);
    }

    if (dateRange.from) {
      result = result.filter(f => new Date(f.match_date) >= dateRange.from!);
    }

    if (dateRange.to) {
      const endOfDay = new Date(dateRange.to);
      endOfDay.setHours(23, 59, 59, 999);
      result = result.filter(f => new Date(f.match_date) <= endOfDay);
    }

    if (selectedScoreBands.size > 0) {
      result = result.filter(f => {
        const matchScore = getMatchScore(f.home_team_id, f.away_team_id);
        return SCORE_BANDS.some(band => 
          selectedScoreBands.has(band.label) && matchScore >= band.range[0] && matchScore <= band.range[1]
        );
      });
    }

    return result;
  }, [fixtures, competitionFilter, dateRange, selectedScoreBands, getMatchScore]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredFixtures.length / FIXTURES_PER_PAGE));
  const paginatedFixtures = filteredFixtures.slice(
    (currentPage - 1) * FIXTURES_PER_PAGE,
    currentPage * FIXTURES_PER_PAGE
  );

  // Selectable fixtures on current page (not already scheduled)
  const selectableOnPage = useMemo(() => {
    return paginatedFixtures.filter(f => {
      const existing = getScheduleForFixture(f.id);
      return !existing;
    });
  }, [paginatedFixtures, getScheduleForFixture]);

  const allSelectableChecked = selectableOnPage.length > 0 && selectableOnPage.every(f => selectedFixtureIds.has(f.id));

  // Reset page when filters change
  const handleCompetitionChange = (value: string) => {
    setCompetitionFilter(value);
    setCurrentPage(1);
  };

  const handleDateChange = (range: { from?: Date; to?: Date }) => {
    setDateRange(range);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setDateRange({});
    setCompetitionFilter("all");
    setSelectedScoreBands(new Set());
    setCurrentPage(1);
  };

  const hasActiveFilters = competitionFilter !== "all" || dateRange.from || dateRange.to || selectedScoreBands.size > 0;

  const toggleScoreBand = (label: string) => {
    setSelectedScoreBands(prev => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
    setCurrentPage(1);
  };

  const getTeam = (teamId: string | null) => teamId ? teams.find(t => t.id === teamId) : null;

  const toggleFixtureSelection = (fixtureId: string) => {
    setSelectedFixtureIds(prev => {
      const next = new Set(prev);
      if (next.has(fixtureId)) {
        next.delete(fixtureId);
      } else {
        next.add(fixtureId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelectableChecked) {
      setSelectedFixtureIds(prev => {
        const next = new Set(prev);
        selectableOnPage.forEach(f => next.delete(f.id));
        return next;
      });
    } else {
      setSelectedFixtureIds(prev => {
        const next = new Set(prev);
        selectableOnPage.forEach(f => next.add(f.id));
        return next;
      });
    }
  };

  const handleOpenSchedule = useCallback(async (fixtureId: string) => {
    const fixture = fixtures.find(f => f.id === fixtureId);
    setSelectedFixtureId(fixtureId);
    setEditTitle("");
    setEditBody("");
    
    // Default to kickoff - 20min
    if (fixture) {
      const kickoff = new Date(fixture.match_date);
      const defaultTime = new Date(kickoff.getTime() - 20 * 60 * 1000);
      setScheduledTime(format(defaultTime, "yyyy-MM-dd'T'HH:mm"));
    }
    
    setScheduleDialogOpen(true);
    setIsGenerating(true);

    try {
      const result = await generateCopy.mutateAsync(fixtureId);
      setEditTitle(result.title);
      setEditBody(result.body);
    } catch {
      // Fallback is fine, fields stay empty
    } finally {
      setIsGenerating(false);
    }
  }, [fixtures, generateCopy]);

  const handleConfirmSchedule = async () => {
    if (!selectedFixtureId) return;
    await schedulePush.mutateAsync({
      fixture_id: selectedFixtureId,
      title: editTitle || undefined,
      body: editBody || undefined,
      scheduled_at: scheduledTime ? new Date(scheduledTime).toISOString() : undefined,
    });
    setScheduleDialogOpen(false);

    // Bulk mode: advance to next
    if (isBulkMode) {
      const nextIndex = bulkIndex + 1;
      if (nextIndex < bulkQueue.length) {
        setBulkIndex(nextIndex);
        // Small delay so dialog close/open is visible
        setTimeout(() => handleOpenSchedule(bulkQueue[nextIndex]), 300);
      } else {
        // All done
        const count = bulkQueue.length;
        clearBulkState();
        toast.success(`All ${count} notifications scheduled!`);
      }
    }
  };

  const clearBulkState = () => {
    setIsBulkMode(false);
    setBulkQueue([]);
    setBulkIndex(0);
    setSelectedFixtureIds(new Set());
  };

  const handleStartBulk = () => {
    const queue = [...selectedFixtureIds];
    if (queue.length === 0) return;
    setBulkQueue(queue);
    setBulkIndex(0);
    setIsBulkMode(true);
    handleOpenSchedule(queue[0]);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && isBulkMode) {
      // Show confirmation to stop bulk
      setBulkCancelDialogOpen(true);
      return;
    }
    setScheduleDialogOpen(open);
  };

  const handleConfirmStopBulk = () => {
    setBulkCancelDialogOpen(false);
    setScheduleDialogOpen(false);
    clearBulkState();
  };

  const handleOpenCancel = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedScheduleId) return;
    await cancelPush.mutateAsync(selectedScheduleId);
    setCancelDialogOpen(false);
  };

  const handleOpenDetail = (schedule: PushNotificationSchedule) => {
    setSelectedSchedule(schedule);
    setDetailDialogOpen(true);
  };

  const selectedFixture = selectedFixtureId ? fixtures.find(f => f.id === selectedFixtureId) : null;
  const selectedHome = selectedFixture ? getTeam(selectedFixture.home_team_id) : null;
  const selectedAway = selectedFixture ? getTeam(selectedFixture.away_team_id) : null;

  // Derive effective status: scheduled + time elapsed = "sent"
  const getEffectiveStatus = (s: PushNotificationSchedule) => {
    if (s.status === "scheduled" && new Date(s.scheduled_at) <= new Date()) {
      return "sent";
    }
    return s.status;
  };

  const pastSchedules = schedules.filter(s => {
    const effective = getEffectiveStatus(s);
    return effective !== "scheduled";
  });

  const statusBadge = (status: string, schedule?: PushNotificationSchedule) => {
    const clickable = (status === "scheduled" || status === "sent") && schedule;
    const baseClass = clickable ? "cursor-pointer hover:opacity-80" : "";
    const onClick = clickable ? () => handleOpenDetail(schedule) : undefined;

    switch (status) {
      case "scheduled":
        return <Badge variant="default" className={baseClass} onClick={onClick}><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
      case "cancelled":
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      case "sent":
        return <Badge className={`bg-emerald-600 hover:bg-emerald-600 text-white ${baseClass}`} onClick={onClick}><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Bulk mode dialog labels
  const bulkProgressLabel = isBulkMode ? `Match ${bulkIndex + 1} of ${bulkQueue.length}` : null;
  const isLastInBulk = isBulkMode && bulkIndex === bulkQueue.length - 1;
  const scheduleButtonLabel = schedulePush.isPending
    ? "Scheduling..."
    : isBulkMode
      ? isLastInBulk ? "Schedule & Finish" : "Schedule & Next"
      : "Confirm & Schedule";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Push Notifications
            <Button variant="ghost" size="icon" onClick={() => setHelpOpen(true)} title="Help" className="ml-1">
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
            </Button>
          </h1>
          <p className="text-muted-foreground">Schedule pre-match push notifications via Braze</p>
        </div>
        <Button onClick={syncFixtures} disabled={isSyncing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
          Sync Fixtures
        </Button>
      </div>

      {/* Upcoming Fixtures */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Upcoming Fixtures</CardTitle>
              <CardDescription>Schedule push notifications before kickoff. AI will generate the copy for you to review.</CardDescription>
            </div>
            {selectedFixtureIds.size > 0 && (
              <Button onClick={handleStartBulk} size="sm">
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Bulk Schedule ({selectedFixtureIds.size})
              </Button>
            )}
          </div>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Select value={competitionFilter} onValueChange={handleCompetitionChange}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Competitions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Competitions</SelectItem>
                {competitions.map(comp => (
                  <SelectItem key={comp} value={comp}>{comp}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[220px] justify-start text-left font-normal", !dateRange.from && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5 mr-2" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>{format(dateRange.from, "d MMM")} – {format(dateRange.to, "d MMM")}</>
                    ) : (
                      format(dateRange.from, "d MMM yyyy")
                    )
                  ) : (
                    <span>Filter by date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined}
                  onSelect={(range) => handleDateChange({ from: range?.from, to: range?.to })}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal", selectedScoreBands.size === 0 && "text-muted-foreground")}>
                  <Trophy className="h-3.5 w-3.5 mr-2" />
                  Score Band{selectedScoreBands.size > 0 ? ` (${selectedScoreBands.size})` : ""}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="space-y-1">
                  {SCORE_BANDS.map(band => (
                    <label key={band.label} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                      <Checkbox
                        checked={selectedScoreBands.has(band.label)}
                        onCheckedChange={() => toggleScoreBand(band.label)}
                      />
                      <span>{band.label}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{band.range[0]}-{band.range[1]}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                Clear filters
              </Button>
            )}

            <span className="text-xs text-muted-foreground ml-auto">
              {filteredFixtures.length} fixture{filteredFixtures.length !== 1 ? "s" : ""}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {fixturesLoading || schedulesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : filteredFixtures.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {fixtures.length === 0
                ? 'No upcoming fixtures. Click "Sync Fixtures" to fetch matches.'
                : "No fixtures match your filters."}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelectableChecked}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all fixtures"
                        disabled={selectableOnPage.length === 0}
                      />
                    </TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Competition</TableHead>
                    <TableHead>Push Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedFixtures.map((fixture) => {
                    const home = getTeam(fixture.home_team_id);
                    const away = getTeam(fixture.away_team_id);
                    const existing = getScheduleForFixture(fixture.id);
                    const isSelectable = !existing;
                    const matchScore = getMatchScore(fixture.home_team_id, fixture.away_team_id);

                    return (
                      <TableRow key={fixture.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedFixtureIds.has(fixture.id)}
                            onCheckedChange={() => toggleFixtureSelection(fixture.id)}
                            disabled={!isSelectable}
                            aria-label={`Select ${home?.short_name || "Home"} vs ${away?.short_name || "Away"}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{format(new Date(fixture.match_date), "EEE, d MMM")}</div>
                            <div className="text-sm text-muted-foreground">{format(new Date(fixture.match_date), "HH:mm")}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {home?.image_url && <img src={home.image_url} alt="" className="w-5 h-5 object-contain" />}
                            <span className="font-medium">{home?.short_name || "TBD"}</span>
                            <span className="text-muted-foreground mx-1">vs</span>
                            {away?.image_url && <img src={away.image_url} alt="" className="w-5 h-5 object-contain" />}
                            <span className="font-medium">{away?.short_name || "TBD"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("font-mono text-xs", getScoreBadgeColor(matchScore))}>
                            {matchScore}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{fixture.competition || "—"}</span>
                        </TableCell>
                        <TableCell>
                          {existing ? statusBadge(getEffectiveStatus(existing), existing) : <Badge variant="outline">Not scheduled</Badge>}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {existing && getEffectiveStatus(existing) === "scheduled" ? (
                            <Button size="sm" variant="destructive" onClick={() => handleOpenCancel(existing.id)} disabled={cancelPush.isPending}>
                              <XCircle className="h-3 w-3 mr-1" />Cancel
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" onClick={() => handleOpenSchedule(fixture.id)} disabled={schedulePush.isPending} className="h-8 w-8">
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {pastSchedules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Notification History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scheduled For</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Body</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastSchedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{format(new Date(s.scheduled_at), "d MMM yyyy HH:mm")}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{s.ai_title}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-muted-foreground">{s.ai_body}</TableCell>
                    <TableCell>{statusBadge(getEffectiveStatus(s), s)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Schedule Push Notification</span>
              {bulkProgressLabel && (
                <Badge variant="secondary" className="ml-2 font-normal text-xs">
                  {bulkProgressLabel}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              <span className="inline-flex items-center gap-1">
                {selectedHome?.image_url && <img src={selectedHome.image_url} alt="" className="w-4 h-4 object-contain inline" />}
                {selectedHome?.short_name || "Home"} vs{" "}
                {selectedAway?.image_url && <img src={selectedAway.image_url} alt="" className="w-4 h-4 object-contain inline" />}
                {selectedAway?.short_name || "Away"}
              </span>
              {selectedFixture && ` — ${format(new Date(selectedFixture.match_date), "EEE d MMM, HH:mm")}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              {isGenerating ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating AI copy suggestion...
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedFixture) {
                      setIsGenerating(true);
                      generateCopy.mutateAsync(selectedFixture.id).then((result) => {
                        setEditTitle(result.title);
                        setEditBody(result.body);
                      }).finally(() => setIsGenerating(false));
                    }
                  }}
                  disabled={!selectedFixture}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Regenerate copy
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="push-title">Title</Label>
              <Input
                id="push-title"
                placeholder={isGenerating ? "Generating..." : "Enter push title"}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={50}
                disabled={isGenerating}
              />
              <p className="text-xs text-muted-foreground">{editTitle.length}/50 characters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="push-body">Body</Label>
              <Textarea
                id="push-body"
                placeholder={isGenerating ? "Generating..." : "Enter push body"}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                maxLength={150}
                rows={3}
                disabled={isGenerating}
              />
              <p className="text-xs text-muted-foreground">{editBody.length}/150 characters</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="push-time">Send Time</Label>
                {selectedFixture && (
                  <span className="text-xs text-muted-foreground">
                    Kickoff: {format(new Date(selectedFixture.match_date), "EEE d MMM, HH:mm")}
                  </span>
                )}
              </div>
              <Input
                id="push-time"
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>
          {/* Push notification preview */}
          {(editTitle || editBody) && (
            <div className="pt-2">
              <p className="text-sm font-medium text-muted-foreground mb-2">Preview</p>
              <div className="relative rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
                <div className="absolute inset-0 backdrop-blur-xl bg-white/5" />
                <div className="relative p-4">
                  <p className="text-center text-white/60 text-[10px] font-medium tracking-wide uppercase mb-3">now</p>
                  <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/10 p-3 shadow-lg">
                    <div className="flex items-start gap-2.5">
                      <img src={stakemateLogo} alt="Stakemate" className="w-9 h-9 rounded-lg shrink-0 shadow-md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wide">Stakemate</span>
                          <span className="text-[10px] text-white/40">now</span>
                        </div>
                        {editTitle && (
                          <p className="text-[13px] font-semibold text-white leading-tight">{editTitle}</p>
                        )}
                        {editBody && (
                          <p className="text-[13px] text-white/75 leading-tight mt-0.5 line-clamp-3">{editBody}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose(false)}>Cancel</Button>
            <Button onClick={handleConfirmSchedule} disabled={schedulePush.isPending || isGenerating}>
              {scheduleButtonLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Cancel Confirmation */}
      <AlertDialog open={bulkCancelDialogOpen} onOpenChange={setBulkCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop bulk scheduling?</AlertDialogTitle>
            <AlertDialogDescription>
              You've scheduled {bulkIndex} of {bulkQueue.length} notifications. The remaining ones will not be scheduled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkCancelDialogOpen(false)}>Continue scheduling</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmStopBulk}>Stop</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Scheduled Push Details</DialogTitle>
          </DialogHeader>
          {selectedSchedule && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-muted-foreground text-xs">Title</Label>
                <p className="font-medium">{selectedSchedule.ai_title}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Body</Label>
                <p className="text-sm">{selectedSchedule.ai_body}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Scheduled Send Time</Label>
                <p className="text-sm">{format(new Date(selectedSchedule.scheduled_at), "EEE d MMM yyyy, HH:mm")}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Braze Schedule ID</Label>
                <p className="text-sm font-mono text-xs">{selectedSchedule.braze_schedule_id || "N/A"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Created At</Label>
                <p className="text-sm">{format(new Date(selectedSchedule.created_at), "d MMM yyyy, HH:mm")}</p>
              </div>
              {selectedSchedule.braze_response && (
                <div>
                  <Label className="text-muted-foreground text-xs">Braze Response</Label>
                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-32">
                    {JSON.stringify(selectedSchedule.braze_response, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedSchedule && selectedSchedule.status === "scheduled" && (
              <Button
                variant="destructive"
                onClick={() => {
                  setDetailDialogOpen(false);
                  handleOpenCancel(selectedSchedule.id);
                }}
              >
                <XCircle className="h-3 w-3 mr-1" />Cancel Push
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Push Notification?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the scheduled push notification in Braze. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancel} disabled={cancelPush.isPending}>
              {cancelPush.isPending ? "Cancelling..." : "Yes, cancel it"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Help dialog */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How Push Notifications Work</DialogTitle>
            <DialogDescription>Scheduling match-day push notifications via Braze Canvas API</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>This feature schedules Braze Canvas broadcasts triggered before kickoff. AI generates the copy, which you can edit before scheduling.</p>
            <div>
              <p className="font-medium mb-1">How it works:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
                <li>Select a fixture from the upcoming list</li>
                <li>AI generates a title & body based on the match</li>
                <li>Review, edit, and adjust the send time (defaults to 20 min before kickoff)</li>
                <li>The notification is scheduled via Braze Canvas API</li>
              </ol>
            </div>
            <div>
              <p className="font-medium mb-1">Canvas Entry Properties <span className="text-xs text-muted-foreground font-normal">(click to copy)</span>:</p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                {[
                  { key: 'title', liquid: '{{canvas_entry_properties.${title}}}', desc: 'Push notification title' },
                  { key: 'body', liquid: '{{canvas_entry_properties.${body}}}', desc: 'Push notification body' },
                  { key: 'match_name', liquid: '{{canvas_entry_properties.${match_name}}}', desc: 'Match name (e.g. Arsenal vs Chelsea)' },
                ].map(({ key, liquid, desc }) => (
                  <li key={key}>
                    <code
                      className="text-xs bg-muted px-1 rounded cursor-pointer hover:bg-primary/20 transition-colors"
                      onClick={() => { navigator.clipboard.writeText(liquid); toast.success(`Copied: ${liquid}`); }}
                    >{key}</code> — {desc}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium mb-1">Full Liquid syntax <span className="text-xs text-muted-foreground font-normal">(click to copy)</span>:</p>
              <div className="space-y-1">
                {[
                  '{{canvas_entry_properties.${title}}}',
                  '{{canvas_entry_properties.${body}}}',
                  '{{canvas_entry_properties.${match_name}}}',
                ].map(liquid => (
                  <code
                    key={liquid}
                    className="block text-xs bg-muted px-2 py-1 rounded cursor-pointer hover:bg-primary/20 transition-colors font-mono"
                    onClick={() => { navigator.clipboard.writeText(liquid); toast.success(`Copied: ${liquid}`); }}
                  >{liquid}</code>
                ))}
              </div>
            </div>
            <p className="text-muted-foreground">Configure the Braze Canvas ID and AI copy instructions in <a href="/settings/push-settings" className="underline text-primary hover:text-primary/80">Settings → Push Notifications</a>.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
