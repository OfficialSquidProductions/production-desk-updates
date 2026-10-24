"""Synthetic legacy workspace data. Never bundled in shipping apps."""
from film import import_script, element

DEMO = """Title: The Last Light

1 EXT. COASTAL ROAD - DAWN

A battered station wagon follows the coast. The lighthouse is a pin of light in the mist.

MAYA
We should have left yesterday.

ELI
And missed all this?

2 INT. STATION WAGON - DAY

Maya unfolds an old map. A red circle marks the lighthouse.

MAYA
That's where he said he'd be.

ELI
Then that's where we go.

3 EXT. LIGHTHOUSE - DAY

The car rolls to a stop. JONAH waits at the foot of the lighthouse, holding a brass key.

JONAH
I wasn't sure you'd come.

MAYA
Neither was I.

4 INT. LIGHTHOUSE STAIRWELL - DAY

Jonah leads Maya up a winding staircase. She runs a hand along the worn stone.

JONAH
One hundred and twelve steps. Your father counted every morning.

MAYA
Of course he did.

5 INT. LANTERN ROOM - DAY

Eli opens a wooden box. Inside: a letter, a photograph, and a compass.

ELI
This has your name on it.

MAYA
Let me see.

6 EXT. LIGHTHOUSE - DUSK

Maya and Jonah sit on the seawall. The tide comes in below them.

MAYA
How long do you think he waited?

JONAH
As long as he needed to.

7 INT. LANTERN ROOM - NIGHT

Maya turns the brass key. The old mechanism wakes with a low, steady hum.

MAYA
There you are.

8 EXT. COASTAL ROAD - NIGHT

Eli closes the car door. They look back. The lighthouse sweeps across the water.

ELI
Ready?

MAYA
Now I am.
"""


def demo_workspace():
    p = import_script(DEMO, "The Last Light.fountain")
    p["_demo"] = True
    p["_importNotes"] = None
    descriptions = ["Maya and Eli drive toward the lighthouse.", "An old map points to their destination.",
                    "Jonah greets Maya with her father's key.", "Maya retraces her father's morning ritual.",
                    "Eli discovers a letter addressed to Maya.", "Maya and Jonah talk as the tide comes in.",
                    "Maya brings the lighthouse back to life.", "Maya and Eli leave the coast behind."]
    for i, b in enumerate(p["breakdowns"]):
        b["description"] = descriptions[i]
        b["pages"] = [.375, .75, 1.125, .5, 1.25, .875, .625, .375][i]
        b["duration"] = [60, 75, 90, 45, 90, 60, 75, 45][i] * 60000
        b["_needsReview"] = False
        b["elements"].append(element(p, 6, "North coast" if i in (0, 1, 7) else "Point Harbor lighthouse"))
    for i, name in [(1, "Folded road map"), (2, "Brass key"), (4, "Letter"), (4, "Compass"), (6, "Brass key")]:
        p["breakdowns"][i]["elements"].append(element(p, 104, name))
    for i in (0, 1, 7):
        p["breakdowns"][i]["elements"].append(element(p, 103, "Station wagon"))
    ids = [b["id"] for b in p["breakdowns"]]
    p["stripboards"][0]["boards"][0]["breakdownIds"] = [[ids[2], ids[3], ids[4]], [ids[5], ids[6]]]
    p["stripboards"][0]["boards"][1]["breakdownIds"] = [ids[0], ids[1], ids[7]]
    return {"version": 1, "activeProject": p["id"], "projects": [p]}
