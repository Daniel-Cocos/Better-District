"""Builds sql/seed_consultations.sql: Southampton consultations, residents and comment threads.

Run `python sql/consultations.py` after editing, then `python -m app.seed`.

Ids are fixed so re-seeding updates rows instead of duplicating them:
events 101+, comments 1001-1060 (the first threads, already in some databases) and 2001+.
Residents use reserved example domains, so no real person's address is ever used.
Output is deterministic: the same script always writes the same SQL.
"""

from pathlib import Path
import random

OUT = Path(__file__).with_name("seed_consultations.sql")

# Every resident's password is council-demo-2026 (the same hash as alex@example.com)
PASSWORD_HASH = (
    "scrypt$56d40b809ccf705d08af251d99fef69e$96c9abef41b39cf2036283c3128b613f14a9e485b2604ebd66"
    "d3fca43a12a3c3b5a03695634c0d19e53cea98816f583e908302b6f6f6c8e33a64b3ab67c833f7"
)

# The first residents, whose comments 1001-1060 were seeded before this script existed
FIRST_RESIDENTS = [
    "priya.shah",
    "tom.reynolds",
    "jen.okafor",
    "mark.dawson",
    "lucy.chen",
    "dave.holt",
    "emma.wright",
    "raj.patel",
]

FIRST_NAMES = """
Aisha Alan Alice Amara Amir Amy Andrew Anna Ben Beth Callum Carl Charlotte Chloe Chris Claire Dan
Daniel Deborah Dev Ella Ellie Eric Fatima Finn Gemma George Grace Hannah Harry Helen Ian Imran Isla
Jack Jade James Jas Jess Joe Josh Karen Kate Kieran Laura Leah Liam Linda Luke Maria Matt Megan Mia
Mike Mo Nadia Naomi Neil Nina Oliver Olivia Omar Paul Paula Pete Rachel Rebecca Rob Rosie Ruth Ryan
Sarah Sean Simon Sophie Stuart Tanya Tariq Theo Tina Tom Vicky Will Yusuf Zara Zoe
""".split()
LAST_NAMES = """
Adams Ahmed Ali Allen Bailey Baker Barnes Bell Bennett Brooks Brown Butler Campbell Carter Clarke
Collins Cook Cooper Cox Davies Edwards Evans Fisher Foster Green Hall Harris Hill Hughes Hussain
Jackson James Johnson Jones Kaur Kelly Khan King Lee Lewis Marsh Martin Mason Mills Mitchell Moore
Morgan Morris Murphy Nowak Owen Parker Patel Phillips Price Reed Richards Roberts Robinson Rogers
Scott Shaw Singh Smith Stevens Taylor Thomas Turner Walker Ward Watson White Williams Wilson Wood Wright Young
""".split()
DOMAINS = ["example.com", "example.org", "example.net"]
RESIDENT_COUNT = 300

