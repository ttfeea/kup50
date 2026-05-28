# KUP50_app — Project Context

## 🧠 Overview

KUP50_app is an internal enterprise backend system designed to generate monthly employee activity reports based on development work tracked in external tools such as Jira and GitLab.

The system is being built as a REST API using:

- NestJS (backend framework)
- Prisma ORM
- PostgreSQL database
- JWT authentication

The long-term goal is to support a web frontend (React) and eventually replace manual Excel-based reporting with automated, database-driven reports.

---

## 🎯 Core Purpose

The application generates structured “creative work reports” for employees based on:

- Jira issues
- GitLab merge requests / commits

Reports should be:
- minimally manual (low user effort)
- generated quickly
- based on pre-connected integrations
- stored for future reference and export (Excel replacement)

---

## 🏗️ Current Architecture

### USER

Represents an employee in the system.

Fields:
- id
- email
- password (temporary MVP, may be replaced later with SSO or external auth)
- fullname
- position
- department
- managerName
- role (employee / manager)
- createdAt

Relations:
- has many Reports

---

### REPORT

Represents a monthly reporting container.

Fields:
- id
- periodStart (auto-generated)
- periodEnd (auto-generated)
- status (DRAFT | SUBMITTED)
- userId (FK → User)
- createdAt
- updatedAt

Relations:
- belongs to User
- has many ReportItems

⚠️ IMPORTANT:
Employee profile data DOES NOT belong in Report anymore.

Removed legacy fields:
- employeeName
- position
- department
- managerName

---

### REPORT_ITEM

Represents a single unit of work imported from external systems.

Fields:
- id
- reportId (FK → Report)
- source (JIRA | GITLAB)
- externalId
- title
- url (optional)
- type (optional)
- metadata (JSON)
- createdAt
- updatedAt

Purpose:
- normalized representation of Jira/GitLab work items

---

## 🔁 Current Business Flow

1. User logs in (JWT authentication)
2. User creates a Report (backend auto-calculates periodStart/periodEnd)
3. System connects to Jira/GitLab (future feature, partially implemented)
4. Work items are fetched (Jira issues, GitLab MRs/commits)
5. User selects relevant items
6. Selected items are stored as ReportItems
7. Report is submitted/exported later (Excel replacement)

---

## ⚠️ Current Project State

### Backend status:
- Mid-refactor phase
- Prisma schema has been heavily updated
- Some TypeScript mismatches may still exist
- Legacy fields may still appear in older service logic (must be removed)

### Known risks:
- schema/code mismatch during refactors
- outdated DTOs referencing removed fields
- Prisma client regeneration issues if schema changes are incomplete

---

## 🚨 Important Rules for Development

### 1. Schema consistency is critical
- Prisma schema is the source of truth
- Every schema change MUST be followed by migration

### 2. No duplicate employee data in Report
- Employee profile data belongs ONLY in User
- Report should reference User only

### 3. ReportItems are the canonical work structure
- creativeWorkItems JSON is legacy and should NOT be used for logic

### 4. Keep backend stable before adding features
- No new features unless build is clean
- Always ensure:
  - `npm run build` passes
  - no TypeScript errors
  - Prisma client is in sync

---

## 🔐 Authentication Model

- JWT-based authentication
- Temporary password-based login (MVP stage)
- Future improvements may include:
  - SSO integration
  - company-provided user provisioning
  - reduced password dependency

---

## 🔌 Future Feature Direction (NOT IMPLEMENTED YET)

### Integration Layer (next planned phase)

Goal:
Persist Jira and GitLab access so users do NOT need to reconnect every session.

Planned concept:
- IntegrationToken model
- stored per user
- provider: JIRA / GITLAB
- secure token storage
- persistent connection

---

### Report Automation (later phase)

- automatic fetching of Jira/GitLab data
- one-click report generation
- AI-assisted classification (optional future feature)

---

### Frontend (future)

- React-based dashboard
- report builder UI
- integration settings page
- employee profile management

---

## 🧭 Development Priority Order

1. Stabilize backend (fix all errors)
2. Ensure Prisma + TypeScript consistency
3. Implement IntegrationToken system
4. Improve report generation flow
5. Build frontend
6. Optional AI enhancements

---

## 💡 Key Philosophy

It is an internal enterprise reporting platform focused on:
- automation
- minimal user friction
- structured work tracking
- integration-driven data collection

Keep architecture clean, incremental, and stable.
