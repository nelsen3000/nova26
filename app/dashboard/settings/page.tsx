'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTheme } from 'next-themes';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';

// ──────────────────────────────────────
// Profile tab
// ──────────────────────────────────────
function ProfileTab() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your personal account information.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" placeholder="John" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" placeholder="Doe" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="john@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" placeholder="Tell us about yourself..." rows={3} />
        </div>
        <Button onClick={handleSave} className="gap-2">
          {saved && <Check className="h-4 w-4" />}
          {saved ? 'Saved!' : 'Save changes'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────
// Appearance tab
// ──────────────────────────────────────
function AppearanceTab() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Customize how Nova26 looks on your device.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Theme</Label>
          <div className="grid grid-cols-3 gap-3">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-sm font-medium capitalize transition-colors ${
                  theme === t
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div
                  className={`h-10 w-full rounded-md border ${
                    t === 'dark'
                      ? 'bg-slate-900'
                      : t === 'light'
                      ? 'bg-white'
                      : 'bg-gradient-to-r from-white to-slate-900'
                  }`}
                />
                {t}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <Label>Display</Label>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Compact mode</p>
              <p className="text-xs text-muted-foreground">Reduce padding and font sizes</p>
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Animations</p>
              <p className="text-xs text-muted-foreground">Enable transition animations</p>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────
// API Keys tab
// ──────────────────────────────────────
function ApiKeysTab() {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const keys = [
    { id: 'anthropic', label: 'Anthropic API Key', placeholder: 'sk-ant-api03-...' },
    { id: 'openai', label: 'OpenAI API Key', placeholder: 'sk-...' },
    { id: 'convex', label: 'Convex Deploy Key', placeholder: 'prod:...' },
  ];

  const copyKey = (id: string) => {
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Keys</CardTitle>
        <CardDescription>
          Manage API keys used by Nova26 agents. Keys are stored encrypted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {keys.map((key) => (
          <div key={key.id} className="space-y-2">
            <Label htmlFor={key.id}>{key.label}</Label>
            <div className="flex gap-2">
              <Input
                id={key.id}
                type={revealed[key.id] ? 'text' : 'password'}
                placeholder={key.placeholder}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setRevealed((r) => ({ ...r, [key.id]: !r[key.id] }))}
              >
                {revealed[key.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={() => copyKey(key.id)}>
                {copied === key.id ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ))}
        <Button>Save API Keys</Button>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────
// Notifications tab
// ──────────────────────────────────────
function NotificationsTab() {
  const notifications = [
    { id: 'build_complete', label: 'Build complete', description: 'When a build finishes' },
    { id: 'build_fail', label: 'Build failed', description: 'When a build fails with errors' },
    { id: 'agent_error', label: 'Agent errors', description: 'When an agent gate fails' },
    { id: 'weekly_digest', label: 'Weekly digest', description: 'Summary of activity' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Choose what you want to be notified about.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notifications.map((n, i) => (
          <div key={n.id}>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{n.label}</p>
                <p className="text-xs text-muted-foreground">{n.description}</p>
              </div>
              <Switch defaultChecked={i < 2} />
            </div>
            {i < notifications.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}
        <Button>Save preferences</Button>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────
// Billing tab
// ──────────────────────────────────────
function BillingTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>Manage your subscription and usage.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current plan */}
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold">Pro Plan</p>
              <Badge>Active</Badge>
            </div>
            <p className="text-sm text-muted-foreground">$25/month · Unlimited builds</p>
          </div>
          <Button variant="outline">Manage</Button>
        </div>

        <Separator />

        {/* Usage */}
        <div className="space-y-3">
          <Label>Usage this month</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Builds', used: 14, limit: '∞' },
              { label: 'API calls', used: '4.2k', limit: '∞' },
              { label: 'Storage', used: '1.2 GB', limit: '10 GB' },
            ].map((u) => (
              <div key={u.label} className="rounded-lg border border-border p-3 text-center">
                <p className="text-lg font-bold">{u.used}</p>
                <p className="text-xs text-muted-foreground">
                  {u.label} / {u.limit}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────
// Page
// ──────────────────────────────────────
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account, appearance, and integrations.
        </p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-5 sm:w-auto sm:grid-cols-none sm:flex">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>
        <div className="mt-6">
          <TabsContent value="profile">
            <ProfileTab />
          </TabsContent>
          <TabsContent value="appearance">
            <AppearanceTab />
          </TabsContent>
          <TabsContent value="api-keys">
            <ApiKeysTab />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationsTab />
          </TabsContent>
          <TabsContent value="billing">
            <BillingTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