# kind: "real" = a real Southampton scheme or event, described from what is known;
# "typical" = an everyday council service or improvement, not a specific known scheme.
# Each comment: (key, parent key or None, sentiment +1/0/-1, text). Authors are assigned below.
EVENTS = [
    dict(
        id=101,
        kind="real",
        lat=50.9030,
        lng=-1.4040,
        likes=88,
        dislikes=21,
        closes="2026-11-20T17:00:00Z",
        title="Bargate Quarter: new homes, shops and a square by the medieval walls",
        description=(
            "The former Bargate Shopping Centre has been demolished and the site next to the medieval Bargate is being "
            "rebuilt as Bargate Quarter: new homes, shops and places to eat, with views opened up to a stretch of the old "
            "town walls and new walking routes between the High Street and the Old Town. Tell us what would make the new "
            "public spaces work for you."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "Really pleased to see the old shopping centre gone. Seeing the town walls properly from the street is a big improvement.",
            ),
            (
                "b",
                "a",
                0,
                "Agreed on the walls, but I worry the new shops will just be more chains. Can some units be kept for local independents?",
            ),
            (
                "c",
                "b",
                1,
                "Good point. Lower rents for the smaller units would help local businesses get in.",
            ),
            (
                "d",
                None,
                -1,
                "How many of the new homes are affordable? The city centre needs homes people on normal wages can rent.",
            ),
            (
                "e",
                None,
                0,
                "Please make sure the new square has proper seating and shade. Too many new squares are just hard paving.",
            ),
            (
                "f",
                None,
                -1,
                "Construction traffic on Queensway has been a nightmare. Please publish a timetable for the remaining works.",
            ),
        ],
    ),
    dict(
        id=102,
        kind="real",
        lat=50.9250,
        lng=-1.3915,
        likes=41,
        dislikes=63,
        closes="2026-11-08T17:00:00Z",
        title="Portswood Broadway: bus gate and wider pavements",
        description=(
            "The Portswood Broadway scheme, funded through the Transforming Cities Fund, made a short section of Portswood "
            "Road bus, cycle and taxi only, widened the pavements outside the shops and added new crossings, sending through "
            "traffic around the main roads instead. The scheme has divided opinion. We want to hear from shoppers, traders, "
            "bus users and people living on nearby streets about what should happen next."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "As a bus user this has made my commute to the hospital much more reliable. Buses no longer sit in queues outside the shops.",
            ),
            (
                "b",
                None,
                -1,
                "Traffic has just moved onto the side streets. Our road is now a rat run at rush hour and it is not safe for kids.",
            ),
            (
                "c",
                "b",
                -1,
                "Same on our street. Could modal filters on the residential roads be part of the scheme rather than an afterthought?",
            ),
            (
                "d",
                "a",
                -1,
                "Glad it works for buses, but customers who drive from outside the area have stopped coming to my shop.",
            ),
            (
                "e",
                "d",
                1,
                "Most people on the Broadway walk, cycle or get the bus though. Wider pavements could bring more footfall.",
            ),
            (
                "f",
                None,
                -1,
                "Signage is confusing. I got a fine on my first day because I did not see the camera sign in time.",
            ),
            (
                "g",
                "f",
                0,
                "Same. A warning letter for first-time drivers instead of a fine would be fairer.",
            ),
        ],
    ),
    dict(
        id=103,
        kind="real",
        lat=50.8985,
        lng=-1.3880,
        likes=18,
        dislikes=77,
        closes="2026-10-30T17:00:00Z",
        title="Itchen Bridge toll changes",
        description=(
            "Tolls on the Itchen Bridge pay for the upkeep of the bridge. The proposal raises cash tolls for cars at peak "
            "times, with a lower rate for drivers who register for a bridge account. Walking and cycling across the bridge "
            "stays free. Tell us how the change would affect your journeys between Woolston and the city centre."
        ),
        comments=[
            (
                "a",
                None,
                -1,
                "I cross twice a day for work. A higher peak toll is a real cost for people in Woolston who have no good alternative.",
            ),
            (
                "b",
                "a",
                0,
                "The bridge has to be maintained somehow though. Would you rather it came out of council tax for the whole city?",
            ),
            (
                "c",
                "b",
                0,
                "Fair, but the discount should be easy to get, including for people who pay cash and do not have a bank card.",
            ),
            (
                "d",
                None,
                1,
                "Glad walking and cycling stay free. Better bus links over the bridge would mean fewer people need to drive.",
            ),
            (
                "e",
                None,
                0,
                "Neutral on the price, but the toll booths cause queues. Number plate payment would help more than the price change.",
            ),
        ],
    ),
    dict(
        id=104,
        kind="real",
        lat=50.8960,
        lng=-1.3810,
        likes=52,
        dislikes=14,
        closes="2026-12-04T17:00:00Z",
        title="Centenary Quay, Woolston: final riverside phase",
        description=(
            "Centenary Quay is the regeneration of the former Vosper Thornycroft shipyard in Woolston. The last phase would "
            "add more homes, finish the riverside promenade along the Itchen and create a small park and play area by the water."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "The riverside walk along the Itchen is lovely. Please finish it so it links up properly with Woolston centre.",
            ),
            (
                "b",
                None,
                -1,
                "More homes but still no new GP surgery. Local services need to keep up with all this building.",
            ),
            (
                "c",
                "b",
                0,
                "Yes. Could some of the developer money go towards health services in Woolston?",
            ),
            (
                "d",
                None,
                0,
                "A play area by the water is a great idea, but it needs fencing near the quay edge.",
            ),
        ],
    ),
    dict(
        id=105,
        kind="real",
        lat=50.8952,
        lng=-1.4062,
        likes=73,
        dislikes=30,
        closes="2027-01-15T17:00:00Z",
        title="Royal Pier waterfront and Mayflower Park",
        description=(
            "Plans to reconnect the city centre with the water at Royal Pier have been discussed for many years. Ideas include "
            "a bigger, better-equipped Mayflower Park, a waterfront walking and cycling route, new homes and leisure space, "
            "while keeping the Red Funnel and Town Quay ferry links working. Which parts matter most to you?"
        ),
        comments=[
            (
                "a",
                None,
                1,
                "Southampton turns its back on the water. Anything that makes the waterfront usable for everyone gets my vote.",
            ),
            (
                "b",
                None,
                -1,
                "Please do not shrink Mayflower Park to make room for flats. It is one of the few open green spaces in the city centre.",
            ),
            (
                "c",
                "b",
                1,
                "Agreed. The park should get bigger, not smaller, if this goes ahead.",
            ),
            (
                "d",
                None,
                -1,
                "These plans have been talked about for years. I will believe it when I see it.",
            ),
            (
                "e",
                "d",
                0,
                "Same feeling, but a clear timetable would help rebuild trust.",
            ),
            (
                "f",
                None,
                0,
                "Keep the ferry and Isle of Wight links easy to reach on foot from the station.",
            ),
        ],
    ),
    dict(
        id=106,
        kind="real",
        lat=50.9077,
        lng=-1.4140,
        likes=64,
        dislikes=9,
        closes="2026-11-27T17:00:00Z",
        title="Southampton Central: northern forecourt and Station Quarter",
        description=(
            "The Station Quarter improvements at Southampton Central give the north side of the station a new forecourt with "
            "better taxi and drop-off space, clearer bus stops, more cycle parking and safer crossings towards the city centre "
            "and Shirley."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "The north side of Central is grim at night. Better lighting and a proper drop-off area would make a huge difference.",
            ),
            (
                "b",
                None,
                1,
                "More covered cycle parking please. The current racks are always full.",
            ),
            (
                "c",
                "a",
                0,
                "And clearer signs to the right bus stops. Visitors always ask me where to catch the bus to the hospital.",
            ),
            (
                "d",
                None,
                0,
                "Will taxis still be able to wait here? Drivers need somewhere to queue that does not block the road.",
            ),
        ],
    ),
    dict(
        id=107,
        kind="real",
        lat=50.9315,
        lng=-1.3600,
        likes=47,
        dislikes=26,
        closes="2026-12-11T17:00:00Z",
        title="Townhill Park estate regeneration",
        description=(
            "The Townhill Park regeneration replaces older council blocks in phases with new, energy-efficient homes, "
            "including council homes, alongside a new community space and greener walking routes. Phasing is planned so "
            "existing tenants can move once, into a new home on the estate where possible."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "My mum lives on the estate. The new homes look much warmer and cheaper to heat than the old blocks.",
            ),
            (
                "b",
                None,
                -1,
                "Residents need a guarantee they can come back to the estate and are not moved across the city.",
            ),
            (
                "c",
                "b",
                0,
                "Moving only once was a big worry for her too. It needs to be in writing for every household.",
            ),
            (
                "d",
                None,
                -1,
                "Replacing homes is fine, but is the total number of council homes going up or down?",
            ),
            (
                "e",
                None,
                0,
                "Please keep the mature trees along the green. They are what make the estate pleasant.",
            ),
        ],
    ),
    dict(
        id=108,
        kind="real",
        lat=50.9330,
        lng=-1.3995,
        likes=54,
        dislikes=49,
        closes="2026-11-13T17:00:00Z",
        title="Burgess Road cycle lanes and crossings",
        description=(
            "Part of the Southampton Cycle Network: the plan adds kerb-separated cycle lanes on Burgess Road near the "
            "university, upgrades two crossings and moves some bus stops to make room. Some on-street parking near the "
            "shops would be removed."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "I cycle to the university every day. Separated lanes on Burgess Road would make it far less scary.",
            ),
            (
                "b",
                None,
                -1,
                "Taking out the parking will hurt the small shops at the top of the road. Where are customers meant to stop?",
            ),
            (
                "c",
                "b",
                0,
                "Could there be short-stay loading bays instead of losing all the spaces?",
            ),
            (
                "d",
                "b",
                1,
                "Most of the shop customers I see are students on foot anyway.",
            ),
            (
                "e",
                None,
                0,
                "Please time the works for the summer holidays when there is less traffic.",
            ),
            (
                "f",
                None,
                0,
                "Neutral overall. What matters most is that bus stops still have space to wait safely.",
            ),
        ],
    ),
    dict(
        id=109,
        kind="real",
        lat=50.9110,
        lng=-1.4250,
        likes=47,
        dislikes=22,
        closes="2026-10-10T17:00:00Z",
        title="Cleaner air on the Western Approach",
        description=(
            "Southampton chose not to introduce a charging clean air zone. Instead the council has used measures such as "
            "cleaner buses, support for taxi drivers to switch to low-emission vehicles and work with the port on lorry "
            "emissions. We want views on what to do next along the Western Approach and Millbrook Road."
        ),
        comments=[
            (
                "a",
                None,
                -1,
                "Air quality near Millbrook roundabout is awful. Cleaner buses are good but lorries to the port are the main problem.",
            ),
            (
                "b",
                None,
                1,
                "Glad there is no charging zone. A daily charge would hit people who cannot afford a new car.",
            ),
            (
                "c",
                "b",
                0,
                "Fair, but the people living by the main roads breathe the worst air and are often on lower incomes too.",
            ),
            (
                "d",
                None,
                0,
                "Please put up public air quality monitors so we can see whether things are actually improving.",
            ),
        ],
    ),
    dict(
        id=110,
        kind="real",
        lat=50.9220,
        lng=-1.4300,
        likes=69,
        dislikes=17,
        closes="2026-11-30T17:00:00Z",
        title="School Streets in Shirley",
        description=(
            "Under the School Streets programme, the road outside a primary school closes to through traffic for about 45 "
            "minutes at drop-off and pick-up. Residents, blue badge holders and deliveries to homes on the street can still "
            "get through. Should more schools in Shirley join?"
        ),
        comments=[
            (
                "a",
                None,
                1,
                "Our school started this last year and the morning rush is so much calmer. More children walk and scoot now.",
            ),
            (
                "b",
                None,
                -1,
                "I live on a school street and still get people parking across my drive just outside the closure times.",
            ),
            (
                "c",
                "b",
                0,
                "Enforcement just before and after the closure would help with that.",
            ),
            (
                "d",
                None,
                -1,
                "What about parents who have to drive because they go straight on to work? There should be somewhere nearby to drop off.",
            ),
            (
                "e",
                "d",
                1,
                "Some schools have a park-and-stride spot a few minutes away. That could work here.",
            ),
        ],
    ),
    dict(
        id=111,
        kind="typical",
        lat=50.8880,
        lng=-1.3770,
        likes=58,
        dislikes=4,
        closes="2026-09-25T17:00:00Z",
        title="Weston Shore sea wall and promenade repairs",
        description=(
            "Damaged sections of the sea wall along Weston Shore would be repaired and raised in places to cope with higher "
            "tides, with a resurfaced promenade, new benches and better access down to the beach."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "The sea wall really needs this. Parts of the promenade were badly damaged after the winter storms.",
            ),
            (
                "b",
                None,
                0,
                "Please keep the ramps down to the beach step-free. My dad uses a wheelchair and loves it here.",
            ),
            ("c", None, 0, "Hope the works avoid the busiest summer weekends."),
        ],
    ),
    dict(
        id=112,
        kind="real",
        lat=50.9087,
        lng=-1.4050,
        likes=61,
        dislikes=12,
        closes="2026-12-18T17:00:00Z",
        title="Guildhall Square: greener and better for events",
        description=(
            "Guildhall Square sits at the heart of the Cultural Quarter, next to MAST Mayflower Studios and the John Hansard "
            "Gallery. The proposal adds trees and planters, more seating and shade, and permanent power points so the square "
            "is easier to use for markets, screenings and festivals."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "Trees and seating would make the square so much nicer between shows at MAST and the gallery.",
            ),
            (
                "b",
                None,
                0,
                "Keep enough open space for big events. The square works because it can fit a crowd.",
            ),
            (
                "c",
                "b",
                1,
                "Movable planters could solve that: greener most of the time, cleared for big events.",
            ),
            (
                "d",
                None,
                1,
                "Permanent power points are a great idea. The generators at events are noisy and smelly.",
            ),
            (
                "e",
                None,
                -1,
                "Better lighting at night please. It feels unsafe walking through after the theatre.",
            ),
        ],
    ),
    # ---------- added with the larger sample ----------
    dict(
        id=113,
        kind="real",
        lat=50.9095,
        lng=-1.4040,
        likes=96,
        dislikes=18,
        closes="2026-01-31T17:00:00Z",
        title="After the City of Culture 2025 bid: which projects should still go ahead?",
        description=(
            "Southampton reached the final shortlist to be UK City of Culture 2025, alongside Bradford, County Durham and "
            "Wrexham. The title went to Bradford. Many projects planned for the bid could still happen at a smaller scale. "
            "Tell us which ones you would most like to see: festivals, public art, youth programmes or community events."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "Getting onto the shortlist showed what the city can do. Please keep the youth arts programmes going, they were the best part.",
            ),
            (
                "b",
                None,
                -1,
                "Disappointed we lost to Bradford, but I would rather the money went on basics like libraries and parks.",
            ),
            (
                "c",
                "b",
                0,
                "A lot of the funding for culture comes from grants that can only be spent on culture though, not on bins or roads.",
            ),
            (
                "d",
                "c",
                0,
                "Fair enough, I did not know that. Then spread it across neighbourhoods, not just the city centre.",
            ),
            (
                "e",
                None,
                1,
                "Free outdoor events in local parks would reach far more people than ticketed shows.",
            ),
            (
                "f",
                None,
                0,
                "Can we see what was spent on the bid and what we got for it?",
            ),
            (
                "g",
                None,
                1,
                "The bid brought groups together who had never worked with each other. That network is worth keeping.",
            ),
        ],
    ),
    dict(
        id=114,
        kind="real",
        lat=50.8968,
        lng=-1.4080,
        likes=57,
        dislikes=11,
        closes="2026-12-01T17:00:00Z",
        title="Mayflower Memorial and the Western Esplanade",
        description=(
            "The Mayflower sailed from Southampton in 1620, and the city marked the 400th anniversary with Mayflower 400 "
            "events. The memorial on the Western Esplanade sits on a busy road beside the old town walls. The proposal "
            "improves the setting with better crossings, information boards and planting."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "Visitors come specially to see the memorial and then have to dodge traffic. Better crossings are long overdue.",
            ),
            (
                "b",
                None,
                0,
                "Information boards are good, but please include the story of the Wampanoag people as well as the Pilgrims.",
            ),
            (
                "c",
                "b",
                1,
                "Agreed, that was part of the Mayflower 400 programme and it should stay part of the story.",
            ),
            (
                "d",
                None,
                -1,
                "The memorial is fine as it is. Spend the money on fixing the pavements around the walls first.",
            ),
            (
                "e",
                None,
                1,
                "A short heritage trail linking the memorial, the walls and Tudor House would bring tourists further into the Old Town.",
            ),
        ],
    ),
    dict(
        id=115,
        kind="real",
        lat=50.9045,
        lng=-1.4105,
        likes=34,
        dislikes=29,
        closes="2026-12-08T17:00:00Z",
        title="Former Leisure World site, West Quay Road",
        description=(
            "The Leisure World entertainment complex on West Quay Road, once home to a cinema, bowling and nightclubs, has "
            "closed and been cleared. The site is proposed for new homes with ground-floor shops and cafés, and a new walking "
            "route from West Quay Road towards the waterfront."
        ),
        comments=[
            (
                "a",
                None,
                0,
                "Lots of memories of Leisure World, but it had been run down for years. Homes are a sensible use of the site.",
            ),
            (
                "b",
                None,
                -1,
                "West Quay Road is a dual carriageway. It is a noisy, polluted place to put family homes.",
            ),
            (
                "c",
                "b",
                0,
                "Good insulation and homes facing away from the road would help, but it needs designing in from the start.",
            ),
            (
                "d",
                None,
                -1,
                "The city has lost a lot of its evening entertainment. Where are young people supposed to go now?",
            ),
            (
                "e",
                "d",
                1,
                "There is still the cinema and bowling at Watermark and WestQuay, but I take the point about nightlife.",
            ),
            (
                "f",
                None,
                1,
                "A proper crossing over West Quay Road to the waterfront would be the most useful part of this.",
            ),
        ],
    ),
    dict(
        id=116,
        kind="real",
        lat=50.9035,
        lng=-1.4090,
        likes=48,
        dislikes=15,
        closes="2026-11-24T17:00:00Z",
        title="Watermark WestQuay: evening safety and public spaces",
        description=(
            "Watermark WestQuay opened beside the old town walls with a cinema, restaurants and a public plaza. We are asking "
            "how the plaza and the routes to it feel in the evening, and whether lighting, seating or security should change."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "Watermark brought life back to that side of the walls. It is one of the nicer places to eat in town.",
            ),
            (
                "b",
                None,
                -1,
                "The steps and the area behind the cinema feel unsafe late at night. More lighting and a visible warden would help.",
            ),
            (
                "c",
                "b",
                0,
                "Agree on lighting. CCTV signs alone do not make people feel safer.",
            ),
            (
                "d",
                None,
                0,
                "The plaza is great in summer but it is mostly empty in winter. Could there be a winter market or ice rink?",
            ),
            (
                "e",
                None,
                -1,
                "Too many restaurants have closed recently. Empty units make the whole place feel unloved.",
            ),
        ],
    ),
    dict(
        id=117,
        kind="real",
        lat=50.9070,
        lng=-1.3960,
        likes=39,
        dislikes=8,
        closes="2026-12-15T17:00:00Z",
        title="Kingsland Square and market, St Mary's",
        description=(
            "Kingsland Square in St Mary's hosts the Kingsland Market. The proposal improves the square with new paving, "
            "trees, seating and permanent market pitches, and better links to St Mary Street."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "The market is one of the few places where you can still get cheap fresh food in the centre. Anything that helps it is welcome.",
            ),
            (
                "b",
                None,
                0,
                "Please talk to the traders before redesigning the pitches. They know what works.",
            ),
            (
                "c",
                "b",
                1,
                "As a trader I can say we need covered pitches, water and electricity. Pretty paving is less important.",
            ),
            (
                "d",
                None,
                -1,
                "The square has problems with antisocial behaviour in the evenings. A redesign needs to deal with that too.",
            ),
            (
                "e",
                None,
                1,
                "St Mary's has a brilliant mix of independent shops and cafés. This could really show that off.",
            ),
        ],
    ),
    dict(
        id=118,
        kind="real",
        lat=50.8940,
        lng=-1.3925,
        likes=42,
        dislikes=19,
        closes="2026-11-19T17:00:00Z",
        title="Ocean Village waterfront walkway",
        description=(
            "Ocean Village has changed a lot, with the Harbour Hotel, new apartments and the marina. The proposal opens up a "
            "continuous public walkway around the marina edge, with seating and better signs from Canute Road."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "A walkway right round the marina would be lovely. At the moment you keep hitting dead ends and gates.",
            ),
            (
                "b",
                None,
                -1,
                "Ocean Village feels like it was built for people with yachts, not for locals. Make sure it is genuinely public.",
            ),
            (
                "c",
                "b",
                1,
                "Exactly why a public walkway matters. It should be open at all hours, not locked at night.",
            ),
            (
                "d",
                None,
                0,
                "Parking is already hard here. Will people visiting the walkway be expected to drive?",
            ),
            (
                "e",
                "d",
                0,
                "It is a short walk from the city centre and the Itchen Ferry stop. Better signs would help most.",
            ),
        ],
    ),
    dict(
        id=119,
        kind="real",
        lat=50.9455,
        lng=-1.3620,
        likes=37,
        dislikes=58,
        closes="2026-11-06T17:00:00Z",
        title="Southampton Airport runway extension: noise and flight paths",
        description=(
            "An extension to the runway at Southampton Airport was approved by Eastleigh Borough Council in 2021. The airport "
            "sits just outside the city, and residents in Swaythling, Bassett and Townhill Park are under the flight paths. "
            "We want to know how aircraft noise affects you and what monitoring and limits you would like the council to push for."
        ),
        comments=[
            (
                "a",
                None,
                -1,
                "We already hear every take-off in Swaythling. Bigger planes will make it worse, especially early in the morning.",
            ),
            (
                "b",
                None,
                1,
                "Good regional flights mean fewer trips to Heathrow. It is a big employer for the area too.",
            ),
            (
                "c",
                "b",
                -1,
                "Jobs matter, but short flights we could replace with trains are not the future we should be building.",
            ),
            (
                "d",
                "a",
                0,
                "Is there a night-time limit? A clear ban on flights after 11pm would make it easier to accept.",
            ),
            (
                "e",
                None,
                0,
                "Please publish the noise monitoring results online so residents can check them.",
            ),
            (
                "f",
                None,
                -1,
                "The airport is in Eastleigh but we get the noise. Southampton residents should get more of a say.",
            ),
            (
                "g",
                None,
                1,
                "I use the airport for work regularly. Being 10 minutes away is a huge advantage for the city.",
            ),
        ],
    ),
    dict(
        id=120,
        kind="real",
        lat=50.8990,
        lng=-1.4015,
        likes=46,
        dislikes=13,
        closes="2026-12-05T17:00:00Z",
        title="Old Town walls: repairs and better access",
        description=(
            "Southampton's medieval town walls are among the most complete in England. Several sections need stone repairs, "
            "and the proposal also adds better lighting, signs and a step-free route to the walkway on top of the walls where possible."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "The walls are the best thing about Southampton and most people who live here never walk them. Please make them easier to find.",
            ),
            (
                "b",
                None,
                0,
                "Repairs first, then the extras. Some parts look like they are about to fall down.",
            ),
            (
                "c",
                None,
                1,
                "A step-free route would be fantastic. At the moment wheelchair users miss out completely.",
            ),
            (
                "d",
                "c",
                0,
                "It might not be possible everywhere on a medieval wall, but even one accessible section would be a start.",
            ),
            (
                "e",
                None,
                -1,
                "Graffiti and litter along the walls near Bargate are embarrassing. Regular cleaning would make the biggest difference.",
            ),
        ],
    ),
    dict(
        id=121,
        kind="real",
        lat=50.9060,
        lng=-1.4060,
        likes=55,
        dislikes=7,
        closes="2026-12-20T17:00:00Z",
        title="SeaCity Museum: free entry for residents",
        description=(
            "SeaCity Museum in the Civic Centre tells the story of the city and its people, including the crew of the "
            "Titanic, many of whom came from Southampton. The proposal offers free or reduced entry for Southampton residents "
            "and more school visits."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "Free entry for residents is a brilliant idea. A lot of local families have never been inside.",
            ),
            (
                "b",
                None,
                1,
                "The Titanic gallery is really moving, especially the map of where the crew lived. Every Southampton child should see it.",
            ),
            (
                "c",
                None,
                -1,
                "How will this be paid for? Museums are already struggling and I would hate to see opening hours cut instead.",
            ),
            (
                "d",
                "c",
                0,
                "Tourists would still pay full price, and residents spend money in the café and shop.",
            ),
            (
                "e",
                None,
                0,
                "Please extend opening hours at weekends and in the school holidays.",
            ),
        ],
    ),
    dict(
        id=122,
        kind="real",
        lat=50.9090,
        lng=-1.4020,
        likes=28,
        dislikes=6,
        closes="2026-11-26T17:00:00Z",
        title="Hoglands Park skatepark refresh",
        description=(
            "The skatepark in Hoglands Park is one of the best-used spaces for young people in the city centre. The proposal "
            "resurfaces and extends it, adds lighting so it can be used on winter evenings and improves the seating around it."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "I have skated here since I was 12. It is a real community and it deserves the investment.",
            ),
            (
                "b",
                None,
                0,
                "Lights are good, but please set a sensible switch-off time for people living nearby.",
            ),
            ("c", "b", 1, "Agreed, something like 9pm would be fair for everyone."),
            (
                "d",
                None,
                1,
                "Please design it with skaters, BMX riders and scooter kids, not just for them.",
            ),
            (
                "e",
                None,
                -1,
                "The toilets in the park have been closed for ages. Fix those before anything else.",
            ),
        ],
    ),
    dict(
        id=123,
        kind="real",
        lat=50.9395,
        lng=-1.4180,
        likes=44,
        dislikes=10,
        closes="2026-12-09T17:00:00Z",
        title="Southampton Sports Centre, Bassett: track and facilities upgrade",
        description=(
            "Southampton Sports Centre in Bassett has an athletics track, playing fields and the outdoor ski slope. The "
            "proposal resurfaces the track, upgrades the changing rooms and improves bus and cycle links to the site."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "The track is used by clubs and schools from all over the city. It badly needs resurfacing.",
            ),
            (
                "b",
                None,
                -1,
                "The changing rooms are in a terrible state. That should come first.",
            ),
            (
                "c",
                None,
                0,
                "The bus service up to the sports centre is poor in the evenings, which is when most training happens.",
            ),
            (
                "d",
                "c",
                1,
                "Yes, a cycle route along the edge of the Common would help a lot too.",
            ),
            (
                "e",
                None,
                1,
                "Learning to ski on the dry slope here was one of my best childhood memories. Please keep it open.",
            ),
        ],
    ),
    dict(
        id=124,
        kind="real",
        lat=50.9060,
        lng=-1.3910,
        likes=31,
        dislikes=44,
        closes="2026-11-04T17:00:00Z",
        title="Matchday parking controls around St Mary's Stadium",
        description=(
            "On Southampton FC matchdays, streets in Northam, St Mary's and Bevois Valley fill with parked cars. The proposal "
            "extends the matchday permit zone and adds traffic marshals on the busiest roads."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "On matchdays I cannot park anywhere near my own house. A permit zone would be a relief.",
            ),
            (
                "b",
                None,
                -1,
                "Permits cost money and visitors for residents get caught too. It feels like a tax on living near the stadium.",
            ),
            (
                "c",
                "b",
                0,
                "Could the club pay for the permits for residents in the zone? They benefit from the fans.",
            ),
            (
                "d",
                None,
                1,
                "Better park-and-ride and more trains after matches would take the pressure off these streets.",
            ),
            (
                "e",
                None,
                -1,
                "The problem is a few hours a fortnight. Permanent restrictions would be overkill.",
            ),
            (
                "f",
                "e",
                0,
                "It is more than that with midweek cup games and concerts though.",
            ),
        ],
    ),
    dict(
        id=125,
        kind="real",
        lat=50.9105,
        lng=-1.4000,
        likes=38,
        dislikes=33,
        closes="2026-11-17T17:00:00Z",
        title="E-scooter and e-bike rental: should the scheme continue?",
        description=(
            "Southampton has taken part in the national rental e-scooter trials as part of the Solent Future Transport Zone. "
            "We want your views on whether rental e-scooters and e-bikes should stay, where they should be parked and how "
            "pavement riding should be tackled."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "I use a rental scooter to get from the station to work. It has replaced a lot of short taxi trips.",
            ),
            (
                "b",
                None,
                -1,
                "Scooters left across pavements are a hazard. I am partially sighted and have tripped over them twice.",
            ),
            (
                "c",
                "b",
                0,
                "That is awful. Fixed parking bays only, with fines for leaving them anywhere else, would solve most of it.",
            ),
            (
                "d",
                None,
                -1,
                "People still ride them on the pavement on Above Bar. There is no enforcement at all.",
            ),
            (
                "e",
                None,
                1,
                "E-bikes would be even better than scooters for the hills up to Bassett and Shirley.",
            ),
            (
                "f",
                "a",
                0,
                "Same for me, but the price has crept up. It is now nearly as much as the bus.",
            ),
        ],
    ),
    dict(
        id=126,
        kind="typical",
        lat=50.9140,
        lng=-1.4010,
        likes=22,
        dislikes=51,
        closes="2026-11-10T17:00:00Z",
        title="Garden waste collection charge",
        description=(
            "Garden waste is collected through an opt-in subscription. The proposal changes the yearly charge and adds a "
            "reduced rate for households on council tax support. Collections would stay fortnightly from spring to autumn."
        ),
        comments=[
            (
                "a",
                None,
                -1,
                "We already pay council tax for bin collections. Charging extra for garden waste just leads to more fly-tipping.",
            ),
            (
                "b",
                None,
                1,
                "Fair enough that people with big gardens pay for it. Flat owners like me should not subsidise it.",
            ),
            (
                "c",
                "b",
                0,
                "Both fair points. A reduced rate for people on low incomes seems like a reasonable middle ground.",
            ),
            (
                "d",
                None,
                0,
                "Please offer cheaper compost bins as well. Home composting means less to collect.",
            ),
            (
                "e",
                None,
                -1,
                "The collections were missed several times last year. Fix reliability before raising the price.",
            ),
        ],
    ),
    dict(
        id=127,
        kind="real",
        lat=50.9180,
        lng=-1.4090,
        likes=63,
        dislikes=21,
        closes="2026-12-03T17:00:00Z",
        title="Weekly food waste collections",
        description=(
            "Councils in England must start collecting food waste separately every week. Each household would get a small "
            "kitchen caddy and an outdoor bin, collected weekly, and the food waste would be used to make energy and fertiliser."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "Finally. Food waste in the general bin is what makes it smell in summer.",
            ),
            (
                "b",
                None,
                -1,
                "Where are we supposed to put another bin? Our terraced street has no front gardens.",
            ),
            (
                "c",
                "b",
                0,
                "Flats and terraces need a different solution, like shared food bins on the street.",
            ),
            (
                "d",
                None,
                0,
                "Will the general waste collection change as a result? Please be clear about that.",
            ),
            (
                "e",
                None,
                1,
                "Turning food waste into energy is a great idea. Please tell us how much is collected each year.",
            ),
            (
                "f",
                None,
                -1,
                "Foxes and gulls will get into the outdoor bins. They need proper locking lids.",
            ),
        ],
    ),
    dict(
        id=128,
        kind="typical",
        lat=50.9250,
        lng=-1.4180,
        likes=72,
        dislikes=9,
        closes="2026-11-28T17:00:00Z",
        title="Road resurfacing and pothole repairs 2026-27",
        description=(
            "Each year the council chooses which roads to resurface and how to prioritise pothole repairs. Tell us which "
            "roads and pavements near you are in the worst state, and whether cycle lanes and pavements should get a bigger share."
        ),
        comments=[
            (
                "a",
                None,
                -1,
                "Hill Lane is like driving on the moon. The patches keep breaking up within weeks.",
            ),
            (
                "b",
                None,
                -1,
                "The pavements in Shirley are worse than the roads. Elderly neighbours have fallen on the broken slabs.",
            ),
            (
                "c",
                "b",
                0,
                "Pavements should come first. Everyone is a pedestrian at some point.",
            ),
            (
                "d",
                None,
                0,
                "Please fix potholes properly once rather than filling the same hole three times.",
            ),
            (
                "e",
                None,
                1,
                "The resurfacing on Shirley Road last year was done well and quickly. More of that please.",
            ),
            (
                "f",
                None,
                -1,
                "Potholes in the cycle lane on The Avenue are dangerous. Bikes cannot swerve around them like cars can.",
            ),
        ],
    ),
    dict(
        id=129,
        kind="typical",
        lat=50.9135,
        lng=-1.4030,
        likes=19,
        dislikes=66,
        closes="2026-01-20T17:00:00Z",
        title="Budget 2026-27: savings and council tax",
        description=(
            "Like many councils, Southampton faces a large gap between what services cost and the money it receives. The "
            "consultation sets out options for savings, changes to some services and the level of council tax for next year."
        ),
        comments=[
            (
                "a",
                None,
                -1,
                "Council tax keeps going up while services get worse. It is hard to see what we are paying for.",
            ),
            (
                "b",
                None,
                0,
                "Please protect adult social care and children's services. Those are the people with nowhere else to go.",
            ),
            (
                "c",
                "a",
                0,
                "A lot of the budget goes on social care for people who really need it. It is not all waste.",
            ),
            (
                "d",
                None,
                -1,
                "Cutting library hours and bus subsidies hurts the people who can least afford it.",
            ),
            (
                "e",
                None,
                1,
                "I would rather pay a little more than lose youth services completely.",
            ),
            (
                "f",
                None,
                0,
                "Can you publish a simple breakdown of where every pound goes? That would build trust.",
            ),
            (
                "g",
                "f",
                1,
                "Agreed, a one-page summary would help a lot of people understand the choices.",
            ),
        ],
    ),
    dict(
        id=130,
        kind="typical",
        lat=50.9230,
        lng=-1.4320,
        likes=49,
        dislikes=12,
        closes="2026-12-12T17:00:00Z",
        title="Shirley High Street improvements",
        description=(
            "Shirley High Street has a wide mix of shops and cafés. The proposal widens pavements in the busiest section, "
            "plants trees, adds seating and short-stay loading bays, and improves the crossings near the precinct."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "Shirley has a great high street that gets overlooked. Trees and seating would make it much more pleasant.",
            ),
            (
                "b",
                None,
                -1,
                "Fewer parking spaces will drive customers to the out-of-town retail parks.",
            ),
            (
                "c",
                "b",
                0,
                "Most shoppers on Shirley High Street arrive on foot or by bus. Loading bays matter more than parking.",
            ),
            (
                "d",
                None,
                0,
                "Please keep the market days. They bring a lot of people in.",
            ),
            (
                "e",
                None,
                1,
                "Better crossings near the precinct would help. Crossing with a pushchair is stressful at the moment.",
            ),
        ],
    ),
    dict(
        id=131,
        kind="typical",
        lat=50.9180,
        lng=-1.3700,
        likes=36,
        dislikes=14,
        closes="2026-12-02T17:00:00Z",
        title="Bitterne precinct refresh",
        description=(
            "Bitterne precinct has empty units and tired paving. The proposal resurfaces the precinct, adds planting and "
            "lighting, and offers lower-rent pop-up units to local businesses."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "Bitterne precinct used to be busy. Pop-up units for local businesses are a great idea.",
            ),
            (
                "b",
                None,
                -1,
                "New paving will not fix empty shops. Business rates and rents are the real problem.",
            ),
            (
                "c",
                "b",
                0,
                "The council cannot change rates, but it can offer cheaper short leases on units it owns.",
            ),
            (
                "d",
                None,
                0,
                "Please keep the library and the leisure centre at the heart of any plans.",
            ),
            (
                "e",
                None,
                -1,
                "Skateboarders and kids hanging around at night put people off. Better lighting would help.",
            ),
        ],
    ),
    dict(
        id=132,
        kind="typical",
        lat=50.9360,
        lng=-1.4420,
        likes=33,
        dislikes=17,
        closes="2026-11-21T17:00:00Z",
        title="Lordshill district centre: new library and community hub",
        description=(
            "The proposal brings the library, a community hall and health services together in one building at the Lordshill "
            "district centre, with better paths from the surrounding estates and a safer car park."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "Having the library and the GP in one place would be so convenient, especially for older people.",
            ),
            (
                "b",
                None,
                -1,
                "Combining services usually means cutting them. Will the library keep the same opening hours?",
            ),
            (
                "c",
                "b",
                0,
                "That is a fair question. The consultation should say exactly what each service keeps.",
            ),
            (
                "d",
                None,
                1,
                "The community hall is badly needed. Groups currently have nowhere affordable to meet.",
            ),
            ("e", None, 0, "Please keep free parking for library users."),
        ],
    ),
    dict(
        id=133,
        kind="typical",
        lat=50.9115,
        lng=-1.3500,
        likes=40,
        dislikes=22,
        closes="2026-12-10T17:00:00Z",
        title="Thornhill estate: green spaces and play areas",
        description=(
            "The proposal improves the green spaces across the Thornhill estate: new play equipment, a community growing "
            "area, better footpaths and lighting, and more bins."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "The play park near us has had broken swings for two years. New equipment would be very welcome.",
            ),
            (
                "b",
                None,
                1,
                "A community growing area would bring neighbours together. Count me in to help.",
            ),
            (
                "c",
                None,
                -1,
                "Thornhill always seems to be last in the queue. Will this actually happen this time?",
            ),
            (
                "d",
                "c",
                0,
                "Fair concern. A clear timetable with dates would help people trust it.",
            ),
            (
                "e",
                None,
                0,
                "More bins and more frequent emptying please. Litter is the biggest problem on the green.",
            ),
        ],
    ),
    dict(
        id=134,
        kind="typical",
        lat=50.9080,
        lng=-1.4045,
        likes=52,
        dislikes=24,
        closes="2026-12-17T17:00:00Z",
        title="Above Bar Street: a better city centre high street",
        description=(
            "Above Bar Street is the main shopping street between the Bargate and the Civic Centre. The proposal adds "
            "trees, seating and play features, encourages cafés to use outdoor space and makes it easier to cross between "
            "the shops and the parks."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "Above Bar has so much potential with the parks right next to it. Cafés with outdoor seating would really help.",
            ),
            (
                "b",
                None,
                -1,
                "Too many empty shops and charity shops. Benches will not bring the big shops back.",
            ),
            (
                "c",
                "b",
                0,
                "The big shops are not coming back anywhere. Making it a nice place to spend time is the realistic plan.",
            ),
            (
                "d",
                None,
                -1,
                "Cyclists and e-scooters speeding through the pedestrian area are a real problem.",
            ),
            (
                "e",
                None,
                1,
                "Play features would give families a reason to come into town. Great idea.",
            ),
            (
                "f",
                None,
                0,
                "Please keep enough space for the Christmas market and other events.",
            ),
        ],
    ),
    dict(
        id=135,
        kind="typical",
        lat=50.9150,
        lng=-1.4380,
        likes=35,
        dislikes=20,
        closes="2026-12-07T17:00:00Z",
        title="Electric vehicle chargers on residential streets",
        description=(
            "Many homes in Southampton have no driveway. The proposal installs on-street chargers in lamp posts and "
            "dedicated bays across Shirley, Freemantle, Portswood and Bitterne, chosen with residents."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "I would get an electric car tomorrow if I could charge it on my street. This is exactly what is needed.",
            ),
            (
                "b",
                None,
                -1,
                "Taking parking bays for EVs only will make parking even harder for everyone else.",
            ),
            (
                "c",
                "b",
                0,
                "Lamp post chargers do not take a dedicated bay, which seems like a fair compromise.",
            ),
            (
                "d",
                None,
                0,
                "Cables across the pavement are a trip hazard. Please use cable channels.",
            ),
            (
                "e",
                None,
                1,
                "Please keep the charging price fair. Public chargers are much dearer than charging at home.",
            ),
        ],
    ),
    dict(
        id=136,
        kind="real",
        lat=50.9300,
        lng=-1.3960,
        likes=29,
        dislikes=42,
        closes="2026-11-12T17:00:00Z",
        title="Bus route changes: evening and Sunday services",
        description=(
            "Bus operators in the city, including Bluestar, First and the Unilink services, are reviewing evening and Sunday "
            "timetables. The council can support some routes. Tell us which journeys you rely on and where gaps in the "
            "network cause you problems."
        ),
        comments=[
            (
                "a",
                None,
                -1,
                "The last bus to Thornhill is far too early. Shift workers at the hospital have no way home.",
            ),
            (
                "b",
                None,
                1,
                "Unilink is brilliant and not just for students. More routes like that please.",
            ),
            (
                "c",
                None,
                -1,
                "Sunday services are so infrequent that it is quicker to walk. That is why people drive.",
            ),
            (
                "d",
                "c",
                0,
                "If more people used them on Sundays the operators would run more. It is a chicken and egg problem.",
            ),
            (
                "e",
                None,
                0,
                "Live bus times at more stops would make a big difference even without more buses.",
            ),
            ("f", "a", -1, "Same for Weston. After 7pm you are on your own."),
        ],
    ),
    dict(
        id=137,
        kind="typical",
        lat=50.9285,
        lng=-1.4120,
        likes=47,
        dislikes=26,
        closes="2026-11-25T17:00:00Z",
        title="The Avenue: safer cycling past the Common",
        description=(
            "The Avenue is one of the main routes into the city past Southampton Common. The proposal upgrades the existing "
            "cycle lanes with kerb separation, improves the junctions at Highfield Lane and Bassett Avenue, and keeps the "
            "bus lanes."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "Painted lanes on The Avenue are terrifying with buses passing so close. Kerb separation is the only thing that works.",
            ),
            (
                "b",
                None,
                -1,
                "The Avenue is already congested at rush hour. Narrowing the traffic lanes will make it worse.",
            ),
            (
                "c",
                "b",
                0,
                "The plan keeps the traffic and bus lanes, it just separates the cycle lane properly.",
            ),
            (
                "d",
                None,
                0,
                "Please protect the trees along the Common side. They are part of what makes The Avenue special.",
            ),
            (
                "e",
                None,
                1,
                "My kids could cycle to school safely if this was done. At the moment I would never let them.",
            ),
        ],
    ),
    dict(
        id=138,
        kind="typical",
        lat=50.9265,
        lng=-1.4100,
        likes=81,
        dislikes=6,
        closes="2026-12-14T17:00:00Z",
        title="Southampton Common: lakes, paths and wildlife areas",
        description=(
            "Southampton Common is a large open space and nature area in the north of the city. The proposal cleans and "
            "restores the boating lake and Ornamental Lake, repairs the main paths, adds benches and protects wildflower areas."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "The Common is the best thing about living in Southampton. Restoring the lakes would be wonderful.",
            ),
            (
                "b",
                None,
                0,
                "Repair the paths but please do not tarmac everything. The muddy trails are part of its charm.",
            ),
            (
                "c",
                "b",
                0,
                "Main paths need to work for wheelchairs and pushchairs though. Side trails can stay wild.",
            ),
            (
                "d",
                None,
                1,
                "Protecting the wildflower areas is great. The bees and butterflies have really come back.",
            ),
            (
                "e",
                None,
                -1,
                "Dog mess and litter by the cafe are getting worse. More bins and enforcement please.",
            ),
            (
                "f",
                None,
                1,
                "The Hawthorns centre does great work with schools. Please make sure it is part of this.",
            ),
        ],
    ),
    dict(
        id=139,
        kind="typical",
        lat=50.9175,
        lng=-1.4455,
        likes=54,
        dislikes=5,
        closes="2026-12-06T17:00:00Z",
        title="Flood defences along the River Test at Millbrook and Redbridge",
        description=(
            "Low-lying areas near the River Test at Millbrook and Redbridge are at growing risk of tidal flooding. The "
            "proposal raises flood walls and embankments and improves drainage, working with the Environment Agency."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "Our street flooded in a high tide a few winters ago. Please get on with this.",
            ),
            (
                "b",
                None,
                0,
                "Please keep the riverside paths open during construction where possible.",
            ),
            (
                "c",
                None,
                0,
                "Will this affect house insurance in the area? Clear information would help residents a lot.",
            ),
            (
                "d",
                None,
                1,
                "Good to see the council planning ahead for sea level rise rather than waiting for a disaster.",
            ),
        ],
    ),
    dict(
        id=140,
        kind="typical",
        lat=50.9175,
        lng=-1.3960,
        likes=58,
        dislikes=10,
        closes="2026-11-29T17:00:00Z",
        title="Tackling fly-tipping in Bevois Valley and Portswood",
        description=(
            "Fly-tipping is a growing problem in back alleys and on side streets in Bevois Valley and Portswood. The "
            "proposal adds mobile CCTV at hotspots, bulky waste amnesty days and faster clearance."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "The alley behind our road is used as a tip every week. Cameras would help catch the people doing it.",
            ),
            (
                "b",
                None,
                0,
                "A lot of it happens at the end of student tenancies. Landlords should be made responsible.",
            ),
            (
                "c",
                "b",
                1,
                "Free collection days in June when tenancies end would stop most of it.",
            ),
            (
                "d",
                None,
                -1,
                "The bulky waste collection charge is too high. That is why people dump things.",
            ),
            (
                "e",
                None,
                0,
                "Please report back how many people are actually fined. Cameras only work if there is follow-up.",
            ),
        ],
    ),
    dict(
        id=141,
        kind="typical",
        lat=50.9245,
        lng=-1.3800,
        likes=33,
        dislikes=11,
        closes="2026-12-16T17:00:00Z",
        title="Cobden Bridge and Bitterne Park Triangle",
        description=(
            "Cobden Bridge links Bitterne Park and Portswood across the River Itchen. The proposal repairs the bridge, "
            "widens the pavement on one side and makes the junction at the Bitterne Park Triangle safer for people walking and cycling."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "The Triangle is a lovely little local centre. A safer junction would make it much nicer to walk to.",
            ),
            (
                "b",
                None,
                -1,
                "Closing the bridge for repairs will cause chaos. Please keep at least one lane open.",
            ),
            (
                "c",
                "b",
                0,
                "It needs doing though. Better to plan it well than to wait for a weight limit.",
            ),
            (
                "d",
                None,
                0,
                "The pavement on the bridge is too narrow for a pushchair and a bike to pass. Widening it is a good idea.",
            ),
        ],
    ),
    dict(
        id=142,
        kind="typical",
        lat=50.9135,
        lng=-1.3900,
        likes=26,
        dislikes=31,
        closes="2026-11-23T17:00:00Z",
        title="Northam Bridge refurbishment and weight limit",
        description=(
            "Northam Bridge carries traffic across the Itchen between Northam and Bitterne. The proposal strengthens the "
            "bridge and introduces a temporary weight limit and lane closures while the work is done."
        ),
        comments=[
            (
                "a",
                None,
                -1,
                "Northam Bridge is already a bottleneck. Lane closures will push even more traffic onto the Itchen Bridge.",
            ),
            (
                "b",
                None,
                0,
                "Please do the noisiest work during the day, not overnight. People live right next to the bridge.",
            ),
            (
                "c",
                None,
                1,
                "Better to fix it now than have it closed in an emergency like other bridges around the country.",
            ),
            (
                "d",
                "a",
                0,
                "Could the Itchen Bridge toll be suspended while the works are on? That would spread the traffic.",
            ),
        ],
    ),
    dict(
        id=143,
        kind="real",
        lat=50.8975,
        lng=-1.4048,
        likes=44,
        dislikes=4,
        closes="2026-12-19T17:00:00Z",
        title="Tudor House and Garden: longer opening and community events",
        description=(
            "Tudor House and Garden is one of Southampton's oldest buildings, in the heart of the Old Town. The proposal "
            "extends opening hours, hosts more community events in the garden and improves step-free access."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "The garden is a hidden gem. Summer evening events there would be magical.",
            ),
            (
                "b",
                None,
                0,
                "Step-free access is important but please be careful with the historic building.",
            ),
            (
                "c",
                None,
                1,
                "Free entry days for residents would be lovely. A lot of people have never been in.",
            ),
            (
                "d",
                "c",
                1,
                "Agreed, I only went for the first time last year and could not believe I had missed it.",
            ),
        ],
    ),
    dict(
        id=144,
        kind="typical",
        lat=50.9325,
        lng=-1.3900,
        likes=21,
        dislikes=37,
        closes="2026-11-16T17:00:00Z",
        title="Houses in multiple occupation: tighter rules in Portswood and Highfield",
        description=(
            "Portswood, Highfield and Swaythling have a high number of shared houses, many let to students. The proposal "
            "tightens planning controls on new houses in multiple occupation and adds licensing standards for landlords."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "Whole streets have become student lets and families have been priced out. Controls are long overdue.",
            ),
            (
                "b",
                None,
                -1,
                "Students are part of the city and bring a lot of money. Blaming them for everything is unfair.",
            ),
            (
                "c",
                "b",
                0,
                "It is not about blaming students, it is about balance and making landlords look after their properties.",
            ),
            (
                "d",
                None,
                -1,
                "Tighter rules will just push up rents for the young workers who also live in shared houses.",
            ),
            (
                "e",
                None,
                0,
                "Licensing should focus on safety: fire doors, damp and mould. That protects tenants too.",
            ),
            (
                "f",
                "a",
                1,
                "Our road went from mostly families to mostly student lets in ten years. It feels very different now.",
            ),
        ],
    ),
    dict(
        id=145,
        kind="real",
        lat=50.9010,
        lng=-1.4015,
        likes=43,
        dislikes=9,
        closes="2026-12-21T17:00:00Z",
        title="Bargate and Hanover Buildings: safer crossings and fewer buses",
        description=(
            "Buses still run past the medieval Bargate along Hanover Buildings and Vincent's Walk. The proposal moves some "
            "bus stops to reduce crowding, adds a wider crossing between Above Bar and the High Street and protects the "
            "Bargate from vehicle damage."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "Crossing by the Bargate with buses everywhere is chaotic. A wider crossing would really help.",
            ),
            (
                "b",
                None,
                -1,
                "Moving bus stops further away is hard for older people. Please keep them close to the shops.",
            ),
            (
                "c",
                "b",
                0,
                "Maybe a few stops could move but not all of them. Accessibility has to come first.",
            ),
            (
                "d",
                None,
                1,
                "The Bargate is 800 years old and buses brush past it. It deserves better protection.",
            ),
        ],
    ),
    dict(
        id=146,
        kind="typical",
        lat=50.9035,
        lng=-1.4400,
        likes=39,
        dislikes=16,
        closes="2026-12-13T17:00:00Z",
        title="Millbrook and Redbridge: safer walking routes to schools",
        description=(
            "Children in Millbrook and Redbridge have to cross busy roads to reach school. The proposal adds new crossings, "
            "wider footpaths and a 20mph limit on residential streets around the schools."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "My children cross Millbrook Road every day. A proper crossing near the school is desperately needed.",
            ),
            (
                "b",
                None,
                0,
                "A 20mph limit only works if it is enforced. Please add speed cameras or humps.",
            ),
            (
                "c",
                "b",
                -1,
                "Speed humps damage cars and slow down ambulances. Cameras would be better.",
            ),
            (
                "d",
                None,
                1,
                "Wider footpaths will help so many families walk instead of drive to school.",
            ),
        ],
    ),
    dict(
        id=147,
        kind="typical",
        lat=50.9050,
        lng=-1.4030,
        likes=67,
        dislikes=8,
        closes="2026-12-22T17:00:00Z",
        title="Public toilets in the city centre",
        description=(
            "Several public toilets in the city centre and parks have closed or have limited hours. The proposal reopens "
            "toilets in key parks, adds a community toilet scheme with local businesses and improves signage."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "This makes such a difference for older people, families with young children and anyone with a medical condition.",
            ),
            (
                "b",
                None,
                1,
                "A community toilet scheme is clever. Cafés get footfall and people get somewhere to go.",
            ),
            (
                "c",
                None,
                -1,
                "The old ones were closed because of vandalism. What will be different this time?",
            ),
            (
                "d",
                "c",
                0,
                "Staffed or attended toilets in the busiest parks would deal with that.",
            ),
            (
                "e",
                None,
                0,
                "Please include changing places toilets for disabled adults.",
            ),
        ],
    ),
    dict(
        id=148,
        kind="typical",
        lat=50.9200,
        lng=-1.4250,
        likes=31,
        dislikes=19,
        closes="2026-11-18T17:00:00Z",
        title="Street trees: planting 1,000 more across the city",
        description=(
            "The proposal plants more street trees across the city, prioritising areas with the fewest trees and the "
            "hottest streets in summer. Residents can request a tree outside their home."
        ),
        comments=[
            (
                "a",
                None,
                1,
                "Our street has no trees at all and is baking hot in summer. I would love one outside my house.",
            ),
            (
                "b",
                None,
                -1,
                "Tree roots lift the pavements and the leaves block the drains. Who will maintain them?",
            ),
            (
                "c",
                "b",
                0,
                "Choosing the right species and watering them for the first few years makes a big difference.",
            ),
            (
                "d",
                None,
                1,
                "Prioritising the areas with the fewest trees is the right call. It is not fair that some neighbourhoods have so many fewer.",
            ),
            (
                "e",
                None,
                0,
                "Please replace the trees that have died before planting new ones.",
            ),
        ],
    ),
]

