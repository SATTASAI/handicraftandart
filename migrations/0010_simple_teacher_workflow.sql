-- One account for teaching and assigned judging. Preserve historical outcomes.
ALTER TABLE event_window ADD COLUMN simple_registration INTEGER NOT NULL DEFAULT 1;
UPDATE users SET approval_status='approved',approval_note='' WHERE approval_status='pending';
UPDATE competitions SET workflow_version=2 WHERE published=0 AND NOT EXISTS(SELECT 1 FROM scores s JOIN registrations r ON r.id=s.registration_id WHERE r.competition_id=competitions.id AND s.finalized_at IS NOT NULL);
UPDATE registrations SET eligibility_reviewed=1,eligibility_confirmed=1 WHERE decision='eligible' AND competition_id IN(SELECT id FROM competitions WHERE workflow_version=2);
