import { useState, useEffect, useCallback } from "react";
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

const DEFAULT_HERMES_URL = "http://127.0.0.1:8100";
const getHermesUrl = () => localStorage.getItem("hermes_url") || DEFAULT_HERMES_URL;
const setHermesUrl = (url: string) => localStorage.setItem("hermes_url", url);

const AGENT_ICONS: Record<string, typeof Activity> = {
  "command-center": Activity,
  "financial-agent": DollarSign,
  "lead-agent": Users,
  "email-agent": Mail,
  "developer-agent": Code,
  "operations-agent": Settings,
};

const AGENT_COLORS: Record<string, string> = {
  "command-center": "text-blue-500",
  "financial-agent": "text-green-500",
  "lead-agent": "text-purple-500",
  "email-agent": "text-orange-500",
  "developer-agent": "text-cyan-500",
  "operations-agent": "text-yellow-500",
};

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
  const [agents, setAgents] = useState<Array<{ id: string; role: string; name: string; status: string }>>([]);
  const [jobs, setJobs] = useState<Array<{ id: string; agent: string; task: string; status: string; time: string; result?: string }>>([]);
  const [scheduled, setScheduled] = useState<Array<{ name: string; cron: string; agent: string; enabled: boolean }>>([]);
  const [approvals, setApprovals] = useState<Array<{ id: string; type: string; agent: string; description: string; status: string }>>([]);
  const [logs, setLogs] = useState<Array<{ time: string; agent: string; message: string; level: string }>>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hermesUrl, setHermesUrlState] = useState(getHermesUrl());
  const [showSettings, setShowSettings] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const url = getHermesUrl();
      const [agentsRes, jobsRes, scheduledRes, approvalsRes, logsRes] = await Promise.all([
        fetch(`${url}/api/workforce/agents`),
        fetch(`${url}/api/workforce/jobs`),
        fetch(`${url}/api/workforce/scheduled`),
        fetch(`${url}/api/workforce/approvals`),
        fetch(`${url}/api/workforce/logs`),
      ]);
      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgents(data.agents || []);
        setConnected(true);
      }
      if (jobsRes.ok) setJobs((await jobsRes.json()).jobs || []);
      if (scheduledRes.ok) setScheduled((await scheduledRes.json()).scheduled || []);
      if (approvalsRes.ok) setApprovals((await approvalsRes.json()).approvals || []);
      if (logsRes.ok) setLogs((await logsRes.json()).logs || []);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSend = async () => {
    if (!chatMessage.trim()) return;
    const msg = chatMessage;
    setChatLog((prev) => [...prev, { role: "user", msg }]);
    setChatMessage("");
    try {
      const res = await fetch(`${getHermesUrl()}/api/workforce/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, session_id: "admin" }),
      });
      if (res.ok) {
        const data = await res.json();
        setChatLog((prev) => [...prev, { role: "agent", msg: data.reply }]);
      } else {
        setChatLog((prev) => [...prev, { role: "agent", msg: "Error: Could not reach Hermes server." }]);
      }
    } catch {
      setChatLog((prev) => [...prev, { role: "agent", msg: "Error: Hermes server not running. Start it with: python services/hermes/server.py" }]);
    }
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
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowSettings(!showSettings)} size="sm" variant="outline">
            <Settings className="h-4 w-4" />
          </Button>
          <Button onClick={fetchData} size="sm" variant="outline">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Badge variant="outline" className="gap-1">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
            {connected ? "Hermes Connected" : "Disconnected"}
          </Badge>
        </div>
      </div>

      {showSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Hermes Server Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={hermesUrl}
                onChange={(e) => setHermesUrlState(e.target.value)}
                placeholder="http://127.0.0.1:8100"
                className="flex-1"
              />
              <Button onClick={() => { setHermesUrl(hermesUrl); fetchData(); }} size="sm">
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Default: http://127.0.0.1:8100. Start server with: python services/hermes/server.py
            </p>
          </CardContent>
        </Card>
      )}

      {/* Agent Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {(agents.length > 0 ? agents : [
          { id: "cmd", role: "command-center", name: "Command Center", status: "idle" },
          { id: "fin", role: "financial-agent", name: "Financial Agent", status: "idle" },
          { id: "lead", role: "lead-agent", name: "Lead Agent", status: "idle" },
          { id: "email", role: "email-agent", name: "Email Agent", status: "idle" },
          { id: "dev", role: "developer-agent", name: "Developer Agent", status: "idle" },
          { id: "ops", role: "operations-agent", name: "Operations Agent", status: "idle" },
        ]).map((agent) => {
          const Icon = AGENT_ICONS[agent.role] || Activity;
          const color = AGENT_COLORS[agent.role] || "text-gray-500";
          return (
            <Card key={agent.id} className="cursor-pointer hover:border-primary transition-colors">
              <CardContent className="p-3 text-center">
                <Icon className={`h-6 w-6 mx-auto mb-2 ${color}`} />
                <p className="text-xs font-medium">{agent.name}</p>
                <Badge variant="secondary" className="mt-2 text-[10px]">{agent.status}</Badge>
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
                {jobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No active jobs</p>
                ) : jobs.map((job) => (
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
                {scheduled.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No scheduled jobs</p>
                ) : scheduled.map((job, i) => (
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
                {approvals.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No pending approvals</p>
                ) : approvals.map((approval) => (
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
                {logs.length === 0 ? (
                  <p className="text-muted-foreground">No logs yet</p>
                ) : logs.map((log, i) => (
                  <p key={i} className={
                    log.level === "error" ? "text-red-600" :
                    log.level === "warn" ? "text-yellow-600" :
                    "text-green-600"
                  }>
                    [{log.time}] {log.agent}: {log.message}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
