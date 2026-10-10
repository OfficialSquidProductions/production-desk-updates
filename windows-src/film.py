"""Local screenplay parsing and USS 1.0.0 construction. No network access."""
import re
import math
import uuid
from datetime import datetime, timezone
import xml.etree.ElementTree as ET

def uid():
    return str(uuid.uuid4())

def now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

CATEGORIES = [(0, "Set"), (1, "INT/EXT"), (2, "Day/Night"), (3, "Script Day"),
              (4, "Unit"), (5, "Sequence"), (6, "Location"), (100, "Cast Members"),
              (101, "Background Actors"), (102, "Stunts"), (103, "Vehicles"),
              (104, "Props"), (105, "Special Effects"), (106, "Wardrobe"),
              (107, "Makeup/Hair"), (108, "Animals"), (109, "Animal Wranglers"),
              (110, "Camera"), (111, "Grip"), (112, "Electric"), (113, "Sound"),
              (114, "Music"), (115, "Art Department"), (116, "Set Dressing"),
              (117, "Greenery"), (118, "Security"), (119, "Special Equipment"),
              (120, "Additional Labor"), (121, "Visual Effects"), (122, "Mechanical Effects"),
              (123, "Notes"), (124, "Comments"), (125, "Miscellaneous"), (126, "Other")]

def empty_project(title="Untitled production"):
    stamp = now()
    calendar = {"id": uid(), "daysOff": [0, 6], "events": [
        {"id": uid(), "type": "start", "date": stamp[:10] + "T12:00:00.000Z", "name": None}],
        "name": "Production calendar"}
    return {"id": uid(), "author": None, "company": None, "created": stamp,
            "description": None, "episode": None, "episodeName": None,
            "name": "Shooting schedule", "project": title, "schedColor": None,
            "schedDate": stamp, "scriptColor": None, "scriptDate": stamp,
            "season": None, "source": "Production Desk — Local Film Scheduler", "ussVersion": "1.0.0",
            "breakdowns": [], "elements": [],
            "categories": [{"id": uid(), "created": stamp, "name": name, "ucid": ucid}
                           for ucid, name in CATEGORIES],
            "stripboards": [{"id": uid(), "name": "Main schedule", "calendar": calendar["id"],
                             "boards": [{"id": uid(), "name": "stripboard", "breakdownIds": []},
                                        {"id": uid(), "name": "boneyard", "breakdownIds": []}]}],
            "calendars": [calendar]}

def element(project, ucid, name):
    name = name.strip()
    category = next(c for c in project["categories"] if c["ucid"] == ucid)
    old = next((e for e in project["elements"] if e["category"] == category["id"]
                and e["name"].casefold() == name.casefold()), None)
    if old:
        return old["id"]
    board_id = str(1 + sum(e["category"] == category["id"] for e in project["elements"])) if ucid == 100 else None
    e = {"id": uid(), "category": category["id"], "created": now(), "name": name,
         "daysOff": [], "dropDayCount": 0, "elementId": board_id, "events": [],
         "isDood": ucid == 100, "isDrop": True, "isHold": True, "isIdLock": False,
         "linkedElements": []}
    project["elements"].append(e)
    return e["id"]

HEADING = re.compile(r"^\s*(?:(\d+[A-Za-z]?)\s+)?\.?(INT\.?\s*/\s*EXT\.?|EXT\.?\s*/\s*INT\.?|I/E\.?|INT\.?|EXT\.?)\s+(.+?)\s*$", re.I)

def parse_heading(line):
    match = HEADING.match(line)
    if not match:
        return None
    number, ie, remainder = match.groups()
    fountain = re.search(r"\s+#([^#]+)#\s*$", remainder)
    if fountain:
        number = fountain.group(1)
        remainder = remainder[:fountain.start()]
    trailing = re.search(r"\s+(\d+[A-Za-z]?)\s*$", remainder)
    if trailing and (number or re.search(r"\b(DAY|NIGHT|DAWN|DUSK)\b", remainder, re.I)):
        number = number or trailing.group(1)
        remainder = remainder[:trailing.start()]
    parts = re.split(r"\s+[-–—]\s+", remainder)
    tod = parts[-1].strip().title() if len(parts) > 1 else "Day"
    setting = " - ".join(parts[:-1]).strip() if len(parts) > 1 else remainder.strip()
    ie = "I/E" if "/" in ie else ie.replace(".", "").upper()
    return number, ie, setting, tod

