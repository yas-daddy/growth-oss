import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplateEditor } from "@/components/football-ads/TemplateEditor";
import { TeamImageManager } from "@/components/football-ads/TeamImageManager";
import { FixturesPreview } from "@/components/football-ads/FixturesPreview";
import { GeneratedAdsHistory } from "@/components/football-ads/GeneratedAdsHistory";
import { Palette, Users, Calendar, History } from "lucide-react";

export default function FootballAds() {
  const [activeTab, setActiveTab] = useState("editor");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Football Ad Generator</h1>
        <p className="text-muted-foreground">
          Create automated betting ads for Premier League fixtures
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="editor" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Template</span>
          </TabsTrigger>
          <TabsTrigger value="teams" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Teams</span>
          </TabsTrigger>
          <TabsTrigger value="fixtures" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Fixtures</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          <TemplateEditor />
        </TabsContent>

        <TabsContent value="teams" className="space-y-4">
          <TeamImageManager />
        </TabsContent>

        <TabsContent value="fixtures" className="space-y-4">
          <FixturesPreview />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <GeneratedAdsHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
