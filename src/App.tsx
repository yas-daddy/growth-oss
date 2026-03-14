import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import DashboardPage from "./pages/DashboardPage";
import AdPlatformSettings from "./pages/AdPlatformSettings";
import AffiliateSettings from "./pages/AffiliateSettings";
import AffiliateDetail from "./pages/AffiliateDetail";
import AppRatings from "./pages/AppRatings";
import Settings from "./pages/Settings";
import ConnectionsSettings from "./pages/settings/ConnectionsSettings";
import SyncSettings from "./pages/settings/SyncSettings";
import AISettings from "./pages/settings/AISettings";
import AutoResponsesSettings from "./pages/settings/AutoResponsesSettings";

import CPASettings from "./pages/settings/CPASettings";
import RatingWeightsSettings from "./pages/settings/RatingWeightsSettings";
import SecuritySettings from "./pages/settings/SecuritySettings";
import AppearanceSettings from "./pages/settings/AppearanceSettings";
import Projections from "./pages/Projections";
import UserManagement from "./pages/UserManagement";
import WeeklyTracker from "./pages/WeeklyTracker";
import MonthlyTracker from "./pages/MonthlyTracker";
import LaunchAds from "./pages/LaunchAds";
import TopAds from "./pages/TopAds";
import CreativeAnalysis from "./pages/CreativeAnalysis";
import KeywordAnalysis from "./pages/KeywordAnalysis";
import AutomationRules from "./pages/AutomationRules";
import Recommendations from "./pages/Recommendations";
import AudienceAnalysis from "./pages/AudienceAnalysis";
import BrandVisibility from "./pages/BrandVisibility";
import BrandScoreSettings from "./pages/BrandScoreSettings";
import FootballAds from "./pages/FootballAds";
import CampaignPerformance from "./pages/CampaignPerformance";
import PushNotifications from "./pages/PushNotifications";
import EmailCampaigns from "./pages/EmailCampaigns";
import EmailCampaignDetail from "./pages/EmailCampaignDetail";
import CompetitorAds from "./pages/CompetitorAds";
import ComplianceChecker from "./pages/ComplianceChecker";
import ComplianceSettings from "./pages/settings/ComplianceSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Index />} />
              <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              
              {/* All dashboards use the unified DashboardPage */}
              <Route path="/dashboard/:slug" element={<DashboardPage />} />
              
              {/* Legacy routes redirect to new pattern */}
              <Route path="/revenue" element={<Navigate to="/dashboard/revenue" replace />} />
              <Route path="/channels" element={<Navigate to="/dashboard/channels" replace />} />
              <Route path="/affiliates" element={<Navigate to="/dashboard/affiliates" replace />} />
              <Route path="/funnel" element={<Navigate to="/dashboard/funnel" replace />} />
              
              {/* Non-dashboard pages */}
              <Route path="/projections" element={<ProtectedRoute><Projections /></ProtectedRoute>} />
              <Route path="/brand-visibility" element={<ProtectedRoute><BrandVisibility /></ProtectedRoute>} />
              <Route path="/top-ads" element={<ProtectedRoute><TopAds /></ProtectedRoute>} />
              <Route path="/creative-analysis" element={<ProtectedRoute><CreativeAnalysis /></ProtectedRoute>} />
              <Route path="/keyword-analysis" element={<ProtectedRoute><KeywordAnalysis /></ProtectedRoute>} />
              <Route path="/audience-analysis" element={<ProtectedRoute><AudienceAnalysis /></ProtectedRoute>} />
              <Route path="/recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
              <Route path="/automation-rules" element={<ProtectedRoute><AutomationRules /></ProtectedRoute>} />
              <Route path="/launch-ads" element={<ProtectedRoute><LaunchAds /></ProtectedRoute>} />
              <Route path="/football-ads" element={<ProtectedRoute><FootballAds /></ProtectedRoute>} />
              <Route path="/push-notifications" element={<ProtectedRoute><PushNotifications /></ProtectedRoute>} />
              <Route path="/email-campaigns" element={<ProtectedRoute><EmailCampaigns /></ProtectedRoute>} />
              <Route path="/email-campaigns/:campaignId" element={<ProtectedRoute><EmailCampaignDetail /></ProtectedRoute>} />
              <Route path="/campaign-performance" element={<ProtectedRoute><CampaignPerformance /></ProtectedRoute>} />
              <Route path="/competitor-ads" element={<ProtectedRoute><CompetitorAds /></ProtectedRoute>} />
              <Route path="/compliance" element={<ProtectedRoute><ComplianceChecker /></ProtectedRoute>} />
              <Route path="/ratings" element={<ProtectedRoute><AppRatings /></ProtectedRoute>} />
              <Route path="/weekly" element={<ProtectedRoute><WeeklyTracker /></ProtectedRoute>} />
              <Route path="/monthly" element={<ProtectedRoute><MonthlyTracker /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/settings/connections" element={<ProtectedRoute><ConnectionsSettings /></ProtectedRoute>} />
              <Route path="/settings/syncs" element={<ProtectedRoute><SyncSettings /></ProtectedRoute>} />
              <Route path="/settings/ai" element={<ProtectedRoute><AISettings /></ProtectedRoute>} />
              <Route path="/settings/auto-responses" element={<ProtectedRoute><AutoResponsesSettings /></ProtectedRoute>} />
              <Route path="/settings/push-settings" element={<ProtectedRoute><PushSettings /></ProtectedRoute>} />
              <Route path="/settings/cpa" element={<ProtectedRoute><CPASettings /></ProtectedRoute>} />
              <Route path="/settings/rating-weights" element={<ProtectedRoute><RatingWeightsSettings /></ProtectedRoute>} />
              <Route path="/settings/security" element={<ProtectedRoute><SecuritySettings /></ProtectedRoute>} />
              <Route path="/settings/appearance" element={<ProtectedRoute><AppearanceSettings /></ProtectedRoute>} />
              <Route path="/settings/compliance" element={<ProtectedRoute><ComplianceSettings /></ProtectedRoute>} />
              <Route path="/settings/ad-platforms" element={<ProtectedRoute><AdPlatformSettings /></ProtectedRoute>} />
              <Route path="/settings/affiliates" element={<ProtectedRoute><AffiliateSettings /></ProtectedRoute>} />
              <Route path="/settings/affiliates/:id" element={<ProtectedRoute><AffiliateDetail /></ProtectedRoute>} />
              <Route path="/settings/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
              <Route path="/settings/brand-score" element={<ProtectedRoute><BrandScoreSettings /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
