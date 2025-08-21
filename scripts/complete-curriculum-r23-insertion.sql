-- Complete R23 Curriculum Insertion Script
-- This script inserts all subjects and subject offerings for the R23 regulation
-- Run this with admin privileges when the database allows write operations

-- =================================================================
-- STEP 1: Insert all required subjects
-- =================================================================

INSERT INTO subjects (code, name, full_name, default_units) VALUES
-- Common Engineering Foundation Subjects
('EP', 'Engineering Physics', 'Engineering Physics', 3),
('LAC', 'Linear Algebra & Calculus', 'Linear Algebra & Calculus', 4),
('BEEE', 'Basic Electrical and Electronics Engineering', 'Basic Electrical and Electronics Engineering', 3),
('EG', 'Engineering Graphics', 'Engineering Graphics', 2),
('ITP', 'Introduction to Programming', 'Introduction to Programming', 3),
('EPL', 'Engineering Physics Lab', 'Engineering Physics Lab', 1),
('EEEW', 'Electrical and Electronics Engineering Workshop', 'Electrical and Electronics Engineering Workshop', 1),
('CPL', 'Computer Programming Lab', 'Computer Programming Lab', 1),
('ITW', 'IT Workshop', 'IT Workshop', 1),
('NSSNCC', 'NSS/NCC', 'NSS/NCC', 1),
('CE', 'Communicative English', 'Communicative English', 2),
('DEVC', 'Differential Equations and Vector Calculus', 'Differential Equations and Vector Calculus', 4),
('CHEM', 'Chemistry', 'Chemistry', 3),
('BCME', 'Basic Civil and Mechanical Engineering', 'Basic Civil and Mechanical Engineering', 3),
('DS', 'Data Structures', 'Data Structures', 3),
('EW', 'Engineering Workshop', 'Engineering Workshop', 1),
('CEL', 'Communicative English Laboratory', 'Communicative English Laboratory', 1),
('DSL', 'Data Structures Laboratory', 'Data Structures Laboratory', 1),
('CHEML', 'Chemistry Laboratory', 'Chemistry Laboratory', 1),
('HWYS', 'Health and wellness, Yoga and Sports', 'Health and wellness, Yoga and Sports', 1),

-- Common Advanced Subjects
('DMGT', 'Discrete Mathematics & Graph Theory', 'Discrete Mathematics & Graph Theory', 4),
('UHV2', 'Universal Human Values 2-Understanding Harmony and Ethical Human Conduct', 'Universal Human Values 2-Understanding Harmony and Ethical Human Conduct', 2),
('PP', 'Python programming', 'Python programming', 3),
('ES', 'Environmental Science', 'Environmental Science', 2),
('DTI', 'Design Thinking & Innovation', 'Design Thinking & Innovation', 2),
('SOFT', 'Soft Skills', 'Soft Skills', 2),

-- CSE(DS) Specific Subjects
('IDS', 'Introduction to Data Science', 'Introduction to Data Science', 3),
('ADSAA', 'Advanced Data Structures & Algorithms Analysis', 'Advanced Data Structures & Algorithms Analysis', 4),
('OOPJ', 'Object-Oriented Programming Through JAVA', 'Object-Oriented Programming Through JAVA', 3),
('DSciL', 'Data Science Lab', 'Data Science Lab', 1),
('OOPJL', 'Object-Oriented Programming Through JAVA Lab', 'Object-Oriented Programming Through JAVA Lab', 1),
('OT', 'Optimization Techniques', 'Optimization Techniques', 4),
('SMDS', 'Statistical methods for Data science', 'Statistical methods for Data science', 4),
('DE', 'Data Engineering', 'Data Engineering', 3),
('DBMS', 'DBMS', 'Database Management Systems', 3),
('COA', 'Computer Organization and Architecture', 'Computer Organization and Architecture', 3),
('DEL', 'Data Engineering Lab', 'Data Engineering Lab', 1),
('DBMSL', 'DBMS Lab', 'DBMS Lab', 1),
('EDAP', 'Exploratory Data Analysis with Python', 'Exploratory Data Analysis with Python', 3),