def parse_script(text, fdx=False):
    records = []
    if fdx:
        if "<!DOCTYPE" in text.upper() or "<!ENTITY" in text.upper():
            raise ValueError("Final Draft files containing XML entities are not supported.")
        try:
            root = ET.fromstring(text)
        except ET.ParseError:
            raise ValueError("This Final Draft file is not valid XML.")
        content = root.find("Content")
        if content is None:
            raise ValueError("No script Content found in this Final Draft file.")
        for p in content.findall("Paragraph"):
            value = "".join("".join(t.itertext()) for t in p.findall("Text")).strip()
            records.append((value, p.get("Type", "Action"), p.get("Number"), None))
    else:
        page = 1
        for line in text.replace("\r", "").split("\n"):
            if "\f" in line:
                page += line.count("\f")
                line = line.replace("\f", "")
            records.append((line.rstrip(), None, None, page))
    scenes = []
    current = None
    for line, kind, explicit_number, page in records:
        heading = parse_heading(line) if kind in (None, "Scene Heading") else None
        if heading:
            number, ie, setting, tod = heading
            current = {"number": explicit_number or number or str(len(scenes) + 1),
                       "ie": ie, "set": setting, "tod": tod, "lines": [line.strip()],
                       "cast": [], "startPage": str(page or "1"), "lineCount": 1}
            scenes.append(current)
        elif current:
            if re.match(r"^\s*\d+\.?\s*$", line) or re.match(r"^\s*(CONTINUED|CONT'D):?\s*$", line):
                continue
            current["lines"].append(line)
            current["lineCount"] += max(1, (len(line) + 59) // 60)
            cue = line.strip()
            is_cue = kind == "Character" or (kind is None and len(cue) < 40 and
                      bool(re.fullmatch(r"[A-Z][A-Z0-9 .()'’\-/]+", cue)) and
                      not cue.endswith((":", ".")) and not cue.startswith(("FADE ", "CUT ", "DISSOLVE ")))
            if is_cue:
                cue = re.sub(r"\s*\([^)]*\)", "", cue).strip()
                if cue and cue not in current["cast"]:
                    current["cast"].append(cue)
    if not scenes:
        raise ValueError("No scene headings found. Use headings such as INT. KITCHEN - DAY, or create scenes manually.")
    return scenes

def import_script(text, filename):
    scenes = parse_script(text, filename.lower().endswith(".fdx"))
    title = re.sub(r"\.[^.]+$", "", filename).replace("_", " ")
    project = empty_project(title)
    project["_scriptFilename"] = filename
    project["_importNotes"] = "Page eighths are estimated from extracted text. Review lengths and cast before scheduling."
    for scene in scenes:
        ids = [element(project, n, scene[k]) for n, k in [(0, "set"), (1, "ie"), (2, "tod")]]
        ids += [element(project, 100, name) for name in scene["cast"]]
        b = {"id": uid(), "bannerText": None, "comments": None, "created": now(),
             "description": "", "elements": ids, "pages": max(.125, round(scene["lineCount"] / 55 * 8) / 8),
             "scene": scene["number"], "scriptPage": scene["startPage"], "duration": 3600000,
             "type": "scene", "_scriptText": "\n".join(scene["lines"]).strip(),
             "_needsReview": True, "_completed": False}
        project["breakdowns"].append(b)
        project["stripboards"][0]["boards"][1]["breakdownIds"].append(b["id"])
    return project

def validate_uss(project):
    """Validate editable USS relationships before accepting imports or saves."""
    if not isinstance(project, dict):
        raise ValueError("USS must contain a universalScheduleStandard object.")
    for key in ["id", "created", "name", "source", "ussVersion"]:
        if not isinstance(project.get(key), str) or not project[key]:
            raise ValueError("Missing USS string: " + key)
    if project["ussVersion"] != "1.0.0":
        raise ValueError("This app supports USS 1.0.0. This file uses " + project["ussVersion"])
    collections = ["breakdowns", "categories", "elements", "stripboards", "calendars"]
    for key in collections:
        if key not in project and key in ("stripboards", "calendars"):
            project[key] = []
        if not isinstance(project.get(key), list):
            raise ValueError("USS " + key + " must be an array.")
    all_ids = set()
    def check_id(obj):
        if not isinstance(obj, dict) or not isinstance(obj.get("id"), str) or not obj["id"]:
            raise ValueError("Every USS object requires a string id.")
        if obj["id"] in all_ids:
            raise ValueError("Duplicate USS id: " + obj["id"])
        all_ids.add(obj["id"])
    check_id(project)
    for key in collections:
        for obj in project[key]:
            check_id(obj)
    cats = {c["id"] for c in project["categories"]}
    elements = {e["id"] for e in project["elements"]}
    breakdowns = {b["id"] for b in project["breakdowns"]}
    calendars = {c["id"] for c in project["calendars"]}
    for c in project["categories"]:
        if not isinstance(c.get("ucid"), int) or not isinstance(c.get("name"), str):
            raise ValueError("Categories require a name and integer ucid.")
    for e in project["elements"]:
        if e.get("category") not in cats or not isinstance(e.get("name"), str):
            raise ValueError("Element has an invalid category or name.")
    for b in project["breakdowns"]:
        if b.get("type") not in ("scene", "banner") or not isinstance(b.get("elements"), list):
            raise ValueError("Invalid breakdown type or elements.")
        if any(e not in elements for e in b["elements"]):
            raise ValueError("Breakdown references an unknown element.")
        if b.get('_stripColor') is not None and (not isinstance(b['_stripColor'], str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', b['_stripColor'])):
            raise ValueError('Strip color must be a six-digit hex color or null.')
        for key in ("pages", "duration"):
            value = b.get(key)
            if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0):
                raise ValueError("Breakdown " + key + " must be a nonnegative number or null.")
    def events_check(events):
        if not isinstance(events, list):
            raise ValueError("Events must be an array.")
        for event in events:
            check_id(event)
            if event.get("type") not in ("start", "dayOff", "event"):
                raise ValueError("Unknown calendar event type.")
            try:
                datetime.fromisoformat(event["date"].replace("Z", "+00:00"))
            except (KeyError, TypeError, ValueError):
                raise ValueError("Invalid event date.")
    for c in project["calendars"] + project["elements"]:
        days = c.get("daysOff", [])
        if not isinstance(days, list) or any(type(d) is not int or d < 0 or d > 6 for d in days) or len(set(days)) != len(days):
            raise ValueError("daysOff must contain distinct weekdays from 0 through 6.")
        events_check(c.get("events") or [])
    for s in project["stripboards"]:
        if s.get("calendar") is not None and s["calendar"] not in calendars:
            raise ValueError("Stripboard references an unknown calendar.")
        if not isinstance(s.get("boards"), list):
            raise ValueError("Stripboard boards must be an array.")
        seen = []
        for b in s["boards"]:
            check_id(b)
            if not isinstance(b.get("breakdownIds"), list):
                raise ValueError("Board breakdownIds must be an array.")
            for group in b["breakdownIds"]:
                ids = group if isinstance(group, list) else [group]
                if any(not isinstance(x, str) or x not in breakdowns for x in ids):
                    raise ValueError("Board references an unknown breakdown.")
                seen.extend(ids)
        if len(seen) != len(set(seen)) or set(seen) != breakdowns:
            raise ValueError("Each scenario must contain every breakdown exactly once across its boards.")
    # Shots are a local extension, not a USS core collection. Validate their scene
    # links as carefully as strips so a damaged backup cannot silently orphan them.
    shots = project.get('_shots', [])
    if not isinstance(shots, list):
        raise ValueError('Shot list must be an array.')
    scene_ids = {b['id'] for b in project['breakdowns'] if b['type'] == 'scene'}
    numbers = set()
    for shot in shots:
        check_id(shot)
        if shot.get('sceneId') not in scene_ids:
            raise ValueError('Shot references an unknown scene.')
        for key in ('number', 'description', 'size', 'movement', 'camera', 'lens', 'equipment', 'notes', 'circleTake'):
            if not isinstance(shot.get(key), str):
                raise ValueError('Shot ' + key + ' must be text.')
        number = shot['number'].strip()
        if not number or len(number) > 24:
            raise ValueError('Shot number must contain 1 through 24 characters.')
        pair = (shot['sceneId'], number.casefold())
        if pair in numbers:
            raise ValueError('Duplicate shot number in the same scene.')
        numbers.add(pair)
        if shot.get('status') not in ('Planned', 'Ready', 'Rolling', 'Done', 'Omitted'):
            raise ValueError('Unknown shot status.')
        if shot.get('priority') not in ('Essential', 'Preferred', 'Optional'):
            raise ValueError('Unknown shot priority.')
        for key, maximum in (('setupMinutes', 1440), ('shootMinutes', 1440), ('actualMinutes', 10080), ('takes', 10000)):
            value = shot.get(key)
            if key == 'actualMinutes' and value is None:
                continue
            if type(value) not in (int, float) or not math.isfinite(value) or value < 0 or value > maximum or value != int(value):
                raise ValueError('Shot ' + key + ' must be a whole number from 0 through ' + str(maximum) + '.')
    settings = project.get('_shotSettings', {'startTime': '07:00'})
    if not isinstance(settings, dict) or not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', str(settings.get('startTime', ''))):
        raise ValueError('Shot start time must use HH:MM.')
    return project
