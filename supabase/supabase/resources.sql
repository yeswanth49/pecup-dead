WITH year_cte AS (
    -- pick the batch year that corresponds to 3rd year
    SELECT id AS year_id
    FROM public.years
    WHERE batch_year = 2023
),
branch_cte AS (
    SELECT id AS branch_id
    FROM public.branches
    WHERE code = 'CSE'
),
semester_cte AS (
    SELECT s.id AS semester_id
    FROM public.semesters s
    JOIN year_cte y ON s.year_id = y.year_id
    WHERE s.semester_number = 1
),
refs AS (
    SELECT y.year_id, b.branch_id, s.semester_id
    FROM year_cte y, branch_cte b, semester_cte s
)
INSERT INTO public.resources (
    category, subject, unit, name, description,
    url, is_pdf, regulation, title, drive_link, file_type,
    year_id, branch_id, semester_id
) 
SELECT 
    v.category, v.subject, v.unit, v.name, v.description,
    v.url, v.is_pdf, v.regulation, v.title, v.drive_link, v.file_type,
    r.year_id, r.branch_id, r.semester_id
FROM (
    VALUES
      ('notes', 'flat', 4, 'Flat Unit 4 Notes', 'Flat notes for Unit 4',
       'https://drive.google.com/file/d/1kA2ccu5gh5nErvziO656BC8Myf9eTM2o/view?usp=sharing',
       true, 'R23', 'Flat Unit 4 Notes', 'https://drive.google.com/file/d/1kA2ccu5gh5nErvziO656BC8Myf9eTM2o/view?usp=sharing', 'pdf'),

      ('notes', 'flat', 3, 'Flat Unit 3 Notes', 'Flat notes for Unit 3',
       'https://drive.google.com/file/d/1E_YbufgQJ6TsED13yFWHgiP4aXbAayL0/view?usp=sharing',
       true, 'R23', 'Flat Unit 3 Notes',
       'https://drive.google.com/file/d/1E_YbufgQJ6TsED13yFWHgiP4aXbAayL0/view?usp=sharing', 'pdf'),

      ('notes', 'flat', 5, 'Flat Unit 5 Notes', 'Flat Unit 5',
       'https://drive.google.com/file/d/1UONZFXz0wwn3LVUdFdPA_iH2sqWgImsM/view?usp=sharing',
       true, 'R23', 'Flat Unit 5 Notes',
       'https://drive.google.com/file/d/1UONZFXz0wwn3LVUdFdPA_iH2sqWgImsM/view?usp=sharing', 'pdf'),

      ('notes', 'dwdm', 5, 'DWDM Unit 5 Notes', 'DWDM notes for Unit 5',
       'https://drive.google.com/file/d/15xVzkgnKD-tRoaMbQTijnngV6WR2OgQC/view?usp=sharing',
       true, 'R23', 'DWDM Unit 1 Notes',
       'https://drive.google.com/file/d/15xVzkgnKD-tRoaMbQTijnngV6WR2OgQC/view?usp=sharing', 'pdf'),

      ('notes', 'dwdm', 4, 'DWDM Unit 4 Notes', 'DWDM notes for Unit 4',
       'https://drive.google.com/file/d/1_qa3aWIhNV-U8wW4BeWNPBwSlPYvCkbq/view?usp=sharing',
       true, 'R23', 'DWDM Unit 4 Notes',
       'https://drive.google.com/file/d/1_qa3aWIhNV-U8wW4BeWNPBwSlPYvCkbq/view?usp=sharing', 'pdf'),

       ('notes', 'dwdm', 3, 'DWDM Unit 3 Notes', 'DWDM notes for Unit 3',
       'https://drive.google.com/file/d/14IXBurCHsw7bTF9liaP5J9zEBGP81AFp/view?usp=sharing',
       true, 'R23', 'DWDM Unit 2 Notes',
       'https://drive.google.com/file/d/14IXBurCHsw7bTF9liaP5J9zEBGP81AFp/view?usp=sharing', 'pdf')
) AS v(category, subject, unit, name, description, url, is_pdf, regulation, title, drive_link, file_type),
refs r;