-- ECE Specific Subjects
('NA', 'Network Analysis', 'Network Analysis', 3),
('NASL', 'Network Analysis and Simulation Laboratory', 'Network Analysis and Simulation Laboratory', 1),
('PTSP', 'Probability theory and stochastic process', 'Probability theory and stochastic process', 4),
('SS', 'Signals and Systems', 'Signals and Systems', 4),
('EDC', 'Electronic Devices and Circuits', 'Electronic Devices and Circuits', 4),
('STLD', 'Switching Theory and Logic Design', 'Switching Theory and Logic Design', 3),
('EDCL', 'Electronic Devices and Circuits Laboratory', 'Electronic Devices and Circuits Laboratory', 1),
('STLDL', 'Switching Theory and Logic Design Laboratory', 'Switching Theory and Logic Design Laboratory', 1),
('DSP', 'Data Structures using Python', 'Data Structures using Python', 3),
('MEFA', 'Managerial Economics and Financial Analysis', 'Managerial Economics and Financial Analysis', 3),
('LCS', 'Linear Control Systems', 'Linear Control Systems', 4),
('ETL', 'Electromagnetic and Transmission Lines', 'Electromagnetic and Transmission Lines', 4),
('WAVES', 'Waves', 'Waves', 3),
('ECA', 'Electronic Circuit Analysis', 'Electronic Circuit Analysis', 4),
('AC', 'Analog Communications', 'Analog Communications', 4),
('SSL', 'Signals and Systems Laboratory', 'Signals and Systems Laboratory', 1),
('ECAL', 'Electronic Circuit Analysis Laboratory', 'Electronic Circuit Analysis Laboratory', 1),

-- ME Specific Subjects
('EM', 'Engineering Mechanics', 'Engineering Mechanics', 4),
('EML', 'Engineering Mechanics Lab', 'Engineering Mechanics Lab', 1),
('NMTT', 'Numerical Methods and Transform Techniques', 'Numerical Methods and Transform Techniques', 4),
('THERMO', 'Thermodynamics', 'Thermodynamics', 4),
('MOS', 'Mechanics of solids', 'Mechanics of solids', 4),
('MSM', 'Material science and metallurgy', 'Material science and metallurgy', 3),
('MOSMSML', 'Mechanics of Solids and Materials Science Laboratory', 'Mechanics of Solids and Materials Science Laboratory', 1),
('CAMD', 'Computer-aided Machine Drawing', 'Computer-aided Machine Drawing', 2),
('PPL', 'Python programming Laboratory', 'Python programming Laboratory', 1),
('ESIOT', 'Embedded Systems and IoT', 'Embedded Systems and IoT', 3),
('IM', 'Industrial Management', 'Industrial Management', 3),
('CVPS', 'Complex Variables, Probability and Statistics', 'Complex Variables, Probability and Statistics', 4),
('MP', 'Manufacturing Processes', 'Manufacturing Processes', 4),
('FMHM', 'Fluid Mechanics & Hydraulic Machines', 'Fluid Mechanics & Hydraulic Machines', 4),
('TOM', 'Theory of Machines', 'Theory of Machines', 4),
('FMHML', 'Fluid Mechanics & Hydraulic Machines Laboratory', 'Fluid Mechanics & Hydraulic Machines Laboratory', 1),
('MPL', 'Manufacturing Processes Laboratory', 'Manufacturing Processes Laboratory', 1),

-- IT Specific Subjects
('DLCO', 'Digital Logic & Computer organisation', 'Digital Logic & Computer organisation', 3),
('ADSAAL', 'Advanced Data Structures & Algorithm Analysis Laboratory', 'Advanced Data Structures & Algorithm Analysis Laboratory', 1),
('PS', 'Probability & Statistics', 'Probability & Statistics', 4),
('OS', 'Operating Systems', 'Operating Systems', 3),
('SE', 'Software Engineering', 'Software Engineering', 3),
('OSESL', 'Operating Systems & Software Engineering laboratory', 'Operating Systems & Software Engineering laboratory', 1),
('DBMSL_IT', 'Database Management Systems Laboratory', 'Database Management Systems Laboratory', 1),
('PDJ', 'Python with DJango', 'Python with DJango', 3),

-- CE Specific Subjects
('NTSM', 'Numerical Techniques And Statistical Methods', 'Numerical Techniques And Statistical Methods', 4),
('SURV', 'Surveying', 'Surveying', 4),
('SOM', 'Strength of Materials', 'Strength of Materials', 4),
('FM', 'Fluid Mechanics', 'Fluid Mechanics', 4),
('SURVL', 'Surveying Laboratory', 'Surveying Laboratory', 1),
('SOML', 'Strength of Materials Laboratory', 'Strength of Materials Laboratory', 1),
('BPD', 'Building Planning and Drawing', 'Building Planning and Drawing', 2),
('EG_CE', 'Engineering Geology', 'Engineering Geology', 3),
('CT', 'Concrete Technology', 'Concrete Technology', 4),
('SA', 'Structural Analysis', 'Structural Analysis', 4),
('HHM', 'Hydraulics & Hydraulic Machinery', 'Hydraulics & Hydraulic Machinery', 4),
('CTL', 'Concrete Technology Laboratory', 'Concrete Technology Laboratory', 1),
('EGL', 'Engineering Geology Laboratory', 'Engineering Geology Laboratory', 1),
('RSGIS', 'Remote Sensing & Geographical Information Systems', 'Remote Sensing & Geographical Information Systems', 3),
('BMCC', 'Building materials and Construction', 'Building materials and Construction', 3),

