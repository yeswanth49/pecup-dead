### Task 03: Test bulk API with Postman/curl

- **Objective**: Verify the new endpoint returns expected data for authenticated users and enforces auth for unauthenticated users.

- **Pre-reqs**:
  - Local dev server running.
  - A valid session cookie or token for an authenticated user.

- **Steps (curl)**:
  1. Unauthenticated:
     - Run: `curl -i http://localhost:3000/api/bulk-academic-data`
     - Expect: `401 Unauthorized`.
  2. Authenticated:
     - Acquire session cookie via browser, or use a bearer token if supported.
     - Run with cookie: `curl -i --cookie "<cookie_here>" http://localhost:3000/api/bulk-academic-data`
     - Expect: `200 OK` and JSON with keys: `profile, subjects, static, dynamic, timestamp`.

- **Steps (Postman)**:
  - Create GET request to `/api/bulk-academic-data`.
  - Under Auth, use Cookie or OAuth2 as applicable.
  - Add Tests to assert status 200 and response keys.

- **Validation criteria**:
  - 401 without auth, 200 with auth.
  - JSON structure matches plan.

- **Completion checklist**:
  - [ ] Curl unauthenticated test passes
  - [ ] Curl authenticated test passes
  - [ ] Postman test asserts pass

- **Artifacts**:
  - Optional: Export Postman collection to `docs/fetch-fast/artifacts/bulk-api.postman_collection.json`.
