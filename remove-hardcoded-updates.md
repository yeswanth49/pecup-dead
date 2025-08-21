# Remove Hardcoded Recent Updates

The dashboard is showing hardcoded sample entries because there are 5 test entries in the `recent_updates` table with `year: NULL` and `branch: NULL`. These appear for all users.

## Option 1: Use SQL Script (Recommended)

Run the SQL script to permanently delete these entries:

```bash
# If you have direct database access:
psql $DATABASE_URL -f scripts/remove-hardcoded-recent-updates.sql

# Or execute the SQL directly in your database client
```

## Option 2: Use Dev Dashboard (Manual)

1. Go to `/dev-dashboard` 
2. Navigate to the "Recent Updates" tab
3. Delete these 5 entries manually:
   - "SE Unit 1,2,3 Key Points File"
   - "DBMS Model Paper"
   - "DBMS Mid 2 Paper" 
   - "DBMS Notes Error Adjusted"
   - "DBMS Unit 5 Notes"

## Option 3: Use Supabase Dashboard

1. Go to your Supabase dashboard
2. Navigate to Table Editor > recent_updates
3. Delete the rows where `year` is `NULL` and `branch` is `NULL`

## The entries to delete:

| ID | Title | Year | Branch |
|----|-------|------|--------|
| 1c837c40-5e6a-4cec-bc36-d021c6e85e7b | SE Unit 1,2,3 Key Points File | NULL | NULL |
| 4e313cde-a302-4d65-9e90-4c33b240cf34 | DBMS Model Paper | NULL | NULL |
| cc13d4b2-8d3c-4822-bcd6-7afa19b20748 | DBMS Mid 2 Paper | NULL | NULL |
| d22b2208-285f-41c1-b3ac-d1d8ed9b093a | DBMS Notes Error Adjusted | NULL | NULL |
| de8084ab-b699-4ca9-8f01-5fe6cf1202dc | DBMS Unit 5 Notes | NULL | NULL |

After deletion, the dashboard will only show recent updates that have specific year and branch values, removing the hardcoded entries that appeared for all users.
