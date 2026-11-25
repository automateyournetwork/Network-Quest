#!/usr/bin/env python3
"""T006 arithmetic worksheet and reference audit; not an application test harness.

Expected values are authored literals in sources.json. Calculations below are
independent textbook arithmetic, not imports or output from a game evaluator.
Run from any directory with Python 3 (standard library only).
"""
import json
from decimal import Decimal as D
from pathlib import Path

root = Path(__file__).resolve().parents[3]
data = json.loads((root / "content/spec001/sources.json").read_text())
cases = {c["id"]: c for c in data["referenceCases"] + data["reviewCases"]}
profiles = {p["id"]: p for p in data["profiles"]}
source_ids = {s["id"] for s in data["sources"]}
rule_ids = {r["id"] for r in data["rules"]}
checks = 0


def check(condition, description):
    global checks
    if not condition:
        raise AssertionError(description)
    checks += 1


def expected_quantity(case_id, name, result, unit):
    value = cases[case_id]["expected"]["observation"][name]
    check(value["unit"] == unit and D(str(value["value"])) == result,
          f"{case_id} {name}: expected literal must equal {result} {unit}")


# Literal operands intentionally mirror the published review worksheet, not a
# future implementation. Decimal keeps 0.01 boundary checks exact.
calculations = [
    ("T01", "total", D(85) + D(10), "m"),
    ("T01", "headroom", D(100) - D(95), "m"),
    ("T02", "total", D(95) + D(10), "m"),
    ("T02", "excess", D(105) - D(100), "m"),
    ("T04", "receive", D(-3) - D(8), "dBm"),
    ("T04", "margin", D(-11) - D(-14), "dB"),
    ("T05", "receive", D(-3) - D(10), "dBm"),
    ("T05", "margin", D(-13) - D(-14), "dB"),
    ("T06", "excess", D(0) - D(-1), "dB"),
    ("T08", "snr", D(-65) - D(-90), "dB"),
    ("T09", "snr", D(-65) - D(-78), "dB"),
    ("T10", "total", D(12) + D(11) + D(10), "W"),
    ("T10", "excess", D(33) - D(30), "W"),
    ("T15", "receive", D(-3) - D(9), "dBm"),
    ("T15", "margin", D(-12) - D(-14), "dB"),
    ("B-COPPER-100", "total", D(90) + D(10), "m"),
    ("B-COPPER-100", "headroom", D(100) - D(100), "m"),
    ("B-COPPER-OVER", "total", D(90) + D("10.01"), "m"),
    ("B-COPPER-OVER", "excess", D("100.01") - D(100), "m"),
    ("B-OPT-MAX", "margin", D(-1) - D(-14), "dB"),
    ("B-OPT-OVER", "excess", D("-0.99") - D(-1), "dB"),
    ("B-OPT-RESERVE", "receive", D(-3) - D("9.01"), "dBm"),
    ("B-OPT-RESERVE", "margin", D("-12.01") - D(-14), "dB"),
    ("B-RADIO-20", "snr", D(-65) - D(-85), "dB"),
    ("B-RADIO-BELOW", "snr", D(-65) - D("-84.99"), "dB"),
    ("C-POWER", "total", D(12) + D(11), "W"),
    ("C-POWER", "headroom", D(30) - D(23), "W"),
    ("B-POWER-30", "total", D(12) + D(11) + D(7), "W"),
    ("B-POWER-30", "headroom", D(30) - D(30), "W"),
    ("B-POWER-OVER", "total", D(12) + D(11) + D("7.01"), "W"),
    ("B-POWER-OVER", "excess", D("30.01") - D(30), "W"),
    ("B-LOSS-ZERO", "receive", D(-3) - D(0), "dBm"),
    ("B-LOSS-ZERO", "margin", D(-3) - D(-14), "dB"),
]
for calculation in calculations:
    expected_quantity(*calculation)

# Independently check the exact inclusive inequalities used in the worksheet.
for result, description in [
    (95 <= 100 < 105, "copper original decisions"),
    (D(100) <= D(100) < D("100.01"), "copper exact edge"),
    (3 >= 2 and 1 < 2 and 2 >= 2, "optical reserve decisions"),
    (-11 <= -1 and -13 <= -1 and -12 <= -1 < 0, "overload decisions"),
    (D("1.99") < D(2) and D(-1) < D("-0.99"), "optical near edges"),
    (25 >= 20 and 13 < 20 and D("19.99") < 20 <= 20, "radio edges"),
    (23 <= 30 < 33 and 30 <= 30 < D("30.01"), "power edges"),
]:
    check(result, description)

toy = profiles["spec001:PROFILE-SYMBOLS"]["parameters"]["levels"]
check([(x["symbol"]["value"], x["bits"]) for x in toy] ==
      [(-3, "00"), (-1, "01"), (1, "10"), (3, "11")], "authored toy map")
check(cases["T12"]["expected"]["observation"] ==
      {"bits": "00" + "10" + "11" + "01", "representedBits": 4 * 2, "symbols": 4},
      "T12 literal groups and count")
