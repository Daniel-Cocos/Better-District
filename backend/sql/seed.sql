-- Fictional Southampton community events and opinions, for local development only.
-- Demo users: alex@example.com and sam@example.com
-- Demo password for both: council-demo-2026
-- Demo council admin (website): admin@southampton.gov.uk / council-admin-2026
-- Quick local admin (website): admin / admin. Development only, never seed this in production.
-- Re-running refreshes demo event details and comment text, preserving votes, users and admins.
PRAGMA foreign_keys = ON;
BEGIN;
INSERT INTO users (email, password_hash) VALUES
('alex@example.com', 'scrypt$56d40b809ccf705d08af251d99fef69e$96c9abef41b39cf2036283c3128b613f14a9e485b2604ebd66d3fca43a12a3c3b5a03695634c0d19e53cea98816f583e908302b6f6f6c8e33a64b3ab67c833f7'),
('sam@example.com', 'scrypt$12d135dc3c0658d540527ae53544e0e7$c1a7611f799d5b946fcbe9d90cb5676feeabe14ec9fad7d7f62307c839813c624a481c11821af33f9bd65a981408d4741c777fa993b0110238452560c9fd45bd'),
('admin@southampton.gov.uk', 'scrypt$edba1514cbc583e6e349621730265aac$9f7e100e25f66558d7a8d0ba4f2e07537c3e078c6925bf2b2cee922058a929c428f302455113dcd700361affe34122638736cea62a348de1a2cee49a74f2c977'),
('admin', 'scrypt$3432d36213c2dde9fe557f14cd2ccf3e$51382b0fb9ff18e84d8d249792c1105e76a4cdf0ff12c5d2a7076633bd8c0bea1fabfbcf96684fb2b4c5dd70d45c68f916586f5a4295aa5cb81f2fe1f4eb0a1e')
ON CONFLICT DO NOTHING;

INSERT INTO admins (email, name, job_title) VALUES
('admin@southampton.gov.uk', 'Alex Morgan', 'Planning & Engagement'),
('admin', 'Admin', 'Council administrator')
ON CONFLICT DO NOTHING;

INSERT INTO events (id, title, description, latitude, longitude, likes, dislikes, closes_at) VALUES
(1, 'Southampton Common community clean-up', 'Fictional demo event: meet near the Hawthorns Urban Wildlife Centre for a community litter pick on Southampton Common. Bring gloves and help care for the woodland paths.', 50.9297, -1.4120, 42, 5, '2026-11-01T17:00:00Z'),
(2, 'Portswood Road cycling workshop', 'Fictional demo event: a friendly bike-maintenance workshop near Portswood Library, with puncture repair demonstrations and tips for cycling around Southampton.', 50.9255, -1.3910, 28, 17, '2026-11-04T18:00:00Z'),
(3, 'Riverside Park family picnic', 'Fictional demo event: a bring-your-own picnic beside the River Itchen at Riverside Park, with lawn games and a relaxed stroll along the riverside paths.', 50.9340, -1.3790, 65, 3, '2026-11-07T16:00:00Z'),
(4, 'Southampton Old Town heritage walk', 'Fictional demo event: a guided walk from the Tudor House area through Southampton Old Town, exploring the medieval walls, historic lanes and links to the waterfront.', 50.8979, -1.4054, 36, 8, '2026-11-10T17:00:00Z'),
(5, 'Mayflower Park waterfront music', 'Fictional demo event: local acoustic performers and a relaxed community gathering at Mayflower Park, overlooking Southampton Water. Bring a picnic blanket.', 50.8964, -1.4090, 51, 6, '2026-11-14T18:00:00Z')
ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    description = excluded.description,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    closes_at = excluded.closes_at;

INSERT INTO comments (id, event_id, body, user_email, likes, dislikes) VALUES
(1, 1, 'Happy to help with the Common clean-up. Will litter pickers be provided?', 'alex@example.com', 12, 0),
(2, 1, 'Could we include the paths around the Hawthorns? They could use some attention.', NULL, 8, 1),
(3, 2, 'A puncture repair demo would be really useful for my cycle to Portswood.', 'sam@example.com', 16, 4),
(4, 2, 'Can beginners bring a bike along for a quick safety check?', NULL, 11, 6),
(5, 3, 'The Riverside picnic sounds lovely. Are the lawn games suitable for younger children?', 'alex@example.com', 23, 0),
(6, 3, 'Please share an accessible meeting point near the riverside path.', NULL, 9, 0),
(7, 4, 'I would love to learn more about the Old Town walls and Tudor House.', 'sam@example.com', 14, 0),
(8, 4, 'Will the heritage walk include steps, or is there a step-free route?', NULL, 6, 1),
(9, 5, 'Local acoustic music by Southampton Water sounds like a great afternoon.', 'alex@example.com', 18, 1),
(10, 5, 'Please leave enough space for people using the waterfront path.', 'sam@example.com', 10, 0)
ON CONFLICT(id) DO UPDATE SET body = excluded.body;
COMMIT;
