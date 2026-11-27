# Q04 physical teaching review

Reviewed the working tree at base 8ddb998 on November 27, 2026. No technical correction emerged from this review. The source hashes identify the working-tree inputs and match the isolated copies byte for byte.

| Area | Finding |
| --- | --- |
| Copper | T01/T02 give 95 m and 105 m against the fictional inclusive 100 m limit. T03 keeps the required conductor open after repeater placement. CH04 and CH20 retain the distinction between continuity, length and service. [Fluke wiremap tests](https://www.flukenetworks.com/blog/cabling-chronicles/whats-wrong-my-cable) |
| Optics | With −3 dBm transmit, the 8/9/10 dB passive cards yield −11/−12/−13 dBm receive and 3/2/1 dB above sensitivity. The 9 dB card meets reserve exactly. All three satisfy the separate maximum. An independent receive observation can overload, and incompatible modules fail before numerical success. MG02 credits correct diagnosis of the 10 dB failure. [Cisco SFP+ module specifications, tables 3–4](https://www.cisco.com/c/en/us/products/collateral/interfaces-modules/transceiver-modules/data_sheet_c78-455693.html) |
| Radio | With −65 dBm signal, noise of −90, −85, −84.99 and −78 dBm gives 25, 20, 19.99 and 13 dB. Only the first two meet this profile's inclusive threshold. MG03 compares an earlier attributed observation against a fresh measurement after prediction. Its result distinguishes learner accuracy, current link status and unproven weather causation and throughput. [Cisco site survey FAQ, Signal-to-Noise Ratio](https://www.cisco.com/c/en/us/support/docs/wireless-mobility/wireless-lan-wlan/68666-wireless-site-survey-faq.html) |
| Power and capabilities | SQ02 compares delivered demand with the same delivered 30 W budget. Demands of 23, 30 and 33 W leave 7 W, leave zero or exceed the budget by 3 W. CH19 retains the separate data-link check. T11 intersects whole advertised rate/duplex pairs. Its only common pair is 100 Mb/s full duplex. CH22 distinguishes a common mode from successful network service. |
| Packet and symbols | T12 yields 00101101 from four ordered two-bit toy symbols. The packet boundary tests check freshness, reject continuity alone for the length predicate and preserve the absence of a trace after a failure with unspecified bits. The inspection describes highlighted bytes and distinguishes comparison with a known pattern from a real frame check sequence. |
| Optional depth | SQ01/MG01 use the toy mapping. SQ02/MG02 separate learner diagnosis from a failed equipment plan. SQ03/MG03 use attributed earlier and current radio evidence. SQ04 combines notebook observations. Retaining a notebook entry after reconfiguration preserves historical learning only. |

Compared 100 occurrences of physical source claims in 25 character compendia and seven optional definitions against the register. Every occurrence retains its source section, claim and registered limitation. MG02 adds a background-only limitation in three entries. Nine descriptive citations across the compendia match the eight distinct context sources by URL, section, claim and limitation. The additional scope and retrieval fields agree with their descriptive use. Earlier source inspection details and primary links for each technical rule are in [the rule review](../../rule-source-review.md).

Ran six copied domain suites with pinned Node 26.13.1 using the name filter below. Vitest reported 256 passes and 90 filtered tests. These counts include validation and freshness checks as well as independent physical cases. The optional-controller evidence came from inspecting current code and previous receipts. No new optional browser run or human assessment formed part of this review.

```sh
node node_modules/vitest/vitest.mjs run tests/domain/{copper,optics,radio,power,capabilities,packet-journey-boundaries}.test.ts --maxWorkers=1 -t 'T0[1-9]|T1[015]|B-|I-PHY|C-ERROR|relabeled|continuity-only|lone symbol|without a trace'
```

See [focused execution](focused.txt) and [SHA-256 inputs](source-sha256.json). Existing aggregate gates and owner reviews remain open.
