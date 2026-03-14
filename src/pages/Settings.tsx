import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { 
  Shield, Database, ChevronRight, Megaphone, Users, Palette, 
  RefreshCw, Sparkles, Lock, MessageSquare, ShieldCheck, Gauge, Target
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface SettingsRowProps {
  to: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
}

function SettingsRow({ to, icon, iconBg, title, description }: SettingsRowProps) {
  return (
    <Link 
      to={to} 
      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors rounded-lg group"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
    </Link>
  );
}

function SettingsSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 pb-1">{label}</p>
      <Card>
        <CardContent className="p-1 divide-y divide-border">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xl font-bold text-primary">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <p className="font-medium">{user?.user_metadata?.full_name || 'User'}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {!roleLoading && (
                <Badge 
                  variant="outline" 
                  className={`mt-1 capitalize text-[10px] ${
                    role === 'admin' ? 'bg-primary/10 text-primary border-primary/30' : 
                    role === 'affiliate' ? 'bg-accent/10 text-accent border-accent/30' : ''
                  }`}
                >
                  {role}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* General */}
      <SettingsSection label="General">
        <SettingsRow
          to="/settings/appearance"
          icon={<Palette className="h-4 w-4 text-white" />}
          iconBg="bg-purple-500"
          title="Appearance"
          description="Theme and display preferences"
        />
      </SettingsSection>

      {/* Data & Sync */}
      <SettingsSection label="Data & Sync">
        <SettingsRow
          to="/settings/connections"
          icon={<Database className="h-4 w-4 text-white" />}
          iconBg="bg-blue-500"
          title="Partners"
          description="Connect ad platforms, analytics, and review services"
        />
        <SettingsRow
          to="/settings/syncs"
          icon={<RefreshCw className="h-4 w-4 text-white" />}
          iconBg="bg-teal-500"
          title="Automated Syncs"
          description="Scheduled sync jobs and history"
        />
      </SettingsSection>

      {/* AI & Automation */}
      <SettingsSection label="AI & Automation">
        <SettingsRow
          to="/settings/ai"
          icon={<Sparkles className="h-4 w-4 text-white" />}
          iconBg="bg-violet-500"
          title="Review AI Training"
          description="Customize AI response and insights prompts"
        />
        <SettingsRow
          to="/settings/auto-responses"
          icon={<MessageSquare className="h-4 w-4 text-white" />}
          iconBg="bg-pink-500"
          title="Auto-Response Rules"
          description="Automated review response settings"
        />


        <SettingsRow
          to="/settings/compliance"
          icon={<ShieldCheck className="h-4 w-4 text-white" />}
          iconBg="bg-cyan-600"
          title="Compliance Rules"
          description="Configure AI compliance checking rules"
        />
      </SettingsSection>

      {/* Features */}
      <SettingsSection label="Features">
        <SettingsRow
          to="/settings/ad-platforms"
          icon={<Megaphone className="h-4 w-4 text-white" />}
          iconBg="bg-rose-500"
          title="Ad Platforms"
          description="Configure ad platform integrations"
        />
        <SettingsRow
          to="/settings/affiliates"
          icon={<Users className="h-4 w-4 text-white" />}
          iconBg="bg-emerald-500"
          title="Affiliate Partners"
          description="Manage affiliate partners and links"
        />


        <SettingsRow
          to="/settings/cpa"
          icon={<Gauge className="h-4 w-4 text-white" />}
          iconBg="bg-amber-500"
          title="CPA Targets"
          description="CPA thermometer thresholds"
        />
        <SettingsRow
          to="/settings/conversion-events"
          icon={<Target className="h-4 w-4 text-white" />}
          iconBg="bg-orange-500"
          title="Conversion Events"
          description="Define events for CPA tracking"
        />
      </SettingsSection>

      {/* Access */}
      <SettingsSection label="Access">
        <SettingsRow
          to="/settings/users"
          icon={<Shield className="h-4 w-4 text-white" />}
          iconBg="bg-slate-600"
          title="Users & Permissions"
          description="Manage users and access control"
        />
        <SettingsRow
          to="/settings/security"
          icon={<Lock className="h-4 w-4 text-white" />}
          iconBg="bg-red-500"
          title="Security"
          description="Change password and security settings"
        />
      </SettingsSection>
    </div>
  );
}
