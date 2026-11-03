# Owns: writing the LEAF tests' own copy of the demo replay's recording (Assets/Scripts/Leaf/CaseLightDemoFixture.ts)
#   from data/demo_replay_s1-g3nddr.log, so the replay scenario never reads the product's CaseLightDemo.ts.
# Talks to: data/demo_replay_s1-g3nddr.log (read only).
# Must not: read Assets/Scripts/CaseLightDemo.ts, or change the recording.
#
# Usage, from lens/CaseLight:
#   python3 tools/make_demo_fixture.py           write the fixture
#   python3 tools/make_demo_fixture.py --check   exit 1 if the fixture differs from what this script writes
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = "data/demo_replay_s1-g3nddr.log"
OUT = ROOT / "Assets/Scripts/Leaf/CaseLightDemoFixture.ts"


def render() -> tuple[str, int]:
    raw = (ROOT / SRC).read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    lines = []
    for line in raw.decode("utf-8").splitlines():
        if line.startswith("#"):
            continue
        i = line.find("CASELIGHT_LOG v1")
        if i >= 0:
            lines.append(line[i:])
    body = [
        "// Owns: the tester's copy of the demo replay's recording (the CASELIGHT_LOG v1 lines of session s1-g3nddr), cut from data/demo_replay_s1-g3nddr.log by the tester's own script.",
        "// Talks to: nothing (pure data); read by the demo replay scenario.",
        "// Must not: be generated from or checked against CaseLightDemo.ts (it is the independent expectation).",
        "",
        f"/** {SRC}, SHA-256 {sha}: every line's text from \"CASELIGHT_LOG v1\" to its end, unchanged, in file order. */",
        "export const RECORDING_LINES: string[] = [",
    ]
    for line in lines:
        body.append(f"  {json.dumps(line)},")
    body.append("]")
    return "\n".join(body) + "\n", len(lines)


def main() -> int:
    text, n = render()
    if "--check" in sys.argv[1:]:
        if not OUT.is_file() or OUT.read_text() != text:
            print(f"FAIL: {OUT.relative_to(ROOT)} differs from what tools/make_demo_fixture.py writes")
            return 1
        print(f"{OUT.relative_to(ROOT)} matches the recording ({n} lines)")
        return 0
    OUT.write_text(text)
    print("wrote", OUT.relative_to(ROOT), f"({n} lines)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
