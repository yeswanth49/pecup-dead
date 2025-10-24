## Dashboard Issues (2025-09-19)

This document tracks current UX/data-loading issues observed on the dashboard and resources flows.

### Open issues
- [ ] Username flashes/loading while other components are ready on first load/reload
- [ ] Resource subject click fetches content immediately; entire page skeletons
- [ ] Subjects show full names instead of abbreviations (e.g., want "FLAT")
- [ ] Breadcrumb needs a Home link and consistent alignment across pages

---

### 1) Username shows loading while rest of page is ready
**Scope**: Greeting header in protected dashboard (e.g., `app/(protected)/home/page.tsx`).

**Repro**:
1. Hard reload the dashboard or first visit after cold start.
2. Notice the username placeholder/loading while other header content renders, causing a perceptual flicker.

**Expected**:
- Username renders instantly without a skeleton/flicker, or the skeleton is limited to the name text with no layout shift.

**Likely cause**:
- Name depends on an async profile/session fetch that is not hydrated early or not cached in a synchronous store (e.g., session/local cache), while other UI renders immediately.

**Suggested direction**:
- Hydrate username from a fast cache first (e.g., session or memory cache), then reconcile with server/bulk data.
- If a skeleton is unavoidable, constrain it to the name text and preserve layout to avoid jank.
- Audit `profile` context/hooks (`lib/enhanced-profile-context.tsx`, `lib/profile-context.tsx`, `lib/session-cache.ts`) for early-available name data.

---

### 2) Subject click triggers immediate heavy fetch; full-page skeleton
**Scope**: Resources/subjects pages when navigating into a subject.

**Repro**:
1. From resources list, click a subject.
2. The page appears to fetch all resource data at once and skeletons the entire page.

**Expected**:
- Only the resources list section shows skeletons for the resource names; header/breadcrumb/other chrome remain stable.
- Prefer incremental rendering: load lightweight metadata (names) first, lazily fetch heavy details.

**Suggested direction**:
- Split data fetch into: (a) subject metadata/names and (b) resource details.
- Keep previously loaded subject metadata in cache between navigations.
- Use component-level suspense/skeleton only for the resources list, not the entire page shell.

---

### 3) Abbreviations missing (e.g., shows full name instead of "FLAT")
**Scope**: Subject cards, headings, and breadcrumbs.

**Repro**:
1. Navigate to Formal Languages and Automata Theory.
2. UI shows full subject name instead of abbreviation (e.g., "FLAT").

**Expected**:
- Display subject abbreviations where appropriate (cards, headings, breadcrumbs). Fallback to full name if abbrev is unavailable.

**Suggested direction**:
- Ensure a canonical mapping exists (check `lib/academic-config.ts`, `lib/lookup-mappers.ts`, or similar) and is used consistently in UI.
- Add a small formatter utility to standardize subject display (abbrev > full name fallback).

---

### 4) Breadcrumb improvements (Home link + alignment)
**Scope**: Breadcrumb across pages (resources, notes, subject detail, etc.).

**Repro**:
1. Navigate through nested resources pages.
2. Breadcrumb is missing a Home entry (to dashboard) and shows alignment inconsistencies on some pages.

**Expected**:
- Breadcrumb begins with a Home item that routes to the dashboard.
- Consistent spacing, separators, and truncation across all pages.

**Suggested direction**:
- Add a leading Home crumb in the breadcrumb component and ensure it links to the protected dashboard route.
- Centralize breadcrumb rendering into a shared component if not already shared; audit usage sites for consistent props/styles.

---

### Notes
- Add follow-up tasks to implementation backlog to address each item.
- Validate across SSR/CSR transitions to avoid flicker and preserve layout stability.