check([(v["value"], v["unit"]) for v in cases["T12"]["inputs"]["symbols"]] ==
      [(-3, "toy-level"), (1, "toy-level"), (3, "toy-level"), (-1, "toy-level")],
      "T12 typed sequence")
check(cases["B-SYMBOL"]["expected"]["observation"] ==
      {"bits": "11", "representedBits": 2, "symbols": 1}, "single-symbol boundary")
check(cases["B-TIMING"]["expected"]["observation"] ==
      {"expectedBits": "00" + "10", "submittedBits": "10" + "00"}, "sampling order")

endpoint_a = {(1000, "full"), (100, "full")}
endpoint_b = {(100, "full"), (10, "half")}
common = cases["T11"]["expected"]["observation"]["common"]
check({(x["rate"]["value"], x["duplex"]) for x in common} == endpoint_a & endpoint_b,
      "T11 independently intersected capabilities")
capabilities = profiles["spec001:PROFILE-CAPABILITIES"]["parameters"]
for key, expected in [("endpointA", endpoint_a), ("endpointB", endpoint_b)]:
    check({(x["rate"]["value"], x["duplex"]) for x in capabilities[key]} == expected
          and all(x["rate"]["unit"] == "Mb/s" for x in capabilities[key]), key)
check({(100, "full")} & {(10, "half")} == set() and
      cases["B-NEG-NONE"]["expected"]["observation"]["common"] == [], "empty intersection")

packet = profiles["spec001:PROFILE-PACKET"]["parameters"]
check(packet["payloadHex"] == ["4E", "51"] and packet["payloadText"] == "NQ",
      "original packet payload identity")
bits = f"{4 * 16 + 14:08b}{5 * 16 + 1:08b}"
check(bits == "0100111001010001" == packet["highlightedBits"] ==
      cases["C-PACKET"]["inputs"]["recoveredBits"], "NQ hexadecimal expansion")
check(bytes([78, 81]).decode("ascii") == "NQ" and len(bits) == 16, "NQ byte identity and count")
diff = sum(a != b for a, b in zip(bits, "0100111001010000"))
check(diff == cases["C-PACKET-DIFF"]["expected"]["observation"]["differingBits"] == 1,
      "one-bit known-pattern difference")

check(len(cases) == len(data["referenceCases"]) + len(data["reviewCases"]), "unique case IDs")
check({c["id"] for c in data["referenceCases"]} ==
      {f"T{i:02}" for i in range(1, 17)}, "all original T01–T16 cases")
check(len(source_ids) == len(data["sources"]), "unique source IDs")
check(len(profiles) == len(data["profiles"]), "unique profile IDs")
check(len(rule_ids) == len(data["rules"]), "unique rule IDs")
check({o for r in data["rules"] for o in r["objectives"]} ==
      {f"O{i:02}" for i in range(1, 13)}, "all twelve objective IDs")
check({o for r in data["rules"] if r["id"] != "STATE02" and r["id"] != "STATE03"
       for o in r["objectives"]} == {f"O{i:02}" for i in range(1, 13)},
      "objective coverage does not rely solely on general invariants")
for source in data["sources"]:
    check(all(source.get(k) for k in
              ["title", "url", "section", "retrievedDate", "supportedClaim", "limits", "inspection"]),
          source["id"] + " source metadata")
    check(source["url"].startswith("https://") and source["retrievedDate"] == "2026-11-25",
          source["id"] + " retrieval metadata")
for profile in profiles.values():
    check(set(profile["sources"]) <= source_ids and profile["assumptions"] and profile["limits"],
          profile["id"] + " source and model scope")
for rule in data["rules"]:
    check(set(rule["sources"]) <= source_ids and set(rule["profiles"]) <= profiles.keys(),
          rule["id"] + " source/profile references")
    for category in ["correctCases", "incorrectCases", "boundaryCases", "invalidInputCases"]:
        check(bool(rule[category]) and set(rule[category]) <= cases.keys(),
              rule["id"] + " " + category)
    for category, status in [("correctCases", "correct"), ("incorrectCases", "incorrect"),
                             ("invalidInputCases", "invalid-input")]:
        check(all(cases[c]["expected"]["status"] == status for c in rule[category]),
              rule["id"] + " category status " + category)
for case in cases.values():
    check(case["ruleId"] in rule_ids and case["expected"]["status"] in
          {"correct", "incorrect", "invalid-input", "content-error"}, case["id"] + " interface")
    check(bool(case["independentReasoning"]), case["id"] + " independent reasoning")
for case_id in data["contentErrorCases"]:
    case = cases[case_id]
    obs = case["expected"]["observation"]
    check(case["expected"]["status"] == "content-error" and
          obs["attemptPenalty"] == 0 and obs["progressAward"] == 0,
          case_id + " authoring error is not learner failure")

print(f"PASS: {checks} worksheet/reference checks; {len(source_ids)} sources, "
      f"{len(profiles)} profiles, {len(rule_ids)} rules, {len(cases)} authored cases.")
print("Application evaluator tests, browser acceptance and human technical review: NOT RUN.")
