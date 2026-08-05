import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity, DollarSign, Users, Mail, Code, Settings,
  Send, Check, X, Clock, Zap, Bot, PlayCircle, PauseCircle,
  AlertCircle, CheckCircle2, XCircle, RefreshCw
} from "lucide-react";

const AGENTS = [
  { id: "cmd", role: "command-center", name: "Command Center", icon: Activity, color: "text-blue-500", description: "Main operations overview" },
  { id: "fin", role: "financial-agent", name: "Financial Agent", icon: DollarSign, color: "text-green-500", description: "Revenue & expenses" },
  { id: "lead", role: "lead-agent", name: "Lead Agent", icon: Users, color: "text-purple-500", description: "Nomad discovery" },
  { id: "email", role: "email-agent", name: "Email Agent", icon: Mail, color: "text-orange-500", description: "Guest communications" },
  { id: "dev", role: "developer-agent", name: "Developer Agent", icon: Code, color: "text-cyan-500", description: "GitHub & deployments" },
  { id: "ops", role: "operations-agent", name: "Operations Agent", icon: Settings, color: "text-yellow-500", description: "Staff & inventory" },
];

const MOCK_JOBS = [
  { id: "job-001", agent: "Command Center", task: "Daily pulse report", status: "completed", time: "6:00 AM", result: "Occupancy: 50%, 2 arrivals" },
  { id: "job-002", agent: "Lead Agent", task: "Social media scan", status: "completed", time: "7:00 AM", result: "Found 2 new leads" },
  { id: "job-003", agent: "Financial Agent", task: "Weekly revenue report", status: "running", time: "8:00 AM" },
  { id: "job-004", agent: "Email Agent", task: "Welcome emails", status: "pending_approval", time: "8:30 AM" },
];

const MOCK_SCHEDULED = [
  { name: "Daily Pulse", cron: "6:00 AM daily", agent: "Command Center", enabled: true },
  { name: "Social Scan", cron: "7:00 AM & 7:00 PM", agent: "Lead Agent", enabled: true },
  { name: "Inventory Check", cron: "Monday 8:00 AM", agent: "Operations", enabled: true },
  { name: "Weekly Finance", cron: "Monday 9:00 AM", agent: "Financial", enabled: true },
  { name: "Email Follow-ups", cron: "10:00 AM daily", agent: "Email Agent", enabled: true },
];

const MOCK_APPROVALS = [
  { id: "app-001", type: "email", agent: "Email Agent", description: "Welcome email to Sarah Chen", status: "pending" },
  { id: "app-002", type: "expense", agent: "Financial Agent", description: "CleanPro order - $240", status: "pending" },
  { id: "app-003", type: "deployment", agent: "Developer Agent", description: "Deploy concierge update", status: "pending" },
];

const STATUS_COLORS = {
  completed: "bg-green-500/10 text-green-500",
  running: "bg-blue-500/10 text-blue-500",
  pending_approval: "bg-yellow-500/10 text-yellow-500",
  failed: "bg-red-500/10 text-red-500",
};

export function WorkforcePanel() {
  const [chatMessage, setChatMessage] = useState("");
  const [chatLog, setChatLog] = useState<Array<{ role: string; msg: string }>>([
    { role: "system", msg: "Hermes Workforce ready. Select an agent or type a command." },
  ]);

  const handleSend = () => {
    if (!chatMessage.trim()) return;
    setChatLog((prev) => [...prev, { role: "user", msg: chatMessage }]);
    setTimeout(() => {
      setChatLog((prev) => [...prev, { role: "agent", msg: `Processing: "${chatMessage}"... Task assigned to Command Center.` }]);
    }, 500);
    setChatMessage("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" /> Hermes Workforce
          </h2>
          <p className="text-muted-foreground">AI agents managing your resort</p>
        </div>
        <Badge variant="outline" className="gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Hermes Connected
        </Badge>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          return (
            <Card key={agent.id} className="cursor-pointer hover:border-primary transition-colors">
              <CardContent className="p-3 text-center">
                <Icon className={`h-6 w-6 mx-auto mb-2 ${agent.color}`} />
                <p className="text-xs font-medium">{agent.name}</p>
                <p className="text-[10px] text-muted-foreground">{agent.description}</p>
                <Badge variant="secondary" className="mt-2 text-[10px]">Idle</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="chat">
        <TabsList>
          <TabsTrigger value="chat">Talk to Hermes</TabsTrigger>
          <TabsTrigger value="jobs">Active Jobs</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Talk to Hermes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 overflow-y-auto border rounded-md p-3 mb-3 bg-muted/30">
                {chatLog.map((entry, i) => (
                  <div key={i} className={`mb-2 text-sm ${entry.role === "user" ? "text-right" : ""}`}>
                    <span className={`inline-block rounded px-2 py-1 ${
                      entry.role === "user" ? "bg-primary text-primary-foreground" :
                      entry.role === "agent" ? "bg-green-500/10 text-green-700" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {entry.msg}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask Hermes anything about the resort..."
                />
                <Button onClick={handleSend} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" /> Active Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {MOCK_JOBS.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-2 border rounded-md">
                    <div className="flex items-center gap-3">
                      {job.status === "completed" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {job.status === "running" && <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />}
                      {job.status === "pending_approval" && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                      <div>
                        <p className="text-sm font-medium">{job.task}</p>
                        <p className="text-xs text-muted-foreground">{job.agent} · {job.time}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className={STATUS_COLORS[job.status as keyof typeof STATUS_COLORS]}>
                      {job.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" /> Scheduled Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {MOCK_SCHEDULED.map((job, i) => (
                  <div key={i} className="flex items-center justify-between p-2 border rounded-md">
                    <div className="flex items-center gap-3">
                      {job.enabled ? <PlayCircle className="h-4 w-4 text-green-500" /> : <PauseCircle className="h-4 w-4 text-muted-foreground" />}
                      <div>
                        <p className="text-sm font-medium">{job.name}</p>
                        <p className="text-xs text-muted-foreground">{job.cron} · {job.agent}</p>
                      </div>
                    </div>
                    <Badge variant={job.enabled ? "default" : "secondary"}>
                      {job.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Pending Approvals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {MOCK_APPROVALS.map((approval) => (
                  <div key={approval.id} className="flex items-center justify-between p-2 border rounded-md">
                    <div>
                      <p className="text-sm font-medium">{approval.description}</p>
                      <p className="text-xs text-muted-foreground">{approval.agent} · {approval.type}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7">
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Agent Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 overflow-y-auto font-mono text-xs bg-muted/30 rounded-md p-3">
                <p className="text-green-600">[06:00] Command Center: Daily pulse generated</p>
                <p className="text-green-600">[07:00] Lead Agent: Social scan complete - 2 leads found</p>
                <p className="text-blue-600">[08:00] Financial Agent: Weekly report in progress...</p>
                <p className="text-yellow-600">[08:30] Email Agent: Welcome emails queued for approval</p>
                <p className="text-green-600">[09:00] Operations Agent: Inventory check complete</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
