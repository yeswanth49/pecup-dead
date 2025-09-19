### Task 11: Update components to use bulk data instead of individual APIs

- **Objective**: Replace redundant API calls with `useProfile()` context data.

- **Targets**:
  - `app/(protected)/home/page.tsx`: use `dynamicData.recentUpdates`, `upcomingExams`, `upcomingReminders`.
  - `resources` pages: use `subjects` for filters and lists.
  - `profile` page: use `profile` for user details.

- **Implementation steps**:
  1. Import and call `useProfile()` in affected components.
  2. Remove fetchers to `/api/profile`, `/api/subjects`, `/api/recent-updates`, `/api/reminders` where redundant.
  3. Handle `loading` and `error` from context.

- **Validation criteria**:
  - No duplicate network calls; Network tab shows fewer requests.
  - UI renders correctly with context data.

- **Completion checklist**:
  - [ ] Home page migrated
  - [ ] Resource pages migrated
  - [ ] Profile page migrated
