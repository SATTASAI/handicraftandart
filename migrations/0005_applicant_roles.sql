ALTER TABLE users ADD COLUMN applicant_role TEXT CHECK(applicant_role IN ('judge', 'coach'));
