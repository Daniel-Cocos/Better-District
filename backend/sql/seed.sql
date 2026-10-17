-- Fictional Southampton projects and opinions, for local development only.
-- Demo users: alex@example.com and sam@example.com
-- Demo password for both: council-demo-2026
-- Demo council admin (website): admin@southampton.gov.uk / council-admin-2026
-- Re-running this file keeps existing records unchanged.
PRAGMA foreign_keys = ON;
BEGIN;
INSERT INTO users (email, password_hash) VALUES
('alex@example.com', 'scrypt$56d40b809ccf705d08af251d99fef69e$96c9abef41b39cf2036283c3128b613f14a9e485b2604ebd66d3fca43a12a3c3b5a03695634c0d19e53cea98816f583e908302b6f6f6c8e33a64b3ab67c833f7'),
('sam@example.com', 'scrypt$12d135dc3c0658d540527ae53544e0e7$c1a7611f799d5b946fcbe9d90cb5676feeabe14ec9fad7d7f62307c839813c624a481c11821af33f9bd65a981408d4741c777fa993b0110238452560c9fd45bd'),
('admin@southampton.gov.uk', 'scrypt$edba1514cbc583e6e349621730265aac$9f7e100e25f66558d7a8d0ba4f2e07537c3e078c6925bf2b2cee922058a929c428f302455113dcd700361affe34122638736cea62a348de1a2cee49a74f2c977')
ON CONFLICT DO NOTHING;

INSERT INTO admins (email, name, job_title) VALUES
('admin@southampton.gov.uk', 'Alex Morgan', 'Planning & Engagement')
ON CONFLICT DO NOTHING;

INSERT INTO events (id, title, description, latitude, longitude, likes, dislikes) VALUES
(1, 'Central Library renovation', 'Proposed accessible entrance, improved lighting and new study spaces at the city library.', 50.9081, -1.4043, 42, 5),
(2, 'Portswood Road cycle lane', 'Consultation on a protected cycle lane and safer crossings along Portswood Road.', 50.9255, -1.3910, 28, 17),
(3, 'Riverside Park playground renewal', 'Replace worn play equipment and add inclusive play areas and more seating.', 50.9340, -1.3790, 65, 3),
(4, 'City centre pavement repairs', 'Repair uneven paving and improve dropped kerbs around the High Street.', 50.9004, -1.4032, 36, 8),
(5, 'Mayflower Park tree planting', 'Plant shade trees and native flower beds, with paths kept clear for public events.', 50.8964, -1.4090, 51, 6)
ON CONFLICT DO NOTHING;

INSERT INTO comments (id, event_id, body, user_email, likes, dislikes) VALUES
(1, 1, 'The accessible entrance is overdue. Please keep a quiet study area during the works.', 'alex@example.com', 12, 0),
(2, 1, 'I support this, but what will happen to library opening hours during construction?', NULL, 8, 1),
(3, 2, 'A protected lane would make my commute much safer.', 'sam@example.com', 16, 4),
(4, 2, 'Please explain how deliveries to local shops will work before removing parking.', NULL, 11, 6),
(5, 3, 'Inclusive equipment would mean our whole family can enjoy the playground together.', 'alex@example.com', 23, 0),
(6, 3, 'More benches near the play area would really help grandparents.', NULL, 9, 0),
(7, 4, 'These repairs will make a big difference for wheelchair users.', 'sam@example.com', 14, 0),
(8, 4, 'Can the work be phased so businesses still have access?', NULL, 6, 1),
(9, 5, 'More shade is welcome. Please choose trees that support local wildlife.', 'alex@example.com', 18, 1),
(10, 5, 'A good idea, provided there is a budget to water and maintain the trees.', 'sam@example.com', 10, 0)
ON CONFLICT DO NOTHING;
COMMIT;