# Short reactions people leave on most posts, used to give each thread realistic volume
REACTIONS = {
    1: [
        "Fully support this.",
        "Great idea, about time.",
        "This would make a real difference to our area.",
        "Really pleased to see this being considered.",
        "Yes please, the sooner the better.",
        "Good to see the council asking residents first.",
        "This gets my vote.",
        "Long overdue, well done.",
        "I think this is a positive step for the city.",
        "Brilliant, my family would use this a lot.",
        "Support this as long as it is done properly.",
        "Would love to see this happen.",
        "Southampton needs more of this kind of thing.",
        "Strongly in favour.",
        "Happy with this plan overall.",
        "This is exactly what the area needs.",
    ],
    0: [
        "Can we see a timeline for this?",
        "How much will this cost?",
        "Who will look after it once it is done?",
        "Not sure yet, would like more detail.",
        "Will there be a drop-in session to ask questions?",
        "What happens during the construction period?",
        "Is this funded already or does it depend on a grant?",
        "Could you share the plans as a map?",
        "Interested to hear what others think.",
        "Depends on the details. Happy to see more information.",
        "Will local businesses be consulted directly?",
        "How will you measure whether it has worked?",
        "Please make sure this is accessible for disabled people.",
        "Is there a public meeting about this?",
        "Has this worked in other cities?",
    ],
    -1: [
        "Not convinced this is a good use of money.",
        "Fix the basics first.",
        "We were not properly consulted on this.",
        "This will cause more problems than it solves.",
        "I am against this.",
        "Waste of money in my opinion.",
        "The council never listens anyway.",
        "This will make traffic worse.",
        "Seems rushed. Please think again.",
        "Not needed. Spend it on something else.",
        "There are far more urgent problems in the city.",
        "I do not see who benefits from this.",
        "Strongly against.",
        "Previous schemes like this were a mess.",
        "Too expensive for what it is.",
    ],
}


