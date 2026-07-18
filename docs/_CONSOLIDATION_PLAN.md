# Root Markdown Consolidation Plan

All 53 `*.md` files currently in the repo root, grouped KEEP vs ARCHIVE. Use this to
`git mv` the ARCHIVE set into `docs/archive/`. Nothing is deleted; content worth keeping has
already been consolidated into `README.md`, `AGENTS.md`, `docs/DEPLOYMENT.md`,
`docs/FEATURES.md`, and `docs/ARCHITECTURE.md`.

## KEEP (repo root)

| File | Reason |
|---|---|
| `README.md` | Project front door / entry point. |
| `CHANGELOG.md` | Live, accurate change history (2.1.0 WhatsApp-version + reconnect fixes). |
| `CLAUDE.md` | Maintained agent operating guide — authoritative. |
| `AGENTS.md` | New consolidated AI-agent guide (created in this pass). |

Also produced (live under `docs/`, not root): `docs/DEPLOYMENT.md`, `docs/FEATURES.md`,
`docs/ARCHITECTURE.md`.

## ARCHIVE (→ `docs/archive/`)

| File | Reason |
|---|---|
| `ADVANCED_FEATURES_GUIDE.md` | Feature content folded into `docs/FEATURES.md`. |
| `API_TESTING.md` | Ad-hoc test notes; superseded by Swagger + code. |
| `AUTOMATION_GUIDE.md` | Automation features folded into `docs/FEATURES.md`. |
| `AUTO_REPLY_SYSTEM.md` | Auto-reply behavior folded into `docs/FEATURES.md` + `AGENTS.md`. |
| `COMPARISON.md` | PHP-vs-Node marketing comparison; not operational. |
| `COMPLETION_SUMMARY.md` | Stale "done" status snapshot. |
| `DATABASE_MIGRATION_GUIDE.md` | Migration steps folded into `docs/DEPLOYMENT.md`. |
| `DEBUGGING_STATUS.md` | Point-in-time debugging log; stale. |
| `DEPLOYMENT_FIXES_SUMMARY.md` | One-off fix log; superseded by `docs/DEPLOYMENT.md`. |
| `DEPLOYMENT_FIX_GUIDE.md` | One-off fix guide; superseded by `docs/DEPLOYMENT.md`. |
| `DEPLOYMENT_GUIDE.md` | Consolidated into `docs/DEPLOYMENT.md`. |
| `DEPLOYMENT_README.md` | Duplicate deploy overview; consolidated. |
| `DEPLOYMENT_READY.md` | Stale "ready to deploy" status snapshot. |
| `DEPLOYMENT_WORKFLOW.md` | Deploy workflow folded into `docs/DEPLOYMENT.md`. |
| `DEPLOY_CRITICAL_FIXES.md` | One-off fix log; key facts (e.g. `-h 127.0.0.1`) captured in `docs/DEPLOYMENT.md`. |
| `DEPLOY_INSTRUCTIONS.md` | Duplicate deploy instructions; consolidated. |
| `DEPLOY_NAVBAR_SYNC.md` | Narrow one-off deploy note; stale. |
| `DEPLOY_QUICK.md` | Quick-deploy variant; consolidated. |
| `DOCKER_SETUP.md` | Docker path summarized in `docs/DEPLOYMENT.md`. |
| `FEATURES.md` | Superseded by `docs/FEATURES.md` (ground-truthed). |
| `FEATURE_ENHANCEMENT_PLAN.md` | Roadmap/aspirational; captured as "Roadmap" in `docs/FEATURES.md`. |
| `FIX_NEWSLETTER_SUPPORT.md` | One-off fix note; behavior lives in code. |
| `FIX_SUMMARY.md` | Stale fix log. |
| `FRONTEND_COMPLETION.md` | Stale "complete" status snapshot. |
| `FRONTEND_QUICKSTART.md` | Frontend build/run folded into `AGENTS.md` + `README.md`. |
| `FRONTEND_UI_COMPLETE.md` | Stale "UI complete" status snapshot. |
| `FULL_IMPLEMENTATION_STATUS.md` | Self-described "40% complete"; stale status. |
| `IMPLEMENTATION_GUIDE.md` | Superseded by `docs/FEATURES.md` + `docs/ARCHITECTURE.md`. |
| `IMPLEMENTATION_PLAN.md` | Planning doc; historical. |
| `IMPLEMENTATION_PROGRESS.md` | Point-in-time progress log; stale. |
| `IMPLEMENTATION_STATUS.md` | Point-in-time status; stale. |
| `INVOICING_SYSTEM_GUIDE.md` | Invoicing feature folded into `docs/FEATURES.md`. |
| `ISSUES_FIXED.md` | Historical fix log; superseded by `CHANGELOG.md`. |
| `MEDIA_REACTION_FIXES_SUMMARY.md` | One-off fix log; stale. |
| `MIGRATION_COMPLETE.md` | Stale PHP→Node migration status snapshot. |
| `MIGRATION_SUMMARY.md` | Historical migration summary. |
| `MULTIMEDIA_FEATURES.md` | Media features folded into `docs/FEATURES.md`. |
| `QUICK_DEPLOYMENT_GUIDE.md` | Consolidated into `docs/DEPLOYMENT.md`. |
| `QUICK_FIXES_SUMMARY.md` | Stale fix log. |
| `QUICK_START.md` | Quick-start folded into `README.md` / `AGENTS.md`. |
| `REAL_WORLD_TESTING.md` | Ad-hoc testing notes; historical. |
| `SERVER_DEPLOYMENT.md` | Consolidated into `docs/DEPLOYMENT.md`. |
| `SHOP_ENHANCEMENT_PLAN.md` | Shelved shop-system roadmap; noted in `docs/FEATURES.md`. |
| `SHOP_SYSTEM_IMPLEMENTATION.md` | Shelved shop system (`*.bak` routes); historical. |
| `SHOP_SYSTEM_INTEGRATION.md` | Shelved shop system; historical. |
| `SHOP_SYSTEM_READY.md` | Shelved shop system "ready" snapshot; not wired. |
| `TESTING_GUIDE.md` | Testing guidance; superseded by code + `npm test`. |
| `UI_UX_ENHANCEMENTS.md` | UI enhancement notes/roadmap; historical. |
| `WHATSAPP_WEB_GUIDE.md` | WhatsApp Web QR flow folded into `docs/FEATURES.md` + `AGENTS.md`. |
| `WHATS_MISSING.md` | Roadmap/gap analysis; captured as "Roadmap" in `docs/FEATURES.md`. |
</content>
