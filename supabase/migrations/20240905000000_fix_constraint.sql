DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'semesters'
  ) THEN
    ALTER TABLE semesters DROP CONSTRAINT IF EXISTS semesters_semester_number_check;
  END IF;
END $$;
