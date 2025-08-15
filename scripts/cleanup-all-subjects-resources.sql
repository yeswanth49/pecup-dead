-- Complete cleanup script to remove ALL subjects and resources
-- This script will remove all data from subjects-related and resources tables
-- Uses safe DELETE operations that check for table existence

-- Step 1: Remove all data from dependent tables first (to handle foreign key constraints)

-- Remove all record templates (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'record_templates') THEN
        DELETE FROM record_templates;
        RAISE NOTICE 'Deleted all records from record_templates';
    ELSE
        RAISE NOTICE 'Table record_templates does not exist, skipping';
    END IF;
END $$;

-- Remove all paper templates (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'paper_templates') THEN
        DELETE FROM paper_templates;
        RAISE NOTICE 'Deleted all records from paper_templates';
    ELSE
        RAISE NOTICE 'Table paper_templates does not exist, skipping';
    END IF;
END $$;

-- Step 2: Remove all resources first (to handle foreign key constraints)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'resources') THEN
        DELETE FROM resources;
        RAISE NOTICE 'Deleted all records from resources';
    ELSE
        RAISE NOTICE 'Table resources does not exist, skipping';
    END IF;
END $$;

-- Remove all subject offerings (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subject_offerings') THEN
        DELETE FROM subject_offerings;
        RAISE NOTICE 'Deleted all records from subject_offerings';
    ELSE
        RAISE NOTICE 'Table subject_offerings does not exist, skipping';
    END IF;
END $$;

-- Remove all subjects (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subjects') THEN
        DELETE FROM subjects;
        RAISE NOTICE 'Deleted all records from subjects';
    ELSE
        RAISE NOTICE 'Table subjects does not exist, skipping';
    END IF;
END $$;

-- Remove all regulations (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'regulations') THEN
        DELETE FROM regulations;
        RAISE NOTICE 'Deleted all records from regulations';
    ELSE
        RAISE NOTICE 'Table regulations does not exist, skipping';
    END IF;
END $$;

-- Step 3: Remove audit logs related to subjects and resources (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        DELETE FROM audit_logs WHERE entity IN ('resource', 'subject', 'subject_offering', 'regulation');
        RAISE NOTICE 'Deleted related audit logs';
    ELSE
        RAISE NOTICE 'Table audit_logs does not exist, skipping';
    END IF;
END $$;

-- Step 4: Verification - Show what tables exist and their current counts
DO $$ 
DECLARE
    table_exists boolean;
    record_count integer;
BEGIN
    RAISE NOTICE '=== TABLE VERIFICATION ===';
    
    -- Check each table and show counts
    FOR table_name IN VALUES ('subjects'), ('subject_offerings'), ('regulations'), ('resources'), ('record_templates'), ('paper_templates')
    LOOP
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = table_name.table_name
        ) INTO table_exists;
        
        IF table_exists THEN
            EXECUTE format('SELECT COUNT(*) FROM %I', table_name.table_name) INTO record_count;
            RAISE NOTICE 'Table % exists: % records remaining', table_name.table_name, record_count;
        ELSE
            RAISE NOTICE 'Table % does not exist', table_name.table_name;
        END IF;
    END LOOP;
END $$;

COMMIT;
