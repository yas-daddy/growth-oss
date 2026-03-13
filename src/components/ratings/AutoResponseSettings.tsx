import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAutoResponseSettings, useUpdateAutoResponseSettings } from "@/hooks/useAutoResponseSettings";
import { Loader2, Bot, Apple, Play, Star } from "lucide-react";

const platformIcons: Record<string, React.ReactNode> = {
  "App Store": <Apple className="h-4 w-4" />,
  "Google Play": <Play className="h-4 w-4" />,
  "Trustpilot": <Star className="h-4 w-4" />,
};

export function AutoResponseSettings() {
  const { data: settings, isLoading } = useAutoResponseSettings();
  const updateSettings = useUpdateAutoResponseSettings();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Auto-Response Settings
        </CardTitle>
        <CardDescription>
          Configure automatic AI responses for each platform. Reviews at or above the threshold will be auto-posted;
          lower ratings are queued for review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {settings?.map((setting) => (
          <div key={setting.id} className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-muted">
                {platformIcons[setting.platform]}
              </div>
              <div>
                <p className="font-medium">{setting.platform}</p>
                <p className="text-sm text-muted-foreground">
                  {setting.enabled
                    ? `Auto-post ${setting.auto_post_threshold}+ star reviews`
                    : "Disabled"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor={`threshold-${setting.id}`} className="text-sm text-muted-foreground">
                  Threshold:
                </Label>
                <Select
                  value={setting.auto_post_threshold.toString()}
                  onValueChange={(value) =>
                    updateSettings.mutate({
                      platform: setting.platform,
                      auto_post_threshold: parseInt(value),
                    })
                  }
                  disabled={!setting.enabled}
                >
                  <SelectTrigger id={`threshold-${setting.id}`} className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5★</SelectItem>
                    <SelectItem value="4">4★</SelectItem>
                    <SelectItem value="3">3★</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Switch
                checked={setting.enabled}
                onCheckedChange={(checked) =>
                  updateSettings.mutate({
                    platform: setting.platform,
                    enabled: checked,
                  })
                }
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
