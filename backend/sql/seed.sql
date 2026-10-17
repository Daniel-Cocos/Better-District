-- Demo Southampton events and opinions, for local development only.
-- Events 1-5 are fictional community events. Events 101+ are demo consultations based on real
-- Southampton schemes (simplified; not official council information), with threaded resident comments.
-- Ids start at 101 (events) and 1001 (comments) so re-seeding never overwrites rows added through the app.
-- Demo users: alex@example.com, sam@example.com and the residents below
-- Demo password for both: council-demo-2026
-- Website admin: admin / admin, the only admin login for now. Development only, never seed this in production.
-- Re-running refreshes demo event details and comment text, preserving votes, users and admins.
PRAGMA foreign_keys = ON;
BEGIN;
INSERT INTO users (email, password_hash) VALUES
('alex@example.com', 'scrypt$56d40b809ccf705d08af251d99fef69e$96c9abef41b39cf2036283c3128b613f14a9e485b2604ebd66d3fca43a12a3c3b5a03695634c0d19e53cea98816f583e908302b6f6f6c8e33a64b3ab67c833f7'),
('sam@example.com', 'scrypt$12d135dc3c0658d540527ae53544e0e7$c1a7611f799d5b946fcbe9d90cb5676feeabe14ec9fad7d7f62307c839813c624a481c11821af33f9bd65a981408d4741c777fa993b0110238452560c9fd45bd'),
('priya.shah@example.com', 'scrypt$56d40b809ccf705d08af251d99fef69e$96c9abef41b39cf2036283c3128b613f14a9e485b2604ebd66d3fca43a12a3c3b5a03695634c0d19e53cea98816f583e908302b6f6f6c8e33a64b3ab67c833f7'),
('tom.reynolds@example.com', 'scrypt$56d40b809ccf705d08af251d99fef69e$96c9abef41b39cf2036283c3128b613f14a9e485b2604ebd66d3fca43a12a3c3b5a03695634c0d19e53cea98816f583e908302b6f6f6c8e33a64b3ab67c833f7'),
('jen.okafor@example.com', 'scrypt$56d40b809ccf705d08af251d99fef69e$96c9abef41b39cf2036283c3128b613f14a9e485b2604ebd66d3fca43a12a3c3b5a03695634c0d19e53cea98816f583e908302b6f6f6c8e33a64b3ab67c833f7'),
('mark.dawson@example.com', 'scrypt$56d40b809ccf705d08af251d99fef69e$96c9abef41b39cf2036283c3128b613f14a9e485b2604ebd66d3fca43a12a3c3b5a03695634c0d19e53cea98816f583e908302b6f6f6c8e33a64b3ab67c833f7'),
('lucy.chen@example.com', 'scrypt$56d40b809ccf705d08af251d99fef69e$96c9abef41b39cf2036283c3128b613f14a9e485b2604ebd66d3fca43a12a3c3b5a03695634c0d19e53cea98816f583e908302b6f6f6c8e33a64b3ab67c833f7'),
('dave.holt@example.com', 'scrypt$56d40b809ccf705d08af251d99fef69e$96c9abef41b39cf2036283c3128b613f14a9e485b2604ebd66d3fca43a12a3c3b5a03695634c0d19e53cea98816f583e908302b6f6f6c8e33a64b3ab67c833f7'),
('emma.wright@example.com', 'scrypt$56d40b809ccf705d08af251d99fef69e$96c9abef41b39cf2036283c3128b613f14a9e485b2604ebd66d3fca43a12a3c3b5a03695634c0d19e53cea98816f583e908302b6f6f6c8e33a64b3ab67c833f7'),
('raj.patel@example.com', 'scrypt$56d40b809ccf705d08af251d99fef69e$96c9abef41b39cf2036283c3128b613f14a9e485b2604ebd66d3fca43a12a3c3b5a03695634c0d19e53cea98816f583e908302b6f6f6c8e33a64b3ab67c833f7'),
('admin', 'scrypt$3432d36213c2dde9fe557f14cd2ccf3e$51382b0fb9ff18e84d8d249792c1105e76a4cdf0ff12c5d2a7076633bd8c0bea1fabfbcf96684fb2b4c5dd70d45c68f916586f5a4295aa5cb81f2fe1f4eb0a1e')
ON CONFLICT DO NOTHING;

