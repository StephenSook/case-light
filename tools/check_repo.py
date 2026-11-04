"""Repository checks for Case Light, run in CI on every push (python3 tools/check_repo.py).

Every check FAILS rather than skips: a missing file is an error, and each scan reports how many files it read.
"""
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LEAF_FLOOR = 17
FAILURES = []


def fail(msg):
    FAILURES.append(msg)
    print("FAIL:", msg)


def tracked_files():
    out = subprocess.run(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=ROOT, capture_output=True, check=True).stdout
    return [p for p in out.decode().split("\0") if p]


def lens_version():
    """The version the Lens shows and logs, read from CaseLightVersion.ts (the one source)."""
    path = ROOT / "Assets" / "Scripts" / "CaseLightVersion.ts"
    if not path.is_file():
        fail("Assets/Scripts/CaseLightVersion.ts missing")
        return None
    m = re.search(r'CASELIGHT_VERSION\s*=\s*"(v\d+\.\d+(?:\.\d+)?)"', path.read_text())
    if not m:
        fail("CaseLightVersion.ts: no CASELIGHT_VERSION string found")
        return None
    return m.group(1)


def leaf_scenarios():
    ids = set()
    files = list((ROOT / "Assets").rglob("*.ts"))
    for f in files:
        ids.update(re.findall(r'id:\s*"((?:c\d+|extra)-[a-z0-9-]+)"', f.read_text(errors="ignore")))
    print(f"LEAF: {len(ids)} scenarios in {len(files)} TypeScript files")
    if len(files) < 20:
        fail(f"read only {len(files)} TypeScript files; expected the whole Assets tree")
    return sorted(ids)


# Both practice routes: file, OpenStreetMap source box, hold letter. Route 1 is the v0.5 route, unchanged.
ROUTES = [
    ("Route 1", "case_light_route_osm.json", "-84.600,34.028,-84.578,34.050", "3553 FREY LAKE RD"),
    ("Route 2", "case_light_route_osm_b.json", "-84.622,34.028,-84.600,34.050", "3053 SHIRLEY DR"),
]
MAX_STREET_LABEL = 12
MAX_ADDRESS = 17


