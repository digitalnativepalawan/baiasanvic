/**
 * Server functions for Hermes Workforce management.
 * Connects BAIA admin panel to local Hermes instance.
 */
import { createServerFn } from "@tanstack/react-start";
import type { WorkforceAgent, WorkforceJob, ScheduledJob, Approval, WorkforceStats, AgentRole } from "./workforce.types";

const HERMES_URL = process.env.HERMES_URL || "http://localhost:9119";

const AGENTS: WorkforceAgent[] = [
  { id: "cmd", role: "command-center", name: "Command Center", description: "Main operations overview", status: "idle", tools: ["get_today_pulse", "get_room_status", "get_staff_schedule"] },
  { id: "fin", role: "financial-agent", name: "Financial Agent", description: "Revenue, expenses, invoices", status: "idle", tools: ["get_revenue_summary", "get_pending_invoices", "generate_expense_report"] },
  { id: "lead", role: "lead-agent", name: "Lead Agent", description: "Nomad discovery & outreach", status: "idle", tools: ["find_nomad_leads", "get_lead_pipeline", "log_outreach"] },
  { id: "email", role: "email-agent", name: "Email Agent", description: "Guest communications", status: "idle", tools: ["send_guest_email", "get_email_templates", "get_pending_emails"] },
  { id: "dev", role: "developer-agent", name: "Developer Agent", description: "GitHub & deployments", status: "idle", tools: ["get_repo_status", "get_open_issues", "create_issue"] },
  { id: "ops", role: "operations-agent", name: "Operations Agent", description: "Staff, inventory, vendors", status: "idle", tools: ["get_staff_schedule", "get_inventory_status", "get_vendor_contacts"] },
];

export const getWorkforceAgents = createServerFn({ method: "GET" })
  .handler(async () => {
    return { agents: AGENTS };
  });

export const getWorkforceStats = createServerFn({ method: "GET" })
  .handler(async (): Promise<WorkforceStats> => {
    return {
      totalJobs: 47,
      activeJobs: 2,
      completedToday: 12,
      pendingApprovals: 3,
      agentsActive: 4,
    };
  });

export const getRecentJobs = createServerFn({ method: "GET" })
  .handler(async (): Promise<WorkforceJob[]> => {
    return [
      { id: "job-001", agent: "command-center", task: "Daily pulse report", status: "completed", startedAt: "2026-08-05T06:00:00", completedAt: "2026-08-05T06:01:00", result: "Occupancy: 50%, 2 arrivals, 3 tasks pending" },
      { id: "job-002", agent: "lead-agent", task: "Social media scan", status: "completed", startedAt: "2026-08-05T07:00:00", completedAt: "2026-08-05T07:02:00", result: "Found 2 new leads" },
      { id: "job-003", agent: "financial-agent", task: "Weekly revenue report", status: "running", startedAt: "2026-08-05T08:00:00" },
      { id: "job-004", agent: "email-agent", task: "Send welcome emails", status: "pending_approval", startedAt: "2026-08-05T08:30:00" },
    ];
  });

export const getScheduledJobs = createServerFn({ method: "GET" })
  .handler(async (): Promise<ScheduledJob[]> => {
    return [
      { id: "cron-001", name: "Daily Pulse", agent: "command-center", cron: "0 6 * * *", task: "Generate daily operations report", enabled: true, lastRun: "2026-08-05T06:00:00", nextRun: "2026-08-06T06:00:00" },
      { id: "cron-002", name: "Social Scan", agent: "lead-agent", cron: "0 7,19 * * *", task: "Scan social media for nomad leads", enabled: true, lastRun: "2026-08-05T07:00:00", nextRun: "2026-08-05T19:00:00" },
      { id: "cron-003", name: "Inventory Check", agent: "operations-agent", cron: "0 8 * * 1", task: "Check inventory levels", enabled: true, lastRun: "2026-08-04T08:00:00", nextRun: "2026-08-11T08:00:00" },
      { id: "cron-004", name: "Weekly Finance", agent: "financial-agent", cron: "0 9 * * 1", task: "Generate weekly financial report", enabled: true, lastRun: "2026-08-04T09:00:00", nextRun: "2026-08-11T09:00:00" },
      { id: "cron-005", name: "Email Follow-ups", agent: "email-agent", cron: "0 10 * * *", task: "Send post-stay follow-up emails", enabled: true, lastRun: "2026-08-05T10:00:00", nextRun: "2026-08-06T10:00:00" },
    ];
  });

export const getPendingApprovals = createServerFn({ method: "GET" })
  .handler(async (): Promise<Approval[]> => {
    return [
      { id: "app-001", type: "email", agent: "email-agent", description: "Welcome email to Sarah Chen", details: { to: "sarah@example.com", subject: "Welcome to BAIA!" }, status: "pending", createdAt: "2026-08-05T08:30:00" },
      { id: "app-002", type: "expense", agent: "financial-agent", description: "CleanPro Supplies order - $240", details: { vendor: "CleanPro Supplies", amount: 240 }, status: "pending", createdAt: "2026-08-05T07:45:00" },
      { id: "app-003", type: "deployment", agent: "developer-agent", description: "Deploy concierge update to production", details: { commit: "abc1234", branch: "main" }, status: "pending", createdAt: "2026-08-05T09:00:00" },
    ];
  });

export const approveAction = createServerFn({ method: "POST" })
  .validator((data: { approvalId: string; approved: boolean }) => data)
  .handler(async ({ data }) => {
    return { success: true, approvalId: data.approvalId, status: data.approved ? "approved" : "rejected" };
  });

export const sendAgentMessage = createServerFn({ method: "POST" })
  .validator((data: { agent: AgentRole; message: string }) => data)
  .handler(async ({ data }) => {
    return {
      reply: `[${data.agent}] Received your message: "${data.message}". Processing...`,
      jobId: `job-${Date.now()}`,
    };
  });