-- EEE Specific Subjects
('ECA1', 'Electrical Circuit Analysis-I', 'Electrical Circuit Analysis-I', 4),
('ECL', 'Electrical Circuits Laboratory', 'Electrical Circuits Laboratory', 1),
('CVNM', 'Complex Variables & Numerical Methods', 'Complex Variables & Numerical Methods', 4),
('EFT', 'Electromagnetic Field Theory', 'Electromagnetic Field Theory', 4),
('ECA2', 'Electrical Circuit Analysis-II', 'Electrical Circuit Analysis-II', 4),
('DCMT', 'DC Machines & Transformers', 'DC Machines & Transformers', 4),
('DCMTL', 'DC Machines & Transformers Laboratory', 'DC Machines & Transformers Laboratory', 1),
('ECA2SL', 'Electrical Circuit Analysis-II and Simulation Laboratory', 'Electrical Circuit Analysis-II and Simulation Laboratory', 1),
('DSL_EEE', 'Data Structures Laboratory', 'Data Structures Laboratory', 1),
('ANAC', 'Analog Circuits', 'Analog Circuits', 4),
('PS1', 'Power Systems-I', 'Power Systems-I', 4),
('ISM', 'Induction and Synchronous Machines', 'Induction and Synchronous Machines', 4),
('CS', 'Control Systems', 'Control Systems', 4),
('ISML', 'Induction and Synchronous Machines Laboratory', 'Induction and Synchronous Machines Laboratory', 1),
('CSL', 'Control Systems Laboratory', 'Control Systems Laboratory', 1),

-- CSE(AIML) Specific Subjects
('AI', 'Artificial Intelligence', 'Artificial Intelligence', 4),
('ML', 'Machine Learning', 'Machine Learning', 4),
('DLCO2', 'Digital Logic and Computer Organization', 'Digital Logic and Computer Organization', 3),
('AIMLL', 'AI & ML Laboratory', 'AI & ML Laboratory', 1),
('FSD1', 'Full Stack Development-1', 'Full Stack Development-1', 3),

-- CSE Specific Subjects
('FSD1_CSE', 'Full Stack Development -I', 'Full Stack Development -I', 3),
('OSL', 'Operating Systems Laboratory', 'Operating Systems Laboratory', 1)

ON CONFLICT (code) DO NOTHING;

-- =================================================================
-- STEP 2: Insert Subject Offerings for R23 Regulation
-- =================================================================

-- CSE(DS) - 1st Year 1st Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'CSE(DS)', 1, 1, s.id, 
  CASE s.code 
    WHEN 'EP' THEN 1
    WHEN 'LAC' THEN 2
    WHEN 'BEEE' THEN 3
    WHEN 'EG' THEN 4
    WHEN 'ITP' THEN 5
    WHEN 'EPL' THEN 6
    WHEN 'EEEW' THEN 7
    WHEN 'CPL' THEN 8
    WHEN 'ITW' THEN 9
    WHEN 'NSSNCC' THEN 10
  END, true
FROM subjects s 
WHERE s.code IN ('EP', 'LAC', 'BEEE', 'EG', 'ITP', 'EPL', 'EEEW', 'CPL', 'ITW', 'NSSNCC')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- CSE(DS) - 1st Year 2nd Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'CSE(DS)', 1, 2, s.id, 
  CASE s.code 
    WHEN 'CE' THEN 1
    WHEN 'DEVC' THEN 2
    WHEN 'CHEM' THEN 3
    WHEN 'BCME' THEN 4
    WHEN 'DS' THEN 5
    WHEN 'EW' THEN 6
    WHEN 'CEL' THEN 7
    WHEN 'DSL' THEN 8
    WHEN 'CHEML' THEN 9
    WHEN 'HWYS' THEN 10
  END, true
