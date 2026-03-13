import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useFootballTeams } from "@/hooks/useFootballTeams";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, RefreshCw, Search, CheckCircle, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function TeamImageManager() {
  const { teams, updateTeamImage, syncTeams, isLoading, isSyncing } = useFootballTeams();
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadingTeamId, setUploadingTeamId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.short_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const teamsWithImages = teams.filter(t => t.image_url).length;
  const totalTeams = teams.length;

  const handleImageUpload = async (teamId: string, file: File) => {
    setUploadingTeamId(teamId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `team-${teamId}-${Date.now()}.${fileExt}`;
      const filePath = `teams/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('football-team-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('football-team-images')
        .getPublicUrl(filePath);

      await updateTeamImage(teamId, publicUrl);
      toast.success("Team image uploaded");
    } catch (error: any) {
      toast.error("Upload failed: " + error.message);
    } finally {
      setUploadingTeamId(null);
    }
  };

  const handleRemoveImage = async (teamId: string) => {
    try {
      await updateTeamImage(teamId, null);
      toast.success("Image removed");
    } catch (error: any) {
      toast.error("Failed to remove image: " + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Images</CardTitle>
              <CardDescription>
                Upload custom images for each Premier League team. Only fixtures with both teams having images will generate ads.
              </CardDescription>
            </div>
            <Button onClick={syncTeams} disabled={isSyncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Teams'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={teamsWithImages === totalTeams ? "default" : "secondary"}>
                {teamsWithImages}/{totalTeams} teams ready
              </Badge>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-lg" />
              ))}
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchQuery ? 'No teams found matching your search' : 'No teams available. Click "Sync Teams" to fetch Premier League teams.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredTeams.map((team) => (
                <Card key={team.id} className="relative overflow-hidden">
                  <div className="aspect-square relative bg-muted/30">
                    {team.image_url ? (
                      <>
                        <img
                          src={team.image_url}
                          alt={team.name}
                          className="w-full h-full object-contain p-4"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={() => handleRemoveImage(team.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <div className="absolute top-2 left-2">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
                        <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
                        <input
                          ref={(el) => fileInputRefs.current[team.id] = el}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(team.id, file);
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRefs.current[team.id]?.click()}
                          disabled={uploadingTeamId === team.id}
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          {uploadingTeamId === team.id ? 'Uploading...' : 'Upload'}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="p-3 text-center border-t">
                    <p className="font-medium text-sm truncate">{team.name}</p>
                    <p className="text-xs text-muted-foreground">{team.tla}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