INSERT INTO admins (email, name, job_title) VALUES
('admin', 'Admin', 'Council administrator')
ON CONFLICT DO NOTHING;

INSERT INTO events (id, title, description, latitude, longitude, likes, dislikes, closes_at) VALUES
(1, 'Southampton Common community clean-up', 'Fictional demo event: meet near the Hawthorns Urban Wildlife Centre for a community litter pick on Southampton Common. Bring gloves and help care for the woodland paths.', 50.9297, -1.4120, 42, 5, '2026-11-01T17:00:00Z'),
(2, 'Portswood Road cycling workshop', 'Fictional demo event: a friendly bike-maintenance workshop near Portswood Library, with puncture repair demonstrations and tips for cycling around Southampton.', 50.9255, -1.3910, 28, 17, '2026-11-04T18:00:00Z'),
(3, 'Riverside Park family picnic', 'Fictional demo event: a bring-your-own picnic beside the River Itchen at Riverside Park, with lawn games and a relaxed stroll along the riverside paths.', 50.9340, -1.3790, 65, 3, '2026-11-07T16:00:00Z'),
(4, 'Southampton Old Town heritage walk', 'Fictional demo event: a guided walk from the Tudor House area through Southampton Old Town, exploring the medieval walls, historic lanes and links to the waterfront.', 50.8979, -1.4054, 36, 8, '2026-11-10T17:00:00Z'),
(5, 'Mayflower Park waterfront music', 'Fictional demo event: local acoustic performers and a relaxed community gathering at Mayflower Park, overlooking Southampton Water. Bring a picnic blanket.', 50.8964, -1.4090, 51, 6, '2026-11-14T18:00:00Z'),
(101, 'Bargate Quarter: new homes, shops and a square by the medieval walls', 'Demo consultation based on the redevelopment of the former Bargate Shopping Centre site next to the medieval Bargate. The scheme replaces the old shopping centre with new homes, shops and places to eat, opens up views of a stretch of the old town walls and adds new walking routes between the High Street and the Old Town. Tell us what would make the new public spaces work for you.', 50.9030, -1.4040, 88, 21, '2026-11-20T17:00:00Z'),
(102, 'Portswood Broadway: bus gate and wider pavements', 'Demo consultation based on the Portswood Broadway scheme funded by the Transforming Cities Fund. A short section of Portswood Road becomes bus, cycle and taxi only, pavements are widened outside the shops and new crossings are added. Through traffic is sent around the main roads instead. We want to hear from shoppers, traders, bus users and people living on nearby streets.', 50.9250, -1.3915, 41, 63, '2026-11-08T17:00:00Z'),
(103, 'Itchen Bridge toll changes', 'Demo consultation based on proposals to change the Itchen Bridge tolls, which pay for the upkeep of the bridge. Cash tolls for cars would rise at peak times, with a lower rate for drivers who register for a bridge account. Walking and cycling across the bridge stays free. Tell us how the change would affect your journeys between Woolston and the city centre.', 50.8985, -1.3880, 18, 77, '2026-10-30T17:00:00Z'),
(104, 'Centenary Quay, Woolston: final riverside phase', 'Demo consultation based on the regeneration of the former Vosper Thornycroft shipyard in Woolston into Centenary Quay. The last phase would add more homes, finish the riverside promenade along the Itchen and create a small park and play area by the water.', 50.8960, -1.3810, 52, 14, '2026-12-04T17:00:00Z'),
(105, 'Royal Pier waterfront and Mayflower Park', 'Demo consultation based on the long-running plans to reconnect the city centre with the water at Royal Pier. Ideas include a bigger, better-equipped Mayflower Park, a waterfront walking and cycling route, new homes and leisure space, while keeping the Red Funnel and Town Quay ferry links working. Which parts matter most to you?', 50.8952, -1.4062, 73, 30, '2027-01-15T17:00:00Z'),
(106, 'Southampton Central: northern forecourt and Station Quarter', 'Demo consultation based on the Station Quarter improvements at Southampton Central. The north side of the station gets a new forecourt with better taxi and drop-off space, clearer bus stops, more cycle parking and safer crossings towards the city centre and Shirley.', 50.9077, -1.4140, 64, 9, '2026-11-27T17:00:00Z'),
(107, 'Townhill Park estate regeneration', 'Demo consultation based on the Townhill Park regeneration. Older council blocks would be replaced in phases with new, energy-efficient homes, including council homes, alongside a new community space and greener walking routes. Phasing is planned so existing tenants can move once, into a new home on the estate where possible.', 50.9315, -1.3600, 47, 26, '2026-12-11T17:00:00Z'),
(108, 'Burgess Road cycle lanes and crossings', 'Demo consultation based on Southampton Cycle Network improvements on Burgess Road near the university. The plan adds kerb-separated cycle lanes, upgrades two crossings and moves some bus stops to make room. Some on-street parking near the shops would be removed.', 50.9330, -1.3995, 54, 49, '2026-11-13T17:00:00Z'),
(109, 'Cleaner air on the Western Approach', 'Demo consultation based on Southampton''s clean air plan for the busy routes to the port. Instead of a charging clean air zone, the council has used measures such as cleaner buses, support for taxi drivers to switch to low-emission vehicles and work with the port on lorry emissions. We want views on what to do next along the Western Approach and Millbrook Road.', 50.9110, -1.4250, 47, 22, '2026-10-10T17:00:00Z'),
(110, 'School Streets in Shirley', 'Demo consultation based on the School Streets programme. The road outside a primary school closes to through traffic for about 45 minutes at drop-off and pick-up. Residents, blue badge holders and deliveries to homes on the street can still get through. Should more schools in Shirley join?', 50.9220, -1.4300, 69, 17, '2026-11-30T17:00:00Z'),
(111, 'Weston Shore sea wall and promenade repairs', 'Demo consultation based on coastal works along Weston Shore. Damaged sections of the sea wall would be repaired and raised in places to cope with higher tides, with a resurfaced promenade, new benches and better access down to the beach.', 50.8880, -1.3770, 58, 4, '2026-09-25T17:00:00Z'),
(112, 'Guildhall Square: greener and better for events', 'Demo consultation based on the Cultural Quarter around Guildhall Square, home to MAST Mayflower Studios and the John Hansard Gallery. The proposal adds trees and planters, more seating and shade, and permanent power points so the square is easier to use for markets, screenings and festivals.', 50.9087, -1.4050, 61, 12, '2026-12-18T17:00:00Z')
ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    description = excluded.description,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    closes_at = excluded.closes_at;