FROM subjects s 
WHERE s.code IN ('CE', 'DEVC', 'CHEM', 'BCME', 'DS', 'EW', 'CEL', 'DSL', 'CHEML', 'HWYS')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- CSE(DS) - 2nd Year 1st Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'CSE(DS)', 2, 1, s.id, 
  CASE s.code 
    WHEN 'DMGT' THEN 1
    WHEN 'UHV2' THEN 2
    WHEN 'IDS' THEN 3
    WHEN 'ADSAA' THEN 4
    WHEN 'OOPJ' THEN 5
    WHEN 'DSciL' THEN 6
    WHEN 'OOPJL' THEN 7
    WHEN 'PP' THEN 8
    WHEN 'ES' THEN 9
  END, true
FROM subjects s 
WHERE s.code IN ('DMGT', 'UHV2', 'IDS', 'ADSAA', 'OOPJ', 'DSciL', 'OOPJL', 'PP', 'ES')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- CSE(DS) - 2nd Year 2nd Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'CSE(DS)', 2, 2, s.id, 
  CASE s.code 
    WHEN 'OT' THEN 1
    WHEN 'SMDS' THEN 2
    WHEN 'DE' THEN 3
    WHEN 'DBMS' THEN 4
    WHEN 'COA' THEN 5
    WHEN 'DEL' THEN 6
    WHEN 'DBMSL' THEN 7
    WHEN 'EDAP' THEN 8
    WHEN 'DTI' THEN 9
  END, true
FROM subjects s 
WHERE s.code IN ('OT', 'SMDS', 'DE', 'DBMS', 'COA', 'DEL', 'DBMSL', 'EDAP', 'DTI')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- ECE - 1st Year 1st Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'ECE', 1, 1, s.id, 
  CASE s.code 
    WHEN 'CE' THEN 1
    WHEN 'LAC' THEN 2
    WHEN 'CHEM' THEN 3
    WHEN 'BCME' THEN 4
    WHEN 'ITP' THEN 5
    WHEN 'CEL' THEN 6
    WHEN 'CPL' THEN 7
    WHEN 'CHEML' THEN 8
    WHEN 'HWYS' THEN 9
  END, true
FROM subjects s 
WHERE s.code IN ('CE', 'LAC', 'CHEM', 'BCME', 'ITP', 'CEL', 'CPL', 'CHEML', 'HWYS')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- ECE - 1st Year 2nd Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'ECE', 1, 2, s.id, 
  CASE s.code 
    WHEN 'EP' THEN 1
    WHEN 'DEVC' THEN 2
    WHEN 'BEEE' THEN 3
    WHEN 'EG' THEN 4
    WHEN 'NA' THEN 5
    WHEN 'EPL' THEN 6
    WHEN 'EEEW' THEN 7
    WHEN 'NASL' THEN 8
    WHEN 'ITW' THEN 9
    WHEN 'NSSNCC' THEN 10
  END, true
FROM subjects s 
WHERE s.code IN ('EP', 'DEVC', 'BEEE', 'EG', 'NA', 'EPL', 'EEEW', 'NASL', 'ITW', 'NSSNCC')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- ECE - 2nd Year 1st Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'ECE', 2, 1, s.id, 
  CASE s.code 
    WHEN 'PTSP' THEN 1
    WHEN 'UHV2' THEN 2
    WHEN 'SS' THEN 3
    WHEN 'EDC' THEN 4
    WHEN 'STLD' THEN 5
    WHEN 'EDCL' THEN 6
    WHEN 'STLDL' THEN 7
    WHEN 'DSP' THEN 8
    WHEN 'ES' THEN 9
  END, true
FROM subjects s 
WHERE s.code IN ('PTSP', 'UHV2', 'SS', 'EDC', 'STLD', 'EDCL', 'STLDL', 'DSP', 'ES')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- ECE - 2nd Year 2nd Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'ECE', 2, 2, s.id, 
  CASE s.code 
    WHEN 'MEFA' THEN 1
    WHEN 'LCS' THEN 2
    WHEN 'ETL' THEN 3
    WHEN 'WAVES' THEN 4
    WHEN 'ECA' THEN 5
    WHEN 'AC' THEN 6
    WHEN 'SSL' THEN 7
    WHEN 'ECAL' THEN 8
    WHEN 'SOFT' THEN 9
    WHEN 'DTI' THEN 10
  END, true
