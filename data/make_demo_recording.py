"""Write the demo replay's recorded lines into Assets/Scripts/CaseLightDemo.ts from data/demo_replay_s1-g3nddr.log.

Usage (from the project folder):
  python3 -I data/make_demo_recording.py          rewrite the generated block
  python3 -I data/make_demo_recording.py --check  exit 1 if the block does not match the log file

The log file holds Lens Studio log lines copied verbatim (see its header). Only lines containing
"CASELIGHT_LOG v1" are used, from that prefix to the end of the line, unchanged. Only the lines
between the BEGIN and END markers in CaseLightDemo.ts are written. This script is code, not data.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LOG_PATH = os.path.join(HERE, "demo_replay_s1-g3nddr.log")
TS_PATH = os.path.join(HERE, "..", "Assets", "Scripts", "CaseLightDemo.ts")
BEGIN = "// BEGIN GENERATED DEMO RECORDING (data/make_demo_recording.py; do not edit by hand)"
END = "// END GENERATED DEMO RECORDING"
PREFIX = "CASELIGHT_LOG v1 "


def recorded():
    lines = []
    for line in open(LOG_PATH, encoding="utf-8"):
        line = line.rstrip("\n")
        if line.startswith("#"):
            continue
        i = line.find(PREFIX)
        if i >= 0:
            lines.append(line[i:])
    sessions = {m.group(1) for l in lines for m in [re.search(r"session=(\S+)", l)] if m}
    if len(sessions) != 1:
        sys.exit(f"expected one session in {LOG_PATH}, found {sorted(sessions)}")
    return sessions.pop(), lines


def block(session, lines):
    out = [BEGIN]
    out.append(f"/** The recorded session, from data/{os.path.basename(LOG_PATH)}. */")
    out.append(f"export const RECORDED_SESSION = {json.dumps(session)}")
    out.append("/** Its CASELIGHT_LOG v1 lines, from the prefix to the end of the line, unchanged, in log order. */")
    out.append("export const RECORDED_LINES: readonly string[] = [")
    for l in lines:
        out.append(f"  {json.dumps(l)},")
    out.append("]")
    out.append(END)
    return "\n".join(out)


def main():
    session, lines = recorded()
    ts = open(TS_PATH, encoding="utf-8").read()
    i, j = ts.find(BEGIN), ts.find(END)
    if i < 0 or j < 0:
        sys.exit("markers not found in CaseLightDemo.ts")
    new = ts[:i] + block(session, lines) + ts[j + len(END):]
    if "--check" in sys.argv:
        if new != ts:
            print(f"CaseLightDemo.ts recording does NOT match {os.path.basename(LOG_PATH)}")
            sys.exit(1)
        print(f"CaseLightDemo.ts recording matches {os.path.basename(LOG_PATH)}: session {session}, {len(lines)} lines")
        return
    open(TS_PATH, "w", encoding="utf-8").write(new)
    print(f"recording written: session {session}, {len(lines)} lines")


if __name__ == "__main__":
    main()