def q(value):
    """A SQL literal, with quotes escaped."""
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return repr(value)
    return "'" + str(value).replace("'", "''") + "'"


def residents(rng: random.Random) -> list[str]:
    """The first eight residents, then generated names on reserved example domains."""
    emails = [f"{name}@example.com" for name in FIRST_RESIDENTS]
    seen = set(emails)
    while len(emails) < RESIDENT_COUNT:
        first, last = rng.choice(FIRST_NAMES).lower(), rng.choice(LAST_NAMES).lower()
        local = rng.choice(
            [
                f"{first}.{last}",
                f"{first}{last}",
                f"{first[0]}{last}",
                f"{first}.{last}{rng.randint(1, 99)}",
            ]
        )
        email = f"{local}@{rng.choice(DOMAINS)}"
        if email not in seen:
            seen.add(email)
            emails.append(email)
    return emails


def votes(rng: random.Random, sentiment: int) -> tuple[int, int]:
    """Likes and dislikes for a comment: strong opinions attract more of both."""
    if sentiment == 1:
        return rng.randint(3, 45), rng.randint(0, 8)
    if sentiment == -1:
        return rng.randint(2, 40), rng.randint(0, 14)
    return rng.randint(1, 20), rng.randint(0, 4)


def build() -> tuple[str, dict]:
    rng = random.Random(2026)
    emails = residents(rng)
    # The first 60 comments keep their original authors, so earlier databases stay consistent
    first_authors = iter(
        [
            "priya.shah",
            "mark.dawson",
            "priya.shah",
            None,
            "dave.holt",
            "tom.reynolds",
            "jen.okafor",
            "mark.dawson",
            "lucy.chen",
            "tom.reynolds",
            "jen.okafor",
            None,
            "raj.patel",
            "emma.wright",
            "dave.holt",
            "emma.wright",
            "raj.patel",
            None,
            "lucy.chen",
            "tom.reynolds",
            "priya.shah",
            None,
            "dave.holt",
            "jen.okafor",
            "dave.holt",
            "mark.dawson",
            None,
            "raj.patel",
            "emma.wright",
            "raj.patel",
            "lucy.chen",
            None,
            "priya.shah",
            "tom.reynolds",
            "priya.shah",
            "mark.dawson",
            None,
            "raj.patel",
            "dave.holt",
            "raj.patel",
            "lucy.chen",
            None,
            "emma.wright",
            "lucy.chen",
            "mark.dawson",
            "jen.okafor",
            None,
            "emma.wright",
            "tom.reynolds",
            "emma.wright",
            None,
            "priya.shah",
            "dave.holt",
            "lucy.chen",
            None,
            "jen.okafor",
            "mark.dawson",
            "jen.okafor",
            None,
            "tom.reynolds",
        ]
    )
    # The original 60 comments' votes, unchanged
    first_votes = iter(
        [
            (31, 2),
            (18, 1),
            (12, 0),
            (22, 3),
            (15, 1),
            (9, 4),
            (27, 9),
            (34, 6),
            (19, 2),
            (21, 11),
            (14, 8),
            (25, 3),
            (17, 1),
            (41, 3),
            (12, 15),
            (20, 0),
            (16, 2),
            (13, 1),
            (19, 0),
            (24, 2),
            (11, 0),
            (9, 0),
            (29, 3),
            (33, 2),
            (18, 0),
            (15, 5),
            (8, 0),
            (12, 0),
            (22, 0),
            (17, 1),
            (10, 0),
            (6, 2),
            (20, 1),
            (26, 0),
            (14, 0),
            (18, 2),
            (11, 0),
            (24, 6),
            (21, 9),
            (15, 1),
            (9, 7),
            (12, 0),
            (7, 0),
            (19, 1),
            (22, 6),
            (16, 2),
            (14, 0),
            (26, 2),
            (13, 1),
            (8, 0),
            (11, 6),
            (10, 0),
            (18, 0),
            (15, 0),
            (6, 1),
            (17, 1),
            (12, 2),
            (14, 0),
            (9, 0),
            (11, 0),
        ]
    )

    rows, original_id, extra_id = [], 1001, 2001
    stats = {"comments": 0, "replies": 0, "anonymous": 0}
    for event in EVENTS:
        written = {}  # key -> (id, author)
        original = event["id"] <= 112
        for key, parent, sentiment, body in event["comments"]:
            if original:
                comment_id, original_id = original_id, original_id + 1
                local = next(first_authors)
                author = local and f"{local}@example.com"
                likes, dislikes = next(first_votes)
            else:
                comment_id, extra_id = extra_id, extra_id + 1
                parent_author = written[parent][1] if parent else None
                author = (
                    None
                    if rng.random() < 0.18
                    else rng.choice([e for e in emails if e != parent_author])
                )
                likes, dislikes = votes(rng, sentiment)
            written[key] = (comment_id, author)
            rows.append(
                (
                    comment_id,
                    event["id"],
                    body,
                    author,
                    written[parent][0] if parent else None,
                    likes,
                    dislikes,
                )
            )

        # Short reactions, weighted towards the post's overall mood, some replying to a thread
        mood = event["likes"] / (event["likes"] + event["dislikes"])
        threads = [cid for cid, _ in written.values()]
        for _ in range(rng.randint(5, 9)):
            roll = rng.random()
            sentiment = (
                1
                if roll < mood * 0.8
                else (-1 if roll > 0.85 - (1 - mood) * 0.3 else 0)
            )
            body = rng.choice(REACTIONS[sentiment])
            parent = rng.choice(threads) if rng.random() < 0.3 else None
            author = None if rng.random() < 0.18 else rng.choice(emails)
            likes, dislikes = votes(rng, sentiment)
            rows.append(
                (
                    extra_id,
                    event["id"],
                    body,
                    author,
                    parent,
                    max(0, likes // 3),
                    dislikes // 3,
                )
            )
            extra_id += 1

    for row in rows:
        stats["comments"] += 1
        stats["replies"] += row[4] is not None
        stats["anonymous"] += row[3] is None

    lines = [
        "-- Generated by sql/consultations.py; edit that file and re-run it instead of editing this one.",
        "-- Southampton consultations with resident comments, for local development and AI-summary testing.",
        "-- Residents are generated sample accounts on reserved example domains (password council-demo-2026).",
        "PRAGMA foreign_keys = ON;",
        "BEGIN;",
        "INSERT INTO users (email, password_hash) VALUES",
        ",\n".join(f"({q(email)}, {q(PASSWORD_HASH)})" for email in emails),
        "ON CONFLICT DO NOTHING;",
        "",
        "INSERT INTO events (id, title, description, latitude, longitude, likes, dislikes, closes_at) VALUES",
        ",\n".join(
            f"({e['id']}, {q(e['title'])}, {q(e['description'])}, {e['lat']:.4f}, {e['lng']:.4f}, "
            f"{e['likes']}, {e['dislikes']}, {q(e['closes'])})"
            for e in EVENTS
        ),
        "ON CONFLICT(id) DO UPDATE SET",
        "    title = excluded.title,",
        "    description = excluded.description,",
        "    latitude = excluded.latitude,",
        "    longitude = excluded.longitude,",
        "    closes_at = excluded.closes_at;",
        "",
        "INSERT INTO comments (id, event_id, body, user_email, parent_id, likes, dislikes) VALUES",
        ",\n".join(f"({', '.join(q(v) for v in row)})" for row in rows),
        "ON CONFLICT(id) DO UPDATE SET body = excluded.body, parent_id = excluded.parent_id;",
        "COMMIT;",
        "",
    ]
    stats["events"], stats["residents"] = len(EVENTS), len(emails)
    return "\n".join(lines), stats


if __name__ == "__main__":
    sql, stats = build()
    OUT.write_text(sql, encoding="utf-8")
    print(f"Wrote {OUT.name}: {stats}")