FROM subjects s 
WHERE s.code IN ('MEFA', 'LCS', 'ETL', 'WAVES', 'ECA', 'AC', 'SSL', 'ECAL', 'SOFT', 'DTI')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- ME - 1st Year 1st Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'ME', 1, 1, s.id, 
  CASE s.code 
    WHEN 'EP' THEN 1
    WHEN 'LAC' THEN 2
    WHEN 'BEEE' THEN 3
    WHEN 'EG' THEN 4
    WHEN 'ITP' THEN 5
    WHEN 'EPL' THEN 6
    WHEN 'EEEW' THEN 7
    WHEN 'CPL' THEN 8
    WHEN 'ITW' THEN 9
    WHEN 'NSSNCC' THEN 10
  END, true
FROM subjects s 
WHERE s.code IN ('EP', 'LAC', 'BEEE', 'EG', 'ITP', 'EPL', 'EEEW', 'CPL', 'ITW', 'NSSNCC')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- ME - 1st Year 2nd Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'ME', 1, 2, s.id, 
  CASE s.code 
    WHEN 'CE' THEN 1
    WHEN 'DEVC' THEN 2
    WHEN 'CHEM' THEN 3
    WHEN 'BCME' THEN 4
    WHEN 'EM' THEN 5
    WHEN 'EW' THEN 6
    WHEN 'CEL' THEN 7
    WHEN 'EML' THEN 8
    WHEN 'CHEML' THEN 9
    WHEN 'HWYS' THEN 10
  END, true
FROM subjects s 
WHERE s.code IN ('CE', 'DEVC', 'CHEM', 'BCME', 'EM', 'EW', 'CEL', 'EML', 'CHEML', 'HWYS')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- ME - 2nd Year 1st Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'ME', 2, 1, s.id, 
  CASE s.code 
    WHEN 'NMTT' THEN 1
    WHEN 'UHV2' THEN 2
    WHEN 'THERMO' THEN 3
    WHEN 'MOS' THEN 4
    WHEN 'MSM' THEN 5
    WHEN 'MOSMSML' THEN 6
    WHEN 'CAMD' THEN 7
    WHEN 'PPL' THEN 8
    WHEN 'ESIOT' THEN 9
    WHEN 'ES' THEN 10
  END, true
FROM subjects s 
WHERE s.code IN ('NMTT', 'UHV2', 'THERMO', 'MOS', 'MSM', 'MOSMSML', 'CAMD', 'PPL', 'ESIOT', 'ES')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- ME - 2nd Year 2nd Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'ME', 2, 2, s.id, 
  CASE s.code 
    WHEN 'IM' THEN 1
    WHEN 'CVPS' THEN 2
    WHEN 'MP' THEN 3
    WHEN 'FMHM' THEN 4
    WHEN 'TOM' THEN 5
    WHEN 'FMHML' THEN 6
    WHEN 'MPL' THEN 7
    WHEN 'SOFT' THEN 8
    WHEN 'DTI' THEN 9
  END, true
FROM subjects s 
WHERE s.code IN ('IM', 'CVPS', 'MP', 'FMHM', 'TOM', 'FMHML', 'MPL', 'SOFT', 'DTI')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- IT - 1st Year 1st Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'IT', 1, 1, s.id, 
  CASE s.code 
    WHEN 'CE' THEN 1
    WHEN 'LAC' THEN 2
    WHEN 'CHEM' THEN 3
    WHEN 'BCME' THEN 4
    WHEN 'ITP' THEN 5
    WHEN 'EW' THEN 6
    WHEN 'CEL' THEN 7
    WHEN 'CPL' THEN 8
    WHEN 'CHEML' THEN 9
    WHEN 'HWYS' THEN 10
  END, true
FROM subjects s 
WHERE s.code IN ('CE', 'LAC', 'CHEM', 'BCME', 'ITP', 'EW', 'CEL', 'CPL', 'CHEML', 'HWYS')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- IT - 1st Year 2nd Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'IT', 1, 2, s.id, 
  CASE s.code 
    WHEN 'EP' THEN 1
    WHEN 'DEVC' THEN 2
    WHEN 'BEEE' THEN 3
    WHEN 'EG' THEN 4
    WHEN 'DS' THEN 5
    WHEN 'EPL' THEN 6
    WHEN 'EEEW' THEN 7
    WHEN 'DSL' THEN 8
    WHEN 'ITW' THEN 9
    WHEN 'NSSNCC' THEN 10
  END, true
FROM subjects s 
WHERE s.code IN ('EP', 'DEVC', 'BEEE', 'EG', 'DS', 'EPL', 'EEEW', 'DSL', 'ITW', 'NSSNCC')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- IT - 2nd Year 1st Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'IT', 2, 1, s.id, 
  CASE s.code 
    WHEN 'DMGT' THEN 1
    WHEN 'UHV2' THEN 2
    WHEN 'DLCO' THEN 3
    WHEN 'ADSAA' THEN 4
    WHEN 'OOPJ' THEN 5
    WHEN 'ADSAAL' THEN 6
    WHEN 'OOPJL' THEN 7
    WHEN 'PP' THEN 8
    WHEN 'ES' THEN 9
  END, true
