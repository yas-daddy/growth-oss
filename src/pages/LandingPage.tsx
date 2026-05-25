import { Link } from 'react-router-dom';
import gosLogo from '@/assets/gos-logo.png';
import heroImage from '@/assets/hero-gos.png';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Rocket,
  Brain,
  ArrowRight,
  Building2,
  Plug,
  Settings2,
  TrendingUp,
  Zap,
  Shield,
  Globe,
  Users,
  ChevronRight,
} from 'lucide-react';

const integrations = [
  'Meta Ads',
  'Apple Search Ads',
  'Moloco',
  'AppsFlyer',
  'Mixpanel',
  'Google Play',
  'App Store',
  'Trustpilot',
  'Google Search Console',
];

const features = [
  {
    icon: BarChart3,
    title: 'Central Tracking',
    description:
      'Unified dashboards across every ad platform and affiliate. Weekly & monthly trackers, custom KPIs, and funnel analytics — all in one place.',
    highlights: ['Multi-platform dashboards', 'Weekly & monthly trackers', 'Custom conversion events'],
  },
  {
    icon: Rocket,
    title: 'Launch & Manage Ads',
    description:
      'Create and manage Meta, Apple Search Ads, and Moloco campaigns without leaving GrowthOS. One workflow, every channel.',
    highlights: ['Multi-platform ad launcher', 'Creative library', 'Campaign performance views'],
  },
  {
    icon: Brain,
    title: 'AI Automation & Optimisation',
    description:
      'Automated bidding rules, budget recommendations, creative fatigue detection, and keyword analysis — powered by AI.',
    highlights: ['Automated rules engine', 'Budget recommendations', 'Creative fatigue alerts'],
  },
];

const steps = [
  {
    icon: Building2,
    title: 'Create your organisation',
    description: 'Set up your workspace and invite your team in seconds.',
  },
  {
    icon: Plug,
    title: 'Connect your platforms',
    description: 'Link Meta, Apple, Moloco, AppsFlyer, and more with API keys.',
  },
  {
    icon: Settings2,
    title: 'Define conversion events',
    description: 'Map your funnel events so every metric is tracked consistently.',
  },
  {
    icon: TrendingUp,
    title: 'Track, launch & optimise',
    description: 'Start running ads, monitoring performance, and letting AI do the heavy lifting.',
  },
];

const stats = [
  { value: '9+', label: 'Platforms tracked', icon: Globe },
  { value: 'AI', label: 'Powered automation', icon: Zap },
  { value: '∞', label: 'Multi-tenant ready', icon: Users },
  { value: '100%', label: 'Data ownership', icon: Shield },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src={gosLogo} alt="GrowthOS" className="h-8 w-8 rounded-lg" />
            <span className="text-xl font-bold gradient-text">GrowthOS</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-semibold uppercase tracking-wider border-primary/40 text-primary">Beta</Badge>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/docs">Docs</Link>
            </Button>
            {user ? (
              <Button asChild size="sm">
                <Link to="/home">Go to Dashboard <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/auth">Sign In</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/auth">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
        <img src={heroImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-[0.35] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/40 to-background pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
        <div className="relative mx-auto max-w-4xl text-center px-6">
          <Badge variant="secondary" className="mb-6 text-xs font-medium tracking-wide">
            🚀 Now in Beta — the all-in-one growth platform
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
            Grow smarter,{' '}
            <span className="gradient-text">not harder</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Track every channel, launch ads across platforms, and let AI optimise your spend — all from a single dashboard.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="px-8 text-base shadow-glow">
              <Link to="/auth">
                Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="px-8 text-base">
              <a href="mailto:hello@growthOS.app">Book a Demo</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Integrations bar */}
      <section className="border-y border-border bg-muted/50 py-8">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-center text-xs font-medium text-muted-foreground uppercase tracking-widest mb-5">
            Integrates with your stack
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {integrations.map((name) => (
              <span
                key={name}
                className="text-sm font-medium text-muted-foreground/80 hover:text-foreground transition-colors"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* USP Feature Cards */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to scale</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Three pillars that replace a dozen tools — unified tracking, cross-platform ad management, and AI-driven optimisation.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f) => (
              <Card key={f.title} className="relative overflow-hidden group hover:shadow-glow transition-shadow duration-300">
                <CardContent className="p-8">
                  <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center mb-6">
                    <f.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-5">{f.description}</p>
                  <ul className="space-y-2">
                    {f.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-2 text-sm text-foreground/80">
                        <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 md:py-28 bg-muted/40">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Up and running in 4 steps</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              From zero to full-stack growth analytics in minutes, not months.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <div key={s.title} className="text-center">
                <div className="mx-auto h-14 w-14 rounded-full border-2 border-primary/30 bg-primary/10 flex items-center justify-center mb-4">
                  <span className="text-lg font-bold text-primary">{i + 1}</span>
                </div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <s.icon className="h-6 w-6 mx-auto mb-3 text-primary" />
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="rounded-2xl gradient-primary p-12 md:p-16 shadow-glow">
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
              Ready to grow?
            </h2>
            <p className="text-primary-foreground/80 text-lg mb-8 max-w-md mx-auto">
              Join teams already using GrowthOS to track, launch, and optimise their growth.
            </p>
            <Button
              size="lg"
              variant="secondary"
              asChild
              className="px-10 text-base font-semibold"
            >
              <Link to="/auth">Start Free <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="font-semibold gradient-text">GrowthOS</span>
            <Link to="/docs" className="hover:text-foreground transition-colors">Docs</Link>
          </div>
          <span>© {new Date().getFullYear()} GrowthOS by Yasin Kheradmand. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
