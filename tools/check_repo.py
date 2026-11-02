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


def leaf_scenarios():
    ids = set()
    files = list((ROOT / "Assets").rglob("*.ts"))
    for f in files:
        ids.update(re.findall(r'id:\s*"((?:c\d+|extra)-[a-z0-9-]+)"', f.read_text(errors="ignore")))
    print(f"LEAF: {len(ids)} scenarios in {len(files)} TypeScript files")
    if len(files) < 20:
        fail(f"read only {len(files)} TypeScript files; expected the whole Assets tree")
    return sorted(ids)


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
    readme = ROOT / "README.md"
    if not readme.exists():
        fail("README.md missing")
    else:
        claimed = re.findall(r"(\d+) LEAF scenarios", readme.read_text())
        if not claimed:
            fail("README.md does not state the LEAF scenario count")
        for c in claimed:
            if int(c) != len(ids):
                fail(f"README claims {c} LEAF scenarios; the code has {len(ids)}")

    docs = [p for p in files if p == "README.md" or (p.startswith("devpost/") and p.endswith(".md"))]
    print(f"em dash scan: {len(docs)} documents")
    for p in docs:
        if "—" in (ROOT / p).read_text(errors="ignore"):
            fail(f"{p} contains an em dash")

    route = ROOT / "data" / "case_light_route_osm.json"
    if not route.exists():
        fail("data/case_light_route_osm.json missing")
    else:
        d = json.loads(route.read_text())
        if "openstreetmap.org/copyright" not in d.get("attribution", ""):
            fail("route data lacks the OpenStreetMap attribution")
        if not (ROOT / "data" / "ATTRIBUTION.md").exists():
            fail("data/ATTRIBUTION.md missing")
        slots = [c["slot"] for c in d["cells"]]
        if any(36 <= s <= 39 for s in slots):
            fail("a street address sits in the HOLD block")
        numbers = [(c["street"], c[k]) for c in d["cells"] for k in ("left", "right") if c[k] is not None]
        if len(numbers) != len(set(numbers)):
            fail("a house number appears twice on the case")
        hold = [p for p in d["pieces"] if p["hold"]]
        if len(hold) != 1 or (hold[0]["street"], hold[0]["number"]) in set(numbers):
            fail("the hold piece must be one number that is not on the case")
        print(f"route data: {len(numbers)} house numbers, {len(slots)} separations, hold {hold[0]['address'] if hold else '?'}")

    if FAILURES:
        print(f"\n{len(FAILURES)} check(s) failed")
        sys.exit(1)
    print("\nall checks passed")


if __name__ == "__main__":
    main()