FROM subjects s 
WHERE s.code IN ('DMGT', 'UHV2', 'DLCO', 'ADSAA', 'OOPJ', 'ADSAAL', 'OOPJL', 'PP', 'ES')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- IT - 2nd Year 2nd Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'IT', 2, 2, s.id, 
  CASE s.code 
    WHEN 'OT' THEN 1
    WHEN 'PS' THEN 2
    WHEN 'OS' THEN 3
    WHEN 'DBMS' THEN 4
    WHEN 'SE' THEN 5
    WHEN 'OSESL' THEN 6
    WHEN 'DBMSL_IT' THEN 7
    WHEN 'PDJ' THEN 8
    WHEN 'DTI' THEN 9
  END, true
FROM subjects s 
WHERE s.code IN ('OT', 'PS', 'OS', 'DBMS', 'SE', 'OSESL', 'DBMSL_IT', 'PDJ', 'DTI')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- CE - 1st Year 1st Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'CE', 1, 1, s.id, 
  CASE s.code 
    WHEN 'EP' THEN 1
    WHEN 'LAC' THEN 2
    WHEN 'BEEE' THEN 3
    WHEN 'EG' THEN 4
    WHEN 'ITP' THEN 5
    WHEN 'EPL' THEN 6
    WHEN 'EEEW' THEN 7
    WHEN 'CPL' THEN 8
    WHEN 'ITW' THEN 9
    WHEN 'NSSNCC' THEN 10
  END, true
FROM subjects s 
WHERE s.code IN ('EP', 'LAC', 'BEEE', 'EG', 'ITP', 'EPL', 'EEEW', 'CPL', 'ITW', 'NSSNCC')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- CE - 1st Year 2nd Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'CE', 1, 2, s.id, 
  CASE s.code 
    WHEN 'CE' THEN 1
    WHEN 'DEVC' THEN 2
    WHEN 'CHEM' THEN 3
    WHEN 'BCME' THEN 4
    WHEN 'EM' THEN 5
    WHEN 'EW' THEN 6
    WHEN 'CEL' THEN 7
    WHEN 'EML' THEN 8
    WHEN 'CHEML' THEN 9
    WHEN 'HWYS' THEN 10
  END, true
FROM subjects s 
WHERE s.code IN ('CE', 'DEVC', 'CHEM', 'BCME', 'EM', 'EW', 'CEL', 'EML', 'CHEML', 'HWYS')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- CE - 2nd Year 1st Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'CE', 2, 1, s.id, 
  CASE s.code 
    WHEN 'NTSM' THEN 1
    WHEN 'UHV2' THEN 2
    WHEN 'SURV' THEN 3
    WHEN 'SOM' THEN 4
    WHEN 'FM' THEN 5
    WHEN 'SURVL' THEN 6
    WHEN 'SOML' THEN 7
    WHEN 'BPD' THEN 8
    WHEN 'ES' THEN 9
  END, true
FROM subjects s 
WHERE s.code IN ('NTSM', 'UHV2', 'SURV', 'SOM', 'FM', 'SURVL', 'SOML', 'BPD', 'ES')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- CE - 2nd Year 2nd Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'CE', 2, 2, s.id, 
  CASE s.code 
    WHEN 'MEFA' THEN 1
    WHEN 'EG_CE' THEN 2
    WHEN 'CT' THEN 3
    WHEN 'SA' THEN 4
    WHEN 'HHM' THEN 5
    WHEN 'CTL' THEN 6
    WHEN 'EGL' THEN 7
    WHEN 'RSGIS' THEN 8
    WHEN 'DTI' THEN 9
    WHEN 'BMCC' THEN 10
  END, true
FROM subjects s 
WHERE s.code IN ('MEFA', 'EG_CE', 'CT', 'SA', 'HHM', 'CTL', 'EGL', 'RSGIS', 'DTI', 'BMCC')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- EEE - 1st Year 1st Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'EEE', 1, 1, s.id, 
  CASE s.code 
    WHEN 'EP' THEN 1
    WHEN 'LAC' THEN 2
    WHEN 'BEEE' THEN 3
    WHEN 'EG' THEN 4
    WHEN 'ITP' THEN 5
    WHEN 'EPL' THEN 6
    WHEN 'EEEW' THEN 7
    WHEN 'CPL' THEN 8
    WHEN 'ITW' THEN 9
    WHEN 'NSSNCC' THEN 10
  END, true