def check_routes():
    attribution = ROOT / "data" / "ATTRIBUTION.md"
    if not attribution.exists():
        fail("data/ATTRIBUTION.md missing")
    attribution_text = attribution.read_text() if attribution.exists() else ""
    loaded = []
    for name, filename, bbox, hold_address in ROUTES:
        route = ROOT / "data" / filename
        if not route.exists():
            fail(f"data/{filename} missing ({name})")
            continue
        d = json.loads(route.read_text())
        loaded.append((name, d))
        if "openstreetmap.org/copyright" not in d.get("attribution", ""):
            fail(f"{name}: route data lacks the OpenStreetMap attribution")
        if bbox not in d.get("source", ""):
            fail(f"{name}: source does not name the box {bbox}")
        if bbox not in attribution_text or filename not in attribution_text:
            fail(f"{name}: data/ATTRIBUTION.md does not name {filename} and its box {bbox}")
        slots = [c["slot"] for c in d["cells"]]
        if any(36 <= s <= 39 for s in slots):
            fail(f"{name}: a street address sits in the HOLD block")
        if len(slots) != len(set(slots)):
            fail(f"{name}: a separation is used twice")
        numbers = [(c["street"], c[k]) for c in d["cells"] for k in ("left", "right") if c[k] is not None]
        if len(numbers) != len(set(numbers)):
            fail(f"{name}: a house number appears twice on the case")
        if len(numbers) != d.get("deliveries"):
            fail(f"{name}: {len(numbers)} house numbers on the case but deliveries says {d.get('deliveries')}")
        # One street per separation; a one-number separation only where a street ends.
        cells = d["cells"]
        for i, c in enumerate(cells):
            if c["right"] is None and i + 1 < len(cells) and cells[i + 1]["street"] == c["street"]:
                fail(f"{name}: one-number separation {c['slot']} is not the end of its street")
        long_streets = [st for st in d["streets"] if len(st) > MAX_STREET_LABEL]
        if long_streets:
            fail(f"{name}: street labels over {MAX_STREET_LABEL} characters: {long_streets}")
        if any(n > 9999 for _, n in numbers):
            fail(f"{name}: a house number has more than 4 digits")
        longest = max((f"{n} {d['streets'][st]}" for st, n in numbers), key=len)
        if len(longest) > MAX_ADDRESS:
            fail(f"{name}: address over {MAX_ADDRESS} characters: {longest}")
        hold = [p for p in d["pieces"] if p["hold"]]
        if len(hold) != 1 or (hold[0]["street"], hold[0]["number"]) in set(numbers):
            fail(f"{name}: the hold piece must be one number that is not on the case")
        elif hold[0]["address"] != hold_address:
            fail(f"{name}: hold piece is {hold[0]['address']}, expected {hold_address}")
        ones = [c["slot"] for c in cells if c["right"] is None]
        print(f"{name}: {len(numbers)} house numbers, {len(slots)} separations, one-number separations {ones}, longest address {len(longest)} characters ({longest}), hold {hold[0]['address'] if hold else '?'}")
    # The practice pieces sit on the same slots and sides on both routes (only the addresses differ).
    if len(loaded) == 2:
        a = [(p.get("slot"), p.get("side"), p["hold"]) for p in loaded[0][1]["pieces"]]
        b = [(p.get("slot"), p.get("side"), p["hold"]) for p in loaded[1][1]["pieces"]]
        if a != b:
            fail("the practice pieces are not on the same slots and sides on both routes")
        else:
            print(f"practice pieces: {len(a)} on the same slots and sides on both routes")
    # The Lens tables are what the generator makes from these files.
    gen = subprocess.run([sys.executable, "-I", str(ROOT / "data" / "make_route_table.py"), "--check"], cwd=ROOT, capture_output=True, text=True)
    if gen.returncode != 0:
        fail("Assets/Scripts/CaseLightRoute.ts tables do not match the route files (run data/make_route_table.py)")
    else:
        print("route tables in CaseLightRoute.ts match both route files")
    # The LEAF tests' own copy of the routes is what its generator makes from the same files.
    fix = subprocess.run([sys.executable, "-I", str(ROOT / "tools" / "make_route_fixture.py"), "--check"], cwd=ROOT, capture_output=True, text=True)
    if fix.returncode != 0:
        fail("Assets/Scripts/Leaf/CaseLightRouteFixture.ts does not match the route files (run tools/make_route_fixture.py)")
    else:
        print("LEAF route fixture matches both route files")


def demo_replay_default_problems(main_ts: str, scene: str) -> list:
    """The demo replay must be off in the shipped Lens: the code default AND the saved scene value say false.

    A Lens Studio scene file lists each input twice: under ScriptInputsDefault (whether it uses the code default,
    true/false) and under ScriptInputs (the value). Only the ScriptInputs value counts.
    """
    out = []
    if not re.search(r"\bdemoReplay\s*:\s*boolean\s*=\s*false\b", main_ts):
        out.append("CaseLightMain.ts: demoReplay must default to false")
    section, values = None, []
    for line in scene.splitlines():
        s = line.strip()
        if s in ("ScriptInputsDefault:", "ScriptInputs:", "ScriptTypesDefault:", "ScriptTypes:"):
            section = s
        elif section == "ScriptInputs:" and s.startswith("demoReplay:"):
            values.append(s.split(":", 1)[1].strip())
    if not values:
        out.append("Assets/Scene.scene: no saved demoReplay value found")
    for v in values:
        if v != "false":
            out.append(f"Assets/Scene.scene: demoReplay is saved as {v}; the shipped Lens must not start a replay")
    return out


