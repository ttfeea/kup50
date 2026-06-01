🧠 System Overview

KUP50_app is an internal enterprise work activity reporting system.

It aggregates developer activity from external tools and manual input, normalizes it into a unified structure, and generates monthly reports.

Tech Stack
NestJS (backend)
Prisma ORM
PostgreSQL
JWT authentication
React (planned frontend)
🎯 Core Concept

The system is built around a single abstraction:

WorkItem = unified representation of all developer activity

Everything in the system must be converted into WorkItems before being used in reports.

🧱 Unified Data Model (CRITICAL)
WorkItem (CANONICAL MODEL)

All external and manual data must be normalized into this structure:

id
source: GITHUB | GITLAB | JIRA | MANUAL
type: COMMIT | PR | MR | ISSUE | TASK | NOTE
title
url (optional)
createdAt
updatedAt
metadata (JSON, provider-specific raw data)
Rules:
WorkItem is the ONLY valid business model for work data
All integrations MUST map into WorkItem
No feature should depend directly on provider-specific types (GitHubIssue, GitLabMR, etc.)
👤 USER

Represents an employee.

Fields:
id
email
password (MVP only)
fullname
position
department
managerName
role (employee | manager)
createdAt
Relations:
has many Reports
📊 REPORT

Represents a monthly snapshot of work activity.

Fields:
id
periodStart
periodEnd
status (DRAFT | SUBMITTED)
userId
createdAt
updatedAt
Rules:
Report contains SNAPSHOTS of WorkItems
Reports must NOT fetch live external data after creation
Reports are static once generated
📦 REPORT_ITEM (LEGACY / COMPATIBILITY ONLY)

⚠️ This model exists only for backward compatibility.

Purpose:
persists WorkItems inside a report snapshot
Rules:
DO NOT extend this model
DO NOT base new logic on it
It is being phased out conceptually in favor of WorkItem
🔁 BUSINESS FLOW (CURRENT SYSTEM)
1. Authentication
User logs in using JWT
2. Report Creation
Backend creates a new Report
Automatically sets periodStart and periodEnd
3. WorkItem Collection

System collects WorkItems from:

GitHub (events, commits, PRs)
GitLab (events, commits, MRs, issues)
Jira (issues/tasks)
Manual user input
4. Normalization
All external data is converted into WorkItem format
5. Selection
User selects WorkItems for the report
6. Snapshot Creation
Selected WorkItems are saved into ReportItems (DB snapshot)
7. Report Finalization
Report is submitted/exported (Excel replacement)
🔌 INTEGRATION SYSTEM
Purpose

Connect external services to fetch WorkItems.

Providers:
GitHub
GitLab
Jira
Responsibilities:
Store tokens per user
Validate tokens
Fetch external activity
Convert to WorkItem format
Future Requirement:
Must support commits + events (not just PRs/issues)
✍️ MANUAL WORK ITEMS

Users can manually create WorkItems.

Rules:
Treated exactly like integration WorkItems
Must follow WorkItem schema
Can be added during report creation
⚠️ CURRENT SYSTEM STATE
Backend is mid-refactor
Schema is evolving toward WorkItem model
Some legacy ReportItem logic still exists
Integration layer is partially implemented
Some DTOs may still reference old structures
🚨 CRITICAL DEVELOPMENT RULES
1. Prisma is source of truth
Schema defines system structure
Always migrate after changes
2. WorkItem is the ONLY valid business model
No provider-specific logic in business services
No GitHub/GitLab/Jira types in core logic
3. Reports are snapshots only
No live API calls when viewing reports
4. Stability first

Before adding features:

npm run build must pass
Prisma must be valid
No TypeScript errors allowed
🔐 AUTH SYSTEM
JWT-based authentication
MVP uses email + password login
Future upgrades may include SSO
🚀 DEVELOPMENT PRIORITY
Stabilize backend
Fully align schema with WorkItem model
Expand integrations (commits + events)
Implement manual WorkItems
Improve report generation flow
Build frontend dashboard
Add automation / AI features