FROM subjects s 
WHERE s.code IN ('EP', 'LAC', 'BEEE', 'EG', 'ITP', 'EPL', 'EEEW', 'CPL', 'ITW', 'NSSNCC')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- EEE - 1st Year 2nd Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'EEE', 1, 2, s.id, 
  CASE s.code 
    WHEN 'CE' THEN 1
    WHEN 'DEVC' THEN 2
    WHEN 'CHEM' THEN 3
    WHEN 'BCME' THEN 4
    WHEN 'ECA1' THEN 5
    WHEN 'EW' THEN 6
    WHEN 'CEL' THEN 7
    WHEN 'ECL' THEN 8
    WHEN 'CHEML' THEN 9
    WHEN 'HWYS' THEN 10
  END, true
FROM subjects s 
WHERE s.code IN ('CE', 'DEVC', 'CHEM', 'BCME', 'ECA1', 'EW', 'CEL', 'ECL', 'CHEML', 'HWYS')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- EEE - 2nd Year 1st Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'EEE', 2, 1, s.id, 
  CASE s.code 
    WHEN 'CVNM' THEN 1
    WHEN 'UHV2' THEN 2
    WHEN 'EFT' THEN 3
    WHEN 'ECA2' THEN 4
    WHEN 'DCMT' THEN 5
    WHEN 'DCMTL' THEN 6
    WHEN 'ECA2SL' THEN 7
    WHEN 'DSL_EEE' THEN 8
    WHEN 'ES' THEN 9
  END, true
FROM subjects s 
WHERE s.code IN ('CVNM', 'UHV2', 'EFT', 'ECA2', 'DCMT', 'DCMTL', 'ECA2SL', 'DSL_EEE', 'ES')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- EEE - 2nd Year 2nd Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'EEE', 2, 2, s.id, 
  CASE s.code 
    WHEN 'MEFA' THEN 1
    WHEN 'ANAC' THEN 2
    WHEN 'PS1' THEN 3
    WHEN 'ISM' THEN 4
    WHEN 'CS' THEN 5
    WHEN 'ISML' THEN 6
    WHEN 'CSL' THEN 7
    WHEN 'PP' THEN 8
    WHEN 'DTI' THEN 9
  END, true
FROM subjects s 
WHERE s.code IN ('MEFA', 'ANAC', 'PS1', 'ISM', 'CS', 'ISML', 'CSL', 'PP', 'DTI')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- CSE(AIML) - 1st Year 1st Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'CSE(AIML)', 1, 1, s.id, 
  CASE s.code 
    WHEN 'CE' THEN 1
    WHEN 'LAC' THEN 2
    WHEN 'CHEM' THEN 3
    WHEN 'BCME' THEN 4
    WHEN 'ITP' THEN 5
    WHEN 'EW' THEN 6
    WHEN 'CEL' THEN 7
    WHEN 'CPL' THEN 8
    WHEN 'CHEML' THEN 9
    WHEN 'HWYS' THEN 10
  END, true
FROM subjects s 
WHERE s.code IN ('CE', 'LAC', 'CHEM', 'BCME', 'ITP', 'EW', 'CEL', 'CPL', 'CHEML', 'HWYS')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- CSE(AIML) - 1st Year 2nd Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'CSE(AIML)', 1, 2, s.id, 
  CASE s.code 
    WHEN 'EP' THEN 1
    WHEN 'DEVC' THEN 2
    WHEN 'BEEE' THEN 3
    WHEN 'EG' THEN 4
    WHEN 'DS' THEN 5
    WHEN 'EPL' THEN 6
    WHEN 'EEEW' THEN 7
    WHEN 'DSL' THEN 8
    WHEN 'ITW' THEN 9
    WHEN 'NSSNCC' THEN 10
  END, true
FROM subjects s 
WHERE s.code IN ('EP', 'DEVC', 'BEEE', 'EG', 'DS', 'EPL', 'EEEW', 'DSL', 'ITW', 'NSSNCC')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- CSE(AIML) - 2nd Year 1st Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'CSE(AIML)', 2, 1, s.id, 
  CASE s.code 
    WHEN 'DMGT' THEN 1
    WHEN 'UHV2' THEN 2
    WHEN 'AI' THEN 3
    WHEN 'ADSAA' THEN 4
    WHEN 'OOPJ' THEN 5
    WHEN 'ADSAAL' THEN 6
    WHEN 'OOPJL' THEN 7
    WHEN 'PP' THEN 8
    WHEN 'ES' THEN 9
  END, true