INSERT INTO comments (id, event_id, body, user_email, parent_id, likes, dislikes) VALUES
(1, 1, 'Happy to help with the Common clean-up. Will litter pickers be provided?', 'alex@example.com', NULL, 12, 0),
(2, 1, 'Could we include the paths around the Hawthorns? They could use some attention.', NULL, NULL, 8, 1),
(3, 2, 'A puncture repair demo would be really useful for my cycle to Portswood.', 'sam@example.com', NULL, 16, 4),
(4, 2, 'Can beginners bring a bike along for a quick safety check?', NULL, NULL, 11, 6),
(5, 3, 'The Riverside picnic sounds lovely. Are the lawn games suitable for younger children?', 'alex@example.com', NULL, 23, 0),
(6, 3, 'Please share an accessible meeting point near the riverside path.', NULL, NULL, 9, 0),
(7, 4, 'I would love to learn more about the Old Town walls and Tudor House.', 'sam@example.com', NULL, 14, 0),
(8, 4, 'Will the heritage walk include steps, or is there a step-free route?', NULL, NULL, 6, 1),
(9, 5, 'Local acoustic music by Southampton Water sounds like a great afternoon.', 'alex@example.com', NULL, 18, 1),
(10, 5, 'Please leave enough space for people using the waterfront path.', 'sam@example.com', NULL, 10, 0),
(1001, 101, 'Really pleased to see the old shopping centre gone. Seeing the town walls properly from the street is a big improvement.', 'priya.shah@example.com', NULL, 31, 2),
(1002, 101, 'Agreed on the walls, but I worry the new shops will just be more chains. Can some units be kept for local independents?', 'mark.dawson@example.com', 1001, 18, 1),
(1003, 101, 'Good point. Lower rents for the smaller units would help local businesses get in.', 'priya.shah@example.com', 1002, 12, 0),
(1004, 101, 'How many of the new homes are affordable? The city centre needs homes people on normal wages can rent.', NULL, NULL, 22, 3),
(1005, 101, 'Please make sure the new square has proper seating and shade. Too many new squares are just hard paving.', 'dave.holt@example.com', NULL, 15, 1),
(1006, 101, 'Construction traffic on Queensway has been a nightmare. Please publish a timetable for the remaining works.', 'tom.reynolds@example.com', NULL, 9, 4),
(1007, 102, 'As a bus user this has made my commute to the hospital much more reliable. Buses no longer sit in queues outside the shops.', 'jen.okafor@example.com', NULL, 27, 9),
(1008, 102, 'Traffic has just moved onto the side streets. Our road is now a rat run at rush hour and it is not safe for kids.', 'mark.dawson@example.com', NULL, 34, 6),
(1009, 102, 'Same on our street. Could modal filters on the residential roads be part of the scheme rather than an afterthought?', 'lucy.chen@example.com', 1008, 19, 2),
(1010, 102, 'Glad it works for buses, but customers who drive from outside the area have stopped coming to my shop.', 'tom.reynolds@example.com', 1007, 21, 11),
(1011, 102, 'Most people on the Broadway walk, cycle or get the bus though. Wider pavements could bring more footfall.', 'jen.okafor@example.com', 1010, 14, 8),
(1012, 102, 'Signage is confusing. I got a fine on my first day because I did not see the camera sign in time.', NULL, NULL, 25, 3),
(1013, 102, 'Same. A warning letter for first-time drivers instead of a fine would be fairer.', 'raj.patel@example.com', 1012, 17, 1),
(1014, 103, 'I cross twice a day for work. A higher peak toll is a real cost for people in Woolston who have no good alternative.', 'emma.wright@example.com', NULL, 41, 3),
(1015, 103, 'The bridge has to be maintained somehow though. Would you rather it came out of council tax for the whole city?', 'dave.holt@example.com', 1014, 12, 15),
(1016, 103, 'Fair, but the discount should be easy to get, including for people who pay cash and do not have a bank card.', 'emma.wright@example.com', 1015, 20, 0),
(1017, 103, 'Glad walking and cycling stay free. Better bus links over the bridge would mean fewer people need to drive.', 'raj.patel@example.com', NULL, 16, 2),
(1018, 103, 'Neutral on the price, but the toll booths cause queues. Number plate payment would help more than the price change.', NULL, NULL, 13, 1),
(1019, 104, 'The riverside walk along the Itchen is lovely. Please finish it so it links up properly with Woolston centre.', 'lucy.chen@example.com', NULL, 19, 0),
(1020, 104, 'More homes but still no new GP surgery. Local services need to keep up with all this building.', 'tom.reynolds@example.com', NULL, 24, 2),
(1021, 104, 'Yes. Could some of the developer money go towards health services in Woolston?', 'priya.shah@example.com', 1020, 11, 0),
(1022, 104, 'A play area by the water is a great idea, but it needs fencing near the quay edge.', NULL, NULL, 9, 0),
(1023, 105, 'Southampton turns its back on the water. Anything that makes the waterfront usable for everyone gets my vote.', 'dave.holt@example.com', NULL, 29, 3),
(1024, 105, 'Please do not shrink Mayflower Park to make room for flats. It is one of the few open green spaces in the city centre.', 'jen.okafor@example.com', NULL, 33, 2),
(1025, 105, 'Agreed. The park should get bigger, not smaller, if this goes ahead.', 'dave.holt@example.com', 1024, 18, 0),
(1026, 105, 'These plans have been talked about for years. I will believe it when I see it.', 'mark.dawson@example.com', NULL, 15, 5),
(1027, 105, 'Same feeling, but a clear timetable would help rebuild trust.', NULL, 1026, 8, 0),
(1028, 105, 'Keep the ferry and Isle of Wight links easy to reach on foot from the station.', 'raj.patel@example.com', NULL, 12, 0),
(1029, 106, 'The north side of Central is grim at night. Better lighting and a proper drop-off area would make a huge difference.', 'emma.wright@example.com', NULL, 22, 0),
(1030, 106, 'More covered cycle parking please. The current racks are always full.', 'raj.patel@example.com', NULL, 17, 1),
(1031, 106, 'And clearer signs to the right bus stops. Visitors always ask me where to catch the bus to the hospital.', 'lucy.chen@example.com', 1029, 10, 0),
(1032, 106, 'Will taxis still be able to wait here? Drivers need somewhere to queue that does not block the road.', NULL, NULL, 6, 2),
(1033, 107, 'My mum lives on the estate. The new homes look much warmer and cheaper to heat than the old blocks.', 'priya.shah@example.com', NULL, 20, 1),
(1034, 107, 'Residents need a guarantee they can come back to the estate and are not moved across the city.', 'tom.reynolds@example.com', NULL, 26, 0),
(1035, 107, 'Moving only once was a big worry for her too. It needs to be in writing for every household.', 'priya.shah@example.com', 1034, 14, 0),
(1036, 107, 'Replacing homes is fine, but is the total number of council homes going up or down?', 'mark.dawson@example.com', NULL, 18, 2),
(1037, 107, 'Please keep the mature trees along the green. They are what make the estate pleasant.', NULL, NULL, 11, 0),
(1038, 108, 'I cycle to the university every day. Separated lanes on Burgess Road would make it far less scary.', 'raj.patel@example.com', NULL, 24, 6),
(1039, 108, 'Taking out the parking will hurt the small shops at the top of the road. Where are customers meant to stop?', 'dave.holt@example.com', NULL, 21, 9),
(1040, 108, 'Could there be short-stay loading bays instead of losing all the spaces?', 'raj.patel@example.com', 1039, 15, 1),
(1041, 108, 'Most of the shop customers I see are students on foot anyway.', 'lucy.chen@example.com', 1039, 9, 7),
(1042, 108, 'Please time the works for the summer holidays when there is less traffic.', NULL, NULL, 12, 0),
(1043, 108, 'Neutral overall. What matters most is that bus stops still have space to wait safely.', 'emma.wright@example.com', NULL, 7, 0),
(1044, 109, 'Air quality near Millbrook roundabout is awful. Cleaner buses are good but lorries to the port are the main problem.', 'lucy.chen@example.com', NULL, 19, 1),
(1045, 109, 'Glad there is no charging zone. A daily charge would hit people who cannot afford a new car.', 'mark.dawson@example.com', NULL, 22, 6),
(1046, 109, 'Fair, but the people living by the main roads breathe the worst air and are often on lower incomes too.', 'jen.okafor@example.com', 1045, 16, 2),
(1047, 109, 'Please put up public air quality monitors so we can see whether things are actually improving.', NULL, NULL, 14, 0),
(1048, 110, 'Our school started this last year and the morning rush is so much calmer. More children walk and scoot now.', 'emma.wright@example.com', NULL, 26, 2),
(1049, 110, 'I live on a school street and still get people parking across my drive just outside the closure times.', 'tom.reynolds@example.com', NULL, 13, 1),
(1050, 110, 'Enforcement just before and after the closure would help with that.', 'emma.wright@example.com', 1049, 8, 0),
(1051, 110, 'What about parents who have to drive because they go straight on to work? There should be somewhere nearby to drop off.', NULL, NULL, 11, 6),
(1052, 110, 'Some schools have a park-and-stride spot a few minutes away. That could work here.', 'priya.shah@example.com', 1051, 10, 0),
(1053, 111, 'The sea wall really needs this. Parts of the promenade were badly damaged after the winter storms.', 'dave.holt@example.com', NULL, 18, 0),
(1054, 111, 'Please keep the ramps down to the beach step-free. My dad uses a wheelchair and loves it here.', 'lucy.chen@example.com', NULL, 15, 0),
(1055, 111, 'Hope the works avoid the busiest summer weekends.', NULL, NULL, 6, 1),
(1056, 112, 'Trees and seating would make the square so much nicer between shows at MAST and the gallery.', 'jen.okafor@example.com', NULL, 17, 1),
(1057, 112, 'Keep enough open space for big events. The square works because it can fit a crowd.', 'mark.dawson@example.com', NULL, 12, 2),
(1058, 112, 'Movable planters could solve that: greener most of the time, cleared for big events.', 'jen.okafor@example.com', 1057, 14, 0),
(1059, 112, 'Permanent power points are a great idea. The generators at events are noisy and smelly.', NULL, NULL, 9, 0),
(1060, 112, 'Better lighting at night please. It feels unsafe walking through after the theatre.', 'tom.reynolds@example.com', NULL, 11, 0)
ON CONFLICT(id) DO UPDATE SET body = excluded.body, parent_id = excluded.parent_id;
COMMIT;