def check_demo():
    main_ts = (ROOT / "Assets/Scripts/CaseLightMain.ts").read_text()
    scene = (ROOT / "Assets/Scene.scene").read_text(errors="ignore")
    problems = demo_replay_default_problems(main_ts, scene)
    for p in problems:
        fail(p)
    if not problems:
        print("demo replay off by default (code default and saved scene value)")
    fix = subprocess.run([sys.executable, "-I", str(ROOT / "tools" / "make_demo_fixture.py"), "--check"], cwd=ROOT, capture_output=True, text=True)
    if fix.returncode != 0:
        fail("Assets/Scripts/Leaf/CaseLightDemoFixture.ts does not match the recording (run tools/make_demo_fixture.py)")
    else:
        print("LEAF demo fixture matches the recording")


def check_notices(files):
    """THIRD_PARTY_NOTICES.md exists, credits OpenStreetMap under the ODbL, and names every packaged asset tracked."""
    path = ROOT / "THIRD_PARTY_NOTICES.md"
    if not path.is_file():
        fail("THIRD_PARTY_NOTICES.md missing")
        return
    text = path.read_text()
    for must in ("(c) OpenStreetMap contributors", "ODbL"):
        if must not in text:
            fail(f"THIRD_PARTY_NOTICES.md does not contain {must!r}")
    packaged = sorted({p.split("/")[1] for p in files if p.startswith(("Packages/", "Assets/")) and p.split("/")[1].endswith((".lspkg", ".lsc"))})
    missing = [p for p in packaged if p not in text]
    for p in missing:
        fail(f"THIRD_PARTY_NOTICES.md does not name {p}")
    if not missing:
        print(f"third-party notices name all {len(packaged)} packaged assets and credit OpenStreetMap")


def main():
    files = tracked_files()
    print(f"tracked files: {len(files)}")
    if len(files) < 100:
        fail(f"only {len(files)} tracked files; the scan floor is 100")

    for bad in (".mcp.json", "CLAUDE.local.md", ".claude/settings.local.json", ".env"):
        if any(p == bad or p.endswith("/" + bad) for p in files):
            fail(f"{bad} is tracked; it must stay local")

    keys = [p for p in files if p.lower().endswith((".pem", ".key", ".p12", ".pfx"))]
    for k in keys:
        fail(f"{k} looks like a private key; it must stay out of the repo")

    scenes = [p for p in files if p.endswith(".scene")]
    if not scenes:
        fail("no .scene file tracked")
    for p in scenes:
        text = (ROOT / p).read_text(errors="ignore")
        if re.search(r'"(?:api_?)?[Tt]oken"\s*:\s*"[^"]{16,}"', text):
            fail(f"{p} contains a saved token; clear it in Lens Studio before pushing")

    ids = leaf_scenarios()
    if len(ids) < LEAF_FLOOR:
        fail(f"{len(ids)} LEAF scenarios, floor is {LEAF_FLOOR}")
    # The judge-facing pages state the scenario count and the version; both must match the code.
    version = lens_version()
    for name in ("README.md", "JUDGING.md"):
        page = ROOT / name
        if not page.exists():
            fail(f"{name} missing")
            continue
        text = page.read_text()
        claimed = re.findall(r"(\d+) LEAF scenarios", text)
        if not claimed:
            fail(f"{name} does not state the LEAF scenario count")
        for c in claimed:
            if int(c) != len(ids):
                fail(f"{name} claims {c} LEAF scenarios; the code has {len(ids)}")
        named = set(re.findall(r"(?<![\w.])v\d+\.\d+(?:\.\d+)?\b", text))
        if version and version not in named:
            fail(f"{name} does not name the Lens version {version}")
        for v in sorted(named - {version}):
            fail(f"{name} names version {v}; the Lens is {version}")
    if version:
        print(f"version read from CaseLightVersion.ts: {version} (README.md and JUDGING.md checked against it)")

    docs = [p for p in files if p in ("README.md", "JUDGING.md") or (p.startswith("devpost/") and p.endswith(".md"))]
    print(f"em dash scan: {len(docs)} documents")
    for p in docs:
        if "—" in (ROOT / p).read_text(errors="ignore"):
            fail(f"{p} contains an em dash")

    check_routes()
    check_demo()
    check_notices(files)

    if FAILURES:
        print(f"\n{len(FAILURES)} check(s) failed")
        sys.exit(1)
    print("\nall checks passed")


if __name__ == "__main__":
    main()