FROM subjects s 
WHERE s.code IN ('DMGT', 'UHV2', 'AI', 'ADSAA', 'OOPJ', 'ADSAAL', 'OOPJL', 'PP', 'ES')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- CSE(AIML) - 2nd Year 2nd Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'CSE(AIML)', 2, 2, s.id, 
  CASE s.code 
    WHEN 'OT' THEN 1
    WHEN 'PS' THEN 2
    WHEN 'ML' THEN 3
    WHEN 'DBMS' THEN 4
    WHEN 'DLCO2' THEN 5
    WHEN 'AIMLL' THEN 6
    WHEN 'DBMSL' THEN 7
    WHEN 'FSD1' THEN 8
    WHEN 'DTI' THEN 9
  END, true
FROM subjects s 
WHERE s.code IN ('OT', 'PS', 'ML', 'DBMS', 'DLCO2', 'AIMLL', 'DBMSL', 'FSD1', 'DTI')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- CSE - 1st Year 1st Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'CSE', 1, 1, s.id, 
  CASE s.code 
    WHEN 'EP' THEN 1
    WHEN 'LAC' THEN 2
    WHEN 'BEEE' THEN 3
    WHEN 'EG' THEN 4
    WHEN 'ITP' THEN 5
    WHEN 'EPL' THEN 6
    WHEN 'EEEW' THEN 7
    WHEN 'CPL' THEN 8
    WHEN 'ITW' THEN 9
    WHEN 'NSSNCC' THEN 10
  END, true
FROM subjects s 
WHERE s.code IN ('EP', 'LAC', 'BEEE', 'EG', 'ITP', 'EPL', 'EEEW', 'CPL', 'ITW', 'NSSNCC')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- CSE - 1st Year 2nd Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'CSE', 1, 2, s.id, 
  CASE s.code 
    WHEN 'CE' THEN 1
    WHEN 'DEVC' THEN 2
    WHEN 'CHEM' THEN 3
    WHEN 'BCME' THEN 4
    WHEN 'DS' THEN 5
    WHEN 'EW' THEN 6
    WHEN 'CEL' THEN 7
    WHEN 'DSL' THEN 8
    WHEN 'CHEML' THEN 9
    WHEN 'HWYS' THEN 10
  END, true
FROM subjects s 
WHERE s.code IN ('CE', 'DEVC', 'CHEM', 'BCME', 'DS', 'EW', 'CEL', 'DSL', 'CHEML', 'HWYS')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- CSE - 2nd Year 1st Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'CSE', 2, 1, s.id, 
  CASE s.code 
    WHEN 'DMGT' THEN 1
    WHEN 'UHV2' THEN 2
    WHEN 'DLCO' THEN 3
    WHEN 'ADSAA' THEN 4
    WHEN 'OOPJ' THEN 5
    WHEN 'ADSAAL' THEN 6
    WHEN 'OOPJL' THEN 7
    WHEN 'PP' THEN 8
    WHEN 'ES' THEN 9
  END, true
FROM subjects s 
WHERE s.code IN ('DMGT', 'UHV2', 'DLCO', 'ADSAA', 'OOPJ', 'ADSAAL', 'OOPJL', 'PP', 'ES')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- CSE - 2nd Year 2nd Semester
INSERT INTO subject_offerings (regulation, branch, year, semester, subject_id, display_order, active) 
SELECT 'R23', 'CSE', 2, 2, s.id, 
  CASE s.code 
    WHEN 'MEFA' THEN 1
    WHEN 'PS' THEN 2
    WHEN 'OS' THEN 3
    WHEN 'DBMS' THEN 4
    WHEN 'SE' THEN 5
    WHEN 'OSL' THEN 6
    WHEN 'DBMSL' THEN 7
    WHEN 'FSD1_CSE' THEN 8
    WHEN 'DTI' THEN 9
  END, true
FROM subjects s 
WHERE s.code IN ('MEFA', 'PS', 'OS', 'DBMS', 'SE', 'OSL', 'DBMSL', 'FSD1_CSE', 'DTI')
ON CONFLICT (regulation, branch, year, semester, subject_id) DO NOTHING;

-- Verification query to check the inserted data
-- SELECT so.regulation, so.branch, so.year, so.semester, s.code, s.name, so.display_order 
-- FROM subject_offerings so
-- JOIN subjects s ON so.subject_id = s.id 
-- WHERE so.regulation = 'R23'
-- ORDER BY so.branch, so.year, so.semester, so.display_order;
