/**
 * Hermes Workforce types
 */

export type AgentRole =
  | "command-center"
  | "financial-agent"
  | "lead-agent"
  | "email-agent"
  | "developer-agent"
  | "operations-agent";

export interface WorkforceAgent {
  id: string;
  role: AgentRole;
  name: string;
  description: string;
  status: "active" | "idle" | "error";
  lastActivity?: string;
  tools: string[];
}

export interface WorkforceJob {
  id: string;
  agent: AgentRole;
  task: string;
  status: "running" | "completed" | "failed" | "pending_approval";
  startedAt: string;
  completedAt?: string;
  result?: string;
}

export interface ScheduledJob {
  id: string;
  name: string;
  agent: AgentRole;
  cron: string;
  task: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export interface Approval {
  id: string;
  type: "email" | "expense" | "deployment" | "code_change";
  agent: AgentRole;
  description: string;
  details: Record<string, string | number | boolean | null>;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface WorkforceStats {
  totalJobs: number;
  activeJobs: number;
  completedToday: number;
  pendingApprovals: number;
  agentsActive: number;
}
