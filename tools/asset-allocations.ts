// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Planned identities only. Exact CH/PR names are transcribed in SPEC.md order.
// The 205 image/audio purposes mirror T062 audio/production-plan.json; none are
// observed runtime placement, production, source, review or quota evidence.
import type { AssetKind } from './asset-types.ts';
export type AssetAllocation = {
  assetId: string; semanticIdentity: string; kind: AssetKind; name: string;
  purpose: string; plannedRoomIds: string[]; plannedUse: string;
  plannedContentId?: string; plannedSpeakerId?: string;
};
export const assetAllocations: readonly AssetAllocation[] = [
  {
    "assetId": "spec001:ASSET-CH01",
    "semanticIdentity": "spec001:CH01",
    "kind": "character-model",
    "name": "The Apprentice",
    "purpose": "Playable engineer; R01 onward",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH02",
    "semanticIdentity": "spec001:CH02",
    "kind": "character-model",
    "name": "The Titan",
    "purpose": "Mentor and Underworld guardian; R02",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH03",
    "semanticIdentity": "spec001:CH03",
    "kind": "character-model",
    "name": "Photon the Firefly",
    "purpose": "Light-transmission companion; R01/R05",
    "plannedRoomIds": [
      "spec001:R01",
      "spec001:R05"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH04",
    "semanticIdentity": "spec001:CH04",
    "kind": "character-model",
    "name": "Copperhead Snake",
    "purpose": "Copper signaling companion; R03",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH05",
    "semanticIdentity": "spec001:CH05",
    "kind": "character-model",
    "name": "Single-Mode Unicorn",
    "purpose": "Compatible long-path optical profile; R05",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH06",
    "semanticIdentity": "spec001:CH06",
    "kind": "character-model",
    "name": "Multimode Hydra",
    "purpose": "Multiple optical propagation modes; R05",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH07",
    "semanticIdentity": "spec001:CH07",
    "kind": "character-model",
    "name": "Thunderbird",
    "purpose": "Radio link companion; R07",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH08",
    "semanticIdentity": "spec001:CH08",
    "kind": "character-model",
    "name": "Blue Dragon",
    "purpose": "Short-range radio exhibit and dialogue; R07",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH09",
    "semanticIdentity": "spec001:CH09",
    "kind": "character-model",
    "name": "Red Scorpion",
    "purpose": "Infrared signaling exhibit; R10",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH10",
    "semanticIdentity": "spec001:CH10",
    "kind": "character-model",
    "name": "Microwave Phoenix",
    "purpose": "Directional wireless relay specialist; R08",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH11",
    "semanticIdentity": "spec001:CH11",
    "kind": "character-model",
    "name": "Celestial Eagle",
    "purpose": "Satellite-distance perspective, not a required satellite simulator; R08",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH12",
    "semanticIdentity": "spec001:CH12",
    "kind": "character-model",
    "name": "Iron Golem",
    "purpose": "PHY and interface compatibility mentor; R02/R12",
    "plannedRoomIds": [
      "spec001:R02",
      "spec001:R12"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH13",
    "semanticIdentity": "spec001:CH13",
    "kind": "character-model",
    "name": "Ancient Tortoise",
    "purpose": "Legacy serial side quest; R04",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH14",
    "semanticIdentity": "spec001:CH14",
    "kind": "character-model",
    "name": "DSL Mole",
    "purpose": "Existing telephone-medium context; R09",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH15",
    "semanticIdentity": "spec001:CH15",
    "kind": "character-model",
    "name": "DOCSIS Badger",
    "purpose": "Coaxial-medium context; R09",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH16",
    "semanticIdentity": "spec001:CH16",
    "kind": "character-model",
    "name": "SFP Hermit Crab",
    "purpose": "Compatible module-selection companion; R06/R09",
    "plannedRoomIds": [
      "spec001:R06",
      "spec001:R09"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH17",
    "semanticIdentity": "spec001:CH17",
    "kind": "character-model",
    "name": "QSFP Chimera",
    "purpose": "Multi-lane/form-factor explanation with profile caveats; R09",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH18",
    "semanticIdentity": "spec001:CH18",
    "kind": "character-model",
    "name": "Rainbow Serpent",
    "purpose": "Wavelength multiplexing exhibit; R06",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH19",
    "semanticIdentity": "spec001:CH19",
    "kind": "character-model",
    "name": "Electric Eel",
    "purpose": "Delivered-power budget companion; R09",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH20",
    "semanticIdentity": "spec001:CH20",
    "kind": "character-model",
    "name": "Echo Bat",
    "purpose": "Signal-regeneration companion; R04",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH21",
    "semanticIdentity": "spec001:CH21",
    "kind": "character-model",
    "name": "Metronome Golem",
    "purpose": "Signal timing and toy decoding; R10",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH22",
    "semanticIdentity": "spec001:CH22",
    "kind": "character-model",
    "name": "Chameleon",
    "purpose": "Common-capability companion; R10",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH23",
    "semanticIdentity": "spec001:CH23",
    "kind": "character-model",
    "name": "Noise Demon",
    "purpose": "Visible consequence of impaired radio evidence; R08",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH24",
    "semanticIdentity": "spec001:CH24",
    "kind": "character-model",
    "name": "Crosstalk Twins",
    "purpose": "Interference story encounter; R03",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-CH25",
    "semanticIdentity": "spec001:CH25",
    "kind": "character-model",
    "name": "Backhoe of Doom",
    "purpose": "Physical-disconnection finale; R11",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "character-placement"
  },
  {
    "assetId": "spec001:ASSET-PR001",
    "semanticIdentity": "spec001:PR001",
    "kind": "prop-model",
    "name": "Lift cage",
    "purpose": "Lift cage: R01 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR002",
    "semanticIdentity": "spec001:PR002",
    "kind": "prop-model",
    "name": "lift call panel",
    "purpose": "lift call panel: R01 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR003",
    "semanticIdentity": "spec001:PR003",
    "kind": "prop-model",
    "name": "signal arrival tube",
    "purpose": "signal arrival tube: R01 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR004",
    "semanticIdentity": "spec001:PR004",
    "kind": "prop-model",
    "name": "orientation plaque",
    "purpose": "orientation plaque: R01 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR005",
    "semanticIdentity": "spec001:PR005",
    "kind": "prop-model",
    "name": "apprentice satchel",
    "purpose": "apprentice satchel: R01 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR006",
    "semanticIdentity": "spec001:PR006",
    "kind": "prop-model",
    "name": "broken link lamp",
    "purpose": "broken link lamp: R01 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR007",
    "semanticIdentity": "spec001:PR007",
    "kind": "prop-model",
    "name": "insulated handrail",
    "purpose": "insulated handrail: R01 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR008",
    "semanticIdentity": "spec001:PR008",
    "kind": "prop-model",
    "name": "entry turnstile",
    "purpose": "entry turnstile: R01 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR009",
    "semanticIdentity": "spec001:PR009",
    "kind": "prop-model",
    "name": "message capsule",
    "purpose": "message capsule: R01 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR010",
    "semanticIdentity": "spec001:PR010",
    "kind": "prop-model",
    "name": "welcome automaton pedestal",
    "purpose": "welcome automaton pedestal: R01 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR011",
    "semanticIdentity": "spec001:PR011",
    "kind": "prop-model",
    "name": "Titan workbench",
    "purpose": "Titan workbench: R02 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR012",
    "semanticIdentity": "spec001:PR012",
    "kind": "prop-model",
    "name": "topology relief table",
    "purpose": "topology relief table: R02 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR013",
    "semanticIdentity": "spec001:PR013",
    "kind": "prop-model",
    "name": "tool cabinet",
    "purpose": "tool cabinet: R02 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR014",
    "semanticIdentity": "spec001:PR014",
    "kind": "prop-model",
    "name": "dispatch console",
    "purpose": "dispatch console: R02 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR015",
    "semanticIdentity": "spec001:PR015",
    "kind": "prop-model",
    "name": "recruit perch",
    "purpose": "recruit perch: R02 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR016",
    "semanticIdentity": "spec001:PR016",
    "kind": "prop-model",
    "name": "repair-plan easel",
    "purpose": "repair-plan easel: R02 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR017",
    "semanticIdentity": "spec001:PR017",
    "kind": "prop-model",
    "name": "media comparison rack",
    "purpose": "media comparison rack: R02 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR018",
    "semanticIdentity": "spec001:PR018",
    "kind": "prop-model",
    "name": "hypothesis board",
    "purpose": "hypothesis board: R02 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR019",
    "semanticIdentity": "spec001:PR019",
    "kind": "prop-model",
    "name": "parts carousel",
    "purpose": "parts carousel: R02 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR020",
    "semanticIdentity": "spec001:PR020",
    "kind": "prop-model",
    "name": "workshop furnace",
    "purpose": "workshop furnace: R02 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR021",
    "semanticIdentity": "spec001:PR021",
    "kind": "prop-model",
    "name": "Twisted-pair cutaway",
    "purpose": "Twisted-pair cutaway: R03 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR022",
    "semanticIdentity": "spec001:PR022",
    "kind": "prop-model",
    "name": "copper patch panel",
    "purpose": "copper patch panel: R03 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR023",
    "semanticIdentity": "spec001:PR023",
    "kind": "prop-model",
    "name": "cracked cable spool",
    "purpose": "cracked cable spool: R03 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR024",
    "semanticIdentity": "spec001:PR024",
    "kind": "prop-model",
    "name": "cable tray elbow",
    "purpose": "cable tray elbow: R03 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR025",
    "semanticIdentity": "spec001:PR025",
    "kind": "prop-model",
    "name": "pair separator",
    "purpose": "pair separator: R03 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR026",
    "semanticIdentity": "spec001:PR026",
    "kind": "prop-model",
    "name": "interference motor",
    "purpose": "interference motor: R03 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR027",
    "semanticIdentity": "spec001:PR027",
    "kind": "prop-model",
    "name": "shielding cross-section",
    "purpose": "shielding cross-section: R03 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR028",
    "semanticIdentity": "spec001:PR028",
    "kind": "prop-model",
    "name": "damaged plug",
    "purpose": "damaged plug: R03 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR029",
    "semanticIdentity": "spec001:PR029",
    "kind": "prop-model",
    "name": "continuity pedestal",
    "purpose": "continuity pedestal: R03 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR030",
    "semanticIdentity": "spec001:PR030",
    "kind": "prop-model",
    "name": "route-length wheel",
    "purpose": "route-length wheel: R03 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR031",
    "semanticIdentity": "spec001:PR031",
    "kind": "prop-model",
    "name": "Repeater station",
    "purpose": "Repeater station: R04 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR032",
    "semanticIdentity": "spec001:PR032",
    "kind": "prop-model",
    "name": "echo reflector",
    "purpose": "echo reflector: R04 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR033",
    "semanticIdentity": "spec001:PR033",
    "kind": "prop-model",
    "name": "serial telegraph",
    "purpose": "serial telegraph: R04 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR034",
    "semanticIdentity": "spec001:PR034",
    "kind": "prop-model",
    "name": "serial connector display",
    "purpose": "serial connector display: R04 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR035",
    "semanticIdentity": "spec001:PR035",
    "kind": "prop-model",
    "name": "cavern signal gong",
    "purpose": "cavern signal gong: R04 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR036",
    "semanticIdentity": "spec001:PR036",
    "kind": "prop-model",
    "name": "historical cable case",
    "purpose": "historical cable case: R04 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR037",
    "semanticIdentity": "spec001:PR037",
    "kind": "prop-model",
    "name": "regenerator core",
    "purpose": "regenerator core: R04 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR038",
    "semanticIdentity": "spec001:PR038",
    "kind": "prop-model",
    "name": "isolated broken span",
    "purpose": "isolated broken span: R04 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR039",
    "semanticIdentity": "spec001:PR039",
    "kind": "prop-model",
    "name": "amplitude ladder",
    "purpose": "amplitude ladder: R04 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR040",
    "semanticIdentity": "spec001:PR040",
    "kind": "prop-model",
    "name": "antique message printer",
    "purpose": "antique message printer: R04 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR041",
    "semanticIdentity": "spec001:PR041",
    "kind": "prop-model",
    "name": "Fiber grove trunk",
    "purpose": "Fiber grove trunk: R05 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR042",
    "semanticIdentity": "spec001:PR042",
    "kind": "prop-model",
    "name": "light blossom cluster",
    "purpose": "light blossom cluster: R05 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR043",
    "semanticIdentity": "spec001:PR043",
    "kind": "prop-model",
    "name": "connector inspection dock",
    "purpose": "connector inspection dock: R05 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR044",
    "semanticIdentity": "spec001:PR044",
    "kind": "prop-model",
    "name": "cleaning station",
    "purpose": "cleaning station: R05 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR045",
    "semanticIdentity": "spec001:PR045",
    "kind": "prop-model",
    "name": "optical patch shelf",
    "purpose": "optical patch shelf: R05 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR046",
    "semanticIdentity": "spec001:PR046",
    "kind": "prop-model",
    "name": "fiber bend exhibit",
    "purpose": "fiber bend exhibit: R05 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR047",
    "semanticIdentity": "spec001:PR047",
    "kind": "prop-model",
    "name": "split fiber coupler",
    "purpose": "split fiber coupler: R05 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR048",
    "semanticIdentity": "spec001:PR048",
    "kind": "prop-model",
    "name": "broken fiber stump",
    "purpose": "broken fiber stump: R05 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR049",
    "semanticIdentity": "spec001:PR049",
    "kind": "prop-model",
    "name": "optical receiver altar",
    "purpose": "optical receiver altar: R05 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR050",
    "semanticIdentity": "spec001:PR050",
    "kind": "prop-model",
    "name": "photon lantern",
    "purpose": "photon lantern: R05 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR051",
    "semanticIdentity": "spec001:PR051",
    "kind": "prop-model",
    "name": "Prism engine",
    "purpose": "Prism engine: R06 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR052",
    "semanticIdentity": "spec001:PR052",
    "kind": "prop-model",
    "name": "wavelength combiner",
    "purpose": "wavelength combiner: R06 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR053",
    "semanticIdentity": "spec001:PR053",
    "kind": "prop-model",
    "name": "spectrum window",
    "purpose": "spectrum window: R06 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR054",
    "semanticIdentity": "spec001:PR054",
    "kind": "prop-model",
    "name": "attenuation dial",
    "purpose": "attenuation dial: R06 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR055",
    "semanticIdentity": "spec001:PR055",
    "kind": "prop-model",
    "name": "splice enclosure",
    "purpose": "splice enclosure: R06 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR056",
    "semanticIdentity": "spec001:PR056",
    "kind": "prop-model",
    "name": "optical attenuator",
    "purpose": "optical attenuator: R06 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR057",
    "semanticIdentity": "spec001:PR057",
    "kind": "prop-model",
    "name": "receiver threshold gauge",
    "purpose": "receiver threshold gauge: R06 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR058",
    "semanticIdentity": "spec001:PR058",
    "kind": "prop-model",
    "name": "wavelength-filter door",
    "purpose": "wavelength-filter door: R06 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR059",
    "semanticIdentity": "spec001:PR059",
    "kind": "prop-model",
    "name": "link budget abacus",
    "purpose": "link budget abacus: R06 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR060",
    "semanticIdentity": "spec001:PR060",
    "kind": "prop-model",
    "name": "power meter cradle",
    "purpose": "power meter cradle: R06 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR061",
    "semanticIdentity": "spec001:PR061",
    "kind": "prop-model",
    "name": "Directional antenna",
    "purpose": "Directional antenna: R07 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR062",
    "semanticIdentity": "spec001:PR062",
    "kind": "prop-model",
    "name": "radio mast",
    "purpose": "radio mast: R07 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR063",
    "semanticIdentity": "spec001:PR063",
    "kind": "prop-model",
    "name": "alignment scope",
    "purpose": "alignment scope: R07 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR064",
    "semanticIdentity": "spec001:PR064",
    "kind": "prop-model",
    "name": "path-clearance model",
    "purpose": "path-clearance model: R07 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR065",
    "semanticIdentity": "spec001:PR065",
    "kind": "prop-model",
    "name": "short-range beacon",
    "purpose": "short-range beacon: R07 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR066",
    "semanticIdentity": "spec001:PR066",
    "kind": "prop-model",
    "name": "radio-channel selector",
    "purpose": "radio-channel selector: R07 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR067",
    "semanticIdentity": "spec001:PR067",
    "kind": "prop-model",
    "name": "polarization exhibit",
    "purpose": "polarization exhibit: R07 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR068",
    "semanticIdentity": "spec001:PR068",
    "kind": "prop-model",
    "name": "signal banner",
    "purpose": "signal banner: R07 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR069",
    "semanticIdentity": "spec001:PR069",
    "kind": "prop-model",
    "name": "rooftop relay cabinet",
    "purpose": "rooftop relay cabinet: R07 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR070",
    "semanticIdentity": "spec001:PR070",
    "kind": "prop-model",
    "name": "wireless bridge terminal",
    "purpose": "wireless bridge terminal: R07 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR071",
    "semanticIdentity": "spec001:PR071",
    "kind": "prop-model",
    "name": "Storm radar dish",
    "purpose": "Storm radar dish: R08 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR072",
    "semanticIdentity": "spec001:PR072",
    "kind": "prop-model",
    "name": "interference emitter",
    "purpose": "interference emitter: R08 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR073",
    "semanticIdentity": "spec001:PR073",
    "kind": "prop-model",
    "name": "observation telescope",
    "purpose": "observation telescope: R08 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR074",
    "semanticIdentity": "spec001:PR074",
    "kind": "prop-model",
    "name": "noise-floor meter",
    "purpose": "noise-floor meter: R08 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR075",
    "semanticIdentity": "spec001:PR075",
    "kind": "prop-model",
    "name": "propagation globe",
    "purpose": "propagation globe: R08 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR076",
    "semanticIdentity": "spec001:PR076",
    "kind": "prop-model",
    "name": "weather vane",
    "purpose": "weather vane: R08 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR077",
    "semanticIdentity": "spec001:PR077",
    "kind": "prop-model",
    "name": "satellite orbital model",
    "purpose": "satellite orbital model: R08 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR078",
    "semanticIdentity": "spec001:PR078",
    "kind": "prop-model",
    "name": "microwave reflector",
    "purpose": "microwave reflector: R08 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR079",
    "semanticIdentity": "spec001:PR079",
    "kind": "prop-model",
    "name": "signal history drum",
    "purpose": "signal history drum: R08 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR080",
    "semanticIdentity": "spec001:PR080",
    "kind": "prop-model",
    "name": "channel survey desk",
    "purpose": "channel survey desk: R08 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR081",
    "semanticIdentity": "spec001:PR081",
    "kind": "prop-model",
    "name": "Module display case",
    "purpose": "Module display case: R09 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR082",
    "semanticIdentity": "spec001:PR082",
    "kind": "prop-model",
    "name": "SFP test cage",
    "purpose": "SFP test cage: R09 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR083",
    "semanticIdentity": "spec001:PR083",
    "kind": "prop-model",
    "name": "QSFP test cage",
    "purpose": "QSFP test cage: R09 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR084",
    "semanticIdentity": "spec001:PR084",
    "kind": "prop-model",
    "name": "power injector",
    "purpose": "power injector: R09 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR085",
    "semanticIdentity": "spec001:PR085",
    "kind": "prop-model",
    "name": "powered endpoint model",
    "purpose": "powered endpoint model: R09 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR086",
    "semanticIdentity": "spec001:PR086",
    "kind": "prop-model",
    "name": "coaxial cross-section",
    "purpose": "coaxial cross-section: R09 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR087",
    "semanticIdentity": "spec001:PR087",
    "kind": "prop-model",
    "name": "telephone demarcation box",
    "purpose": "telephone demarcation box: R09 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR088",
    "semanticIdentity": "spec001:PR088",
    "kind": "prop-model",
    "name": "module compatibility chart",
    "purpose": "module compatibility chart: R09 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR089",
    "semanticIdentity": "spec001:PR089",
    "kind": "prop-model",
    "name": "power ledger stand",
    "purpose": "power ledger stand: R09 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR090",
    "semanticIdentity": "spec001:PR090",
    "kind": "prop-model",
    "name": "merchant counter",
    "purpose": "merchant counter: R09 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR091",
    "semanticIdentity": "spec001:PR091",
    "kind": "prop-model",
    "name": "Master timing wheel",
    "purpose": "Master timing wheel: R10 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR092",
    "semanticIdentity": "spec001:PR092",
    "kind": "prop-model",
    "name": "symbol loom",
    "purpose": "symbol loom: R10 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR093",
    "semanticIdentity": "spec001:PR093",
    "kind": "prop-model",
    "name": "four-level signal plinth",
    "purpose": "four-level signal plinth: R10 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR094",
    "semanticIdentity": "spec001:PR094",
    "kind": "prop-model",
    "name": "capability negotiation console",
    "purpose": "capability negotiation console: R10 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR095",
    "semanticIdentity": "spec001:PR095",
    "kind": "prop-model",
    "name": "infrared aperture",
    "purpose": "infrared aperture: R10 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR096",
    "semanticIdentity": "spec001:PR096",
    "kind": "prop-model",
    "name": "sampling gate",
    "purpose": "sampling gate: R10 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR097",
    "semanticIdentity": "spec001:PR097",
    "kind": "prop-model",
    "name": "clock recovery model",
    "purpose": "clock recovery model: R10 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR098",
    "semanticIdentity": "spec001:PR098",
    "kind": "prop-model",
    "name": "pulse corridor gate",
    "purpose": "pulse corridor gate: R10 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR099",
    "semanticIdentity": "spec001:PR099",
    "kind": "prop-model",
    "name": "calibration dial",
    "purpose": "calibration dial: R10 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR100",
    "semanticIdentity": "spec001:PR100",
    "kind": "prop-model",
    "name": "bit-pattern projector",
    "purpose": "bit-pattern projector: R10 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR101",
    "semanticIdentity": "spec001:PR101",
    "kind": "prop-model",
    "name": "Excavation trench segment",
    "purpose": "Excavation trench segment: R11 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR102",
    "semanticIdentity": "spec001:PR102",
    "kind": "prop-model",
    "name": "severed conduit cross-section",
    "purpose": "severed conduit cross-section: R11 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR103",
    "semanticIdentity": "spec001:PR103",
    "kind": "prop-model",
    "name": "repair bridge deck",
    "purpose": "repair bridge deck: R11 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR104",
    "semanticIdentity": "spec001:PR104",
    "kind": "prop-model",
    "name": "emergency radio tripod",
    "purpose": "emergency radio tripod: R11 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR105",
    "semanticIdentity": "spec001:PR105",
    "kind": "prop-model",
    "name": "fiber splice worktable",
    "purpose": "fiber splice worktable: R11 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR106",
    "semanticIdentity": "spec001:PR106",
    "kind": "prop-model",
    "name": "copper bypass frame",
    "purpose": "copper bypass frame: R11 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR107",
    "semanticIdentity": "spec001:PR107",
    "kind": "prop-model",
    "name": "work-zone barrier",
    "purpose": "work-zone barrier: R11 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR108",
    "semanticIdentity": "spec001:PR108",
    "kind": "prop-model",
    "name": "excavation permit lectern",
    "purpose": "excavation permit lectern: R11 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR109",
    "semanticIdentity": "spec001:PR109",
    "kind": "prop-model",
    "name": "restoration control post",
    "purpose": "restoration control post: R11 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR110",
    "semanticIdentity": "spec001:PR110",
    "kind": "prop-model",
    "name": "temporary-route sign",
    "purpose": "temporary-route sign: R11 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR111",
    "semanticIdentity": "spec001:PR111",
    "kind": "prop-model",
    "name": "Iron City boundary gate",
    "purpose": "Iron City boundary gate: R12 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR112",
    "semanticIdentity": "spec001:PR112",
    "kind": "prop-model",
    "name": "restored beacon",
    "purpose": "restored beacon: R12 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR113",
    "semanticIdentity": "spec001:PR113",
    "kind": "prop-model",
    "name": "validation terminal",
    "purpose": "validation terminal: R12 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR114",
    "semanticIdentity": "spec001:PR114",
    "kind": "prop-model",
    "name": "observation balcony",
    "purpose": "observation balcony: R12 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR115",
    "semanticIdentity": "spec001:PR115",
    "kind": "prop-model",
    "name": "ending mural frame",
    "purpose": "ending mural frame: R12 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR116",
    "semanticIdentity": "spec001:PR116",
    "kind": "prop-model",
    "name": "maintenance schedule board",
    "purpose": "maintenance schedule board: R12 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR117",
    "semanticIdentity": "spec001:PR117",
    "kind": "prop-model",
    "name": "link-status totem",
    "purpose": "link-status totem: R12 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR118",
    "semanticIdentity": "spec001:PR118",
    "kind": "prop-model",
    "name": "chapter seal pedestal",
    "purpose": "chapter seal pedestal: R12 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR119",
    "semanticIdentity": "spec001:PR119",
    "kind": "prop-model",
    "name": "return-path arch",
    "purpose": "return-path arch: R12 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR120",
    "semanticIdentity": "spec001:PR120",
    "kind": "prop-model",
    "name": "gateway threshold plaque",
    "purpose": "gateway threshold plaque: R12 modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR121",
    "semanticIdentity": "spec001:PR121",
    "kind": "prop-model",
    "name": "Notebook",
    "purpose": "Notebook: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR122",
    "semanticIdentity": "spec001:PR122",
    "kind": "prop-model",
    "name": "continuity tester",
    "purpose": "continuity tester: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR123",
    "semanticIdentity": "spec001:PR123",
    "kind": "prop-model",
    "name": "optical power meter",
    "purpose": "optical power meter: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR124",
    "semanticIdentity": "spec001:PR124",
    "kind": "prop-model",
    "name": "channel analyzer",
    "purpose": "channel analyzer: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR125",
    "semanticIdentity": "spec001:PR125",
    "kind": "prop-model",
    "name": "cable probe",
    "purpose": "cable probe: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR126",
    "semanticIdentity": "spec001:PR126",
    "kind": "prop-model",
    "name": "inspection lens",
    "purpose": "inspection lens: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR127",
    "semanticIdentity": "spec001:PR127",
    "kind": "prop-model",
    "name": "cleaning wand",
    "purpose": "cleaning wand: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR128",
    "semanticIdentity": "spec001:PR128",
    "kind": "prop-model",
    "name": "crimp tool",
    "purpose": "crimp tool: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR129",
    "semanticIdentity": "spec001:PR129",
    "kind": "prop-model",
    "name": "splice tool",
    "purpose": "splice tool: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR130",
    "semanticIdentity": "spec001:PR130",
    "kind": "prop-model",
    "name": "insulated gloves",
    "purpose": "insulated gloves: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR131",
    "semanticIdentity": "spec001:PR131",
    "kind": "prop-model",
    "name": "warning cone",
    "purpose": "warning cone: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR132",
    "semanticIdentity": "spec001:PR132",
    "kind": "prop-model",
    "name": "repair clamp",
    "purpose": "repair clamp: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR133",
    "semanticIdentity": "spec001:PR133",
    "kind": "prop-model",
    "name": "cable tie bundle",
    "purpose": "cable tie bundle: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR134",
    "semanticIdentity": "spec001:PR134",
    "kind": "prop-model",
    "name": "floor junction box",
    "purpose": "floor junction box: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR135",
    "semanticIdentity": "spec001:PR135",
    "kind": "prop-model",
    "name": "ceiling insulator",
    "purpose": "ceiling insulator: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR136",
    "semanticIdentity": "spec001:PR136",
    "kind": "prop-model",
    "name": "hanging lamp",
    "purpose": "hanging lamp: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR137",
    "semanticIdentity": "spec001:PR137",
    "kind": "prop-model",
    "name": "maintenance ladder",
    "purpose": "maintenance ladder: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR138",
    "semanticIdentity": "spec001:PR138",
    "kind": "prop-model",
    "name": "service hatch",
    "purpose": "service hatch: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR139",
    "semanticIdentity": "spec001:PR139",
    "kind": "prop-model",
    "name": "pipe valve",
    "purpose": "pipe valve: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR140",
    "semanticIdentity": "spec001:PR140",
    "kind": "prop-model",
    "name": "crystal battery",
    "purpose": "crystal battery: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR141",
    "semanticIdentity": "spec001:PR141",
    "kind": "prop-model",
    "name": "fuse cartridge",
    "purpose": "fuse cartridge: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR142",
    "semanticIdentity": "spec001:PR142",
    "kind": "prop-model",
    "name": "grounding braid",
    "purpose": "grounding braid: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR143",
    "semanticIdentity": "spec001:PR143",
    "kind": "prop-model",
    "name": "equipment case",
    "purpose": "equipment case: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR144",
    "semanticIdentity": "spec001:PR144",
    "kind": "prop-model",
    "name": "bench stool",
    "purpose": "bench stool: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR145",
    "semanticIdentity": "spec001:PR145",
    "kind": "prop-model",
    "name": "spare connector tray",
    "purpose": "spare connector tray: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR146",
    "semanticIdentity": "spec001:PR146",
    "kind": "prop-model",
    "name": "map scroll",
    "purpose": "map scroll: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR147",
    "semanticIdentity": "spec001:PR147",
    "kind": "prop-model",
    "name": "maintenance key",
    "purpose": "maintenance key: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR148",
    "semanticIdentity": "spec001:PR148",
    "kind": "prop-model",
    "name": "evidence tag",
    "purpose": "evidence tag: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR149",
    "semanticIdentity": "spec001:PR149",
    "kind": "prop-model",
    "name": "magnifying visor",
    "purpose": "magnifying visor: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-PR150",
    "semanticIdentity": "spec001:PR150",
    "kind": "prop-model",
    "name": "message test token",
    "purpose": "message test token: Shared modeled environment or evidence allocation; exact interaction and placement await scene production.",
    "plannedRoomIds": [],
    "plannedUse": "prop-placement"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R01-background",
    "semanticIdentity": "spec001:LAYER-R01-background",
    "kind": "scene-layer",
    "name": "The Arrival Lift — background",
    "purpose": "Basalt lift shaft with impossible distant signal ducts; warm landing below a cool shaft",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "background"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R01-midground",
    "semanticIdentity": "spec001:LAYER-R01-midground",
    "kind": "scene-layer",
    "name": "The Arrival Lift — midground",
    "purpose": "Suspended signal-tube arches behind the measured path; POWER and LINK reserved for real UI",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "midground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R01-foreground",
    "semanticIdentity": "spec001:LAYER-R01-foreground",
    "kind": "scene-layer",
    "name": "The Arrival Lift — foreground",
    "purpose": "Insulated rail ends at the outer corners; clear central landing and workshop doorway",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "foreground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R02-background",
    "semanticIdentity": "spec001:LAYER-R02-background",
    "kind": "scene-layer",
    "name": "The Titan's Workshop — background",
    "purpose": "Cathedral-sized basalt workshop, amber forge alcove and five branch doors",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "background"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R02-midground",
    "semanticIdentity": "spec001:LAYER-R02-midground",
    "kind": "scene-layer",
    "name": "The Titan's Workshop — midground",
    "purpose": "Copper pipe ribs and quiet hanging tool silhouettes behind the topology bench",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "midground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R02-foreground",
    "semanticIdentity": "spec001:LAYER-R02-foreground",
    "kind": "scene-layer",
    "name": "The Titan's Workshop — foreground",
    "purpose": "Worn bench-edge tools at the lower corners, leaving Titan and route exits open",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "foreground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R03-background",
    "semanticIdentity": "spec001:LAYER-R03-background",
    "kind": "scene-layer",
    "name": "The Copper Warrens — background",
    "purpose": "Warm copper seams braid through dark rock, like roots built by electricians",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "background"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R03-midground",
    "semanticIdentity": "spec001:LAYER-R03-midground",
    "kind": "scene-layer",
    "name": "The Copper Warrens — midground",
    "purpose": "Separated cable trays and motor recess; keep the inspection strip unobscured",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "midground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R03-foreground",
    "semanticIdentity": "spec001:LAYER-R03-foreground",
    "kind": "scene-layer",
    "name": "The Copper Warrens — foreground",
    "purpose": "Large cable-spool rim and short loose wire tips, clear of continuity pedestal",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "foreground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R04-background",
    "semanticIdentity": "spec001:LAYER-R04-background",
    "kind": "scene-layer",
    "name": "The Echo Cavern — background",
    "purpose": "Deep blue cavern with repeating arches diminishing toward silence",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "background"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R04-midground",
    "semanticIdentity": "spec001:LAYER-R04-midground",
    "kind": "scene-layer",
    "name": "The Echo Cavern — midground",
    "purpose": "Stone ribs behind the repeater and serial post, with a clean sprite acting area",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "midground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R04-foreground",
    "semanticIdentity": "spec001:LAYER-R04-foreground",
    "kind": "scene-layer",
    "name": "The Echo Cavern — foreground",
    "purpose": "Rounded echo stones at both margins; never cover the visible broken span",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "foreground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R05-background",
    "semanticIdentity": "spec001:LAYER-R05-background",
    "kind": "scene-layer",
    "name": "The Photon Gardens — background",
    "purpose": "Jade-black grotto with glassy fiber roots and distant pearl light blossoms",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "background"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R05-midground",
    "semanticIdentity": "spec001:LAYER-R05-midground",
    "kind": "scene-layer",
    "name": "The Photon Gardens — midground",
    "purpose": "Light blossom canopy behind a clear inspection dock and optical path",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "midground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R05-foreground",
    "semanticIdentity": "spec001:LAYER-R05-foreground",
    "kind": "scene-layer",
    "name": "The Photon Gardens — foreground",
    "purpose": "Opaque root silhouettes with alpha-edged leaves at corners, no bloom over connector",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "foreground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R06-background",
    "semanticIdentity": "spec001:LAYER-R06-background",
    "kind": "scene-layer",
    "name": "The Prism Vault — background",
    "purpose": "Tall violet basalt vault with one warm work pool and faint refracted ceiling bands",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "background"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R06-midground",
    "semanticIdentity": "spec001:LAYER-R06-midground",
    "kind": "scene-layer",
    "name": "The Prism Vault — midground",
    "purpose": "Suspended prisms behind the power-meter desk; no fake readable numbers",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "midground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R06-foreground",
    "semanticIdentity": "spec001:LAYER-R06-foreground",
    "kind": "scene-layer",
    "name": "The Prism Vault — foreground",
    "purpose": "Dark cut-crystal frame edges, leaving spectrum window and abacus clear",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "foreground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R07-background",
    "semanticIdentity": "spec001:LAYER-R07-background",
    "kind": "scene-layer",
    "name": "The Skywell — background",
    "purpose": "Underground chimney opening onto indigo sky; bright dawn rim above antenna ledge",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "background"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R07-midground",
    "semanticIdentity": "spec001:LAYER-R07-midground",
    "kind": "scene-layer",
    "name": "The Skywell — midground",
    "purpose": "Distant relay structures and cables framing a visible path corridor",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "midground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R07-foreground",
    "semanticIdentity": "spec001:LAYER-R07-foreground",
    "kind": "scene-layer",
    "name": "The Skywell — foreground",
    "purpose": "Wind-worn masonry and antenna cable at outer edges; preserve alignment scope",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "foreground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R08-background",
    "semanticIdentity": "spec001:LAYER-R08-background",
    "kind": "scene-layer",
    "name": "The Storm Observatory — background",
    "purpose": "Round observatory over clouds inside a cavern, rain-lit blue stone",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "background"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R08-midground",
    "semanticIdentity": "spec001:LAYER-R08-midground",
    "kind": "scene-layer",
    "name": "The Storm Observatory — midground",
    "purpose": "Window struts behind survey desk and telescope; no flashing lightning",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "midground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R08-foreground",
    "semanticIdentity": "spec001:LAYER-R08-foreground",
    "kind": "scene-layer",
    "name": "The Storm Observatory — foreground",
    "purpose": "Rain-dark sill corners, transparent center over candidate-channel controls",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "foreground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R09-background",
    "semanticIdentity": "spec001:LAYER-R09-background",
    "kind": "scene-layer",
    "name": "The Shell Market — background",
    "purpose": "Amber market alcoves in shell-shaped basalt niches with teal reflected fill",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "background"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R09-midground",
    "semanticIdentity": "spec001:LAYER-R09-midground",
    "kind": "scene-layer",
    "name": "The Shell Market — midground",
    "purpose": "Unlettered canopy shapes behind module stalls and power ledger",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "midground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R09-foreground",
    "semanticIdentity": "spec001:LAYER-R09-foreground",
    "kind": "scene-layer",
    "name": "The Shell Market — foreground",
    "purpose": "Counter lip and hanging empty shell edge, clear of module comparison areas",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "foreground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R10-background",
    "semanticIdentity": "spec001:LAYER-R10-background",
    "kind": "scene-layer",
    "name": "The Clockworks — background",
    "purpose": "Monumental brass clockwork sunk in cobalt rock; measured light along the floor",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "background"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R10-midground",
    "semanticIdentity": "spec001:LAYER-R10-midground",
    "kind": "scene-layer",
    "name": "The Clockworks — midground",
    "purpose": "Slow gear silhouettes behind symbol loom and capability console",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "midground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R10-foreground",
    "semanticIdentity": "spec001:LAYER-R10-foreground",
    "kind": "scene-layer",
    "name": "The Clockworks — foreground",
    "purpose": "Stationary gear teeth along outer edges, no moving foreground occluder",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "foreground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R11-background",
    "semanticIdentity": "spec001:LAYER-R11-background",
    "kind": "scene-layer",
    "name": "The Backhoe Rift — background",
    "purpose": "Large broken trench under a quiet industrial sky of rock; copper, fiber and radio routes visible",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "background"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R11-midground",
    "semanticIdentity": "spec001:LAYER-R11-midground",
    "kind": "scene-layer",
    "name": "The Backhoe Rift — midground",
    "purpose": "Cut conduit walls and stable scaffold behind the repair work area",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "midground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R11-foreground",
    "semanticIdentity": "spec001:LAYER-R11-foreground",
    "kind": "scene-layer",
    "name": "The Backhoe Rift — foreground",
    "purpose": "Work-zone rail stubs at margins; always reveal break and preparation exit",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "foreground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R12-background",
    "semanticIdentity": "spec001:LAYER-R12-background",
    "kind": "scene-layer",
    "name": "The Iron Threshold — background",
    "purpose": "Enormous closed Iron City gate with warm dawn below it; a world beyond this episode",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "background"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R12-midground",
    "semanticIdentity": "spec001:LAYER-R12-midground",
    "kind": "scene-layer",
    "name": "The Iron Threshold — midground",
    "purpose": "Balcony columns behind validation terminal and separate link beacon",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "midground"
  },
  {
    "assetId": "spec001:ASSET-LAYER-R12-foreground",
    "semanticIdentity": "spec001:LAYER-R12-foreground",
    "kind": "scene-layer",
    "name": "The Iron Threshold — foreground",
    "purpose": "Polished worn threshold stones framing a clear return arch",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "foreground"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH01",
    "semanticIdentity": "spec001:PORTRAIT-CH01",
    "kind": "portrait",
    "name": "The Apprentice portrait",
    "purpose": "Compendium identity and limitation entry; Asymmetric tool satchel, practical cuffed coat, rounded boots; attentive three-quarter pose",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH01"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH02",
    "semanticIdentity": "spec001:PORTRAIT-CH02",
    "kind": "portrait",
    "name": "The Titan portrait",
    "purpose": "Compendium identity and limitation entry; Broad basalt shoulders, brass repair apron, gentle eyes and one precise articulated finger",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH02"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH03",
    "semanticIdentity": "spec001:PORTRAIT-CH03",
    "kind": "portrait",
    "name": "Photon the Firefly portrait",
    "purpose": "Compendium identity and limitation entry; Pear-shaped luminous abdomen, dark face mask and two readable antennae; curious tilted head",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH03"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH04",
    "semanticIdentity": "spec001:PORTRAIT-CH04",
    "kind": "portrait",
    "name": "Copperhead Snake portrait",
    "purpose": "Compendium identity and limitation entry; Braided copper scale plates, insulated belly and split cable-tester tail; patient coil",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH04"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH05",
    "semanticIdentity": "spec001:PORTRAIT-CH05",
    "kind": "portrait",
    "name": "Single-Mode Unicorn portrait",
    "purpose": "Compendium identity and limitation entry; Slender pearl horn and one smooth glass mane ribbon; poised and exact",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH05"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH06",
    "semanticIdentity": "spec001:PORTRAIT-CH06",
    "kind": "portrait",
    "name": "Multimode Hydra portrait",
    "purpose": "Compendium identity and limitation entry; Several optically refracted necks sharing one body; modes represented without invented data lanes",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH06"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH07",
    "semanticIdentity": "spec001:PORTRAIT-CH07",
    "kind": "portrait",
    "name": "Thunderbird portrait",
    "purpose": "Compendium identity and limitation entry; Broad feather antenna silhouette and wind-worn blue plumage; steady perched stance",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH07"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH08",
    "semanticIdentity": "spec001:PORTRAIT-CH08",
    "kind": "portrait",
    "name": "Blue Dragon portrait",
    "purpose": "Compendium identity and limitation entry; Small rounded radio-exhibit dragon with cheek fins and folded wings; sociable expression",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH08"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH09",
    "semanticIdentity": "spec001:PORTRAIT-CH09",
    "kind": "portrait",
    "name": "Red Scorpion portrait",
    "purpose": "Compendium identity and limitation entry; Ruby infrared lens tail and matte segmented claws; tail aimed away from viewer",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH09"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH10",
    "semanticIdentity": "spec001:PORTRAIT-CH10",
    "kind": "portrait",
    "name": "Microwave Phoenix portrait",
    "purpose": "Compendium identity and limitation entry; Swept dish-like wings and narrow relay crest; focused gaze toward the path",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH10"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH11",
    "semanticIdentity": "spec001:PORTRAIT-CH11",
    "kind": "portrait",
    "name": "Celestial Eagle portrait",
    "purpose": "Compendium identity and limitation entry; Long silver wings, orbital-ring plumage and distant gaze; scale explained as perspective",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH11"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH12",
    "semanticIdentity": "spec001:PORTRAIT-CH12",
    "kind": "portrait",
    "name": "Iron Golem portrait",
    "purpose": "Compendium identity and limitation entry; Blocky iron chassis, visibly separate interface sockets and one warm eye slit",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH12"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH13",
    "semanticIdentity": "spec001:PORTRAIT-CH13",
    "kind": "portrait",
    "name": "Ancient Tortoise portrait",
    "purpose": "Compendium identity and limitation entry; Worn serial-post shell, brass hinge edges and a deliberate friendly smile",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH13"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH14",
    "semanticIdentity": "spec001:PORTRAIT-CH14",
    "kind": "portrait",
    "name": "DSL Mole portrait",
    "purpose": "Compendium identity and limitation entry; Earthy velvet snout, telephone-pair whiskers and miner apron; no broadband superiority claim",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH14"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH15",
    "semanticIdentity": "spec001:PORTRAIT-CH15",
    "kind": "portrait",
    "name": "DOCSIS Badger portrait",
    "purpose": "Compendium identity and limitation entry; Coax-ring chest badge and sturdy striped head; distinct broad silhouette",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH15"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH16",
    "semanticIdentity": "spec001:PORTRAIT-CH16",
    "kind": "portrait",
    "name": "SFP Hermit Crab portrait",
    "purpose": "Compendium identity and limitation entry; Single removable metal shell, orange articulated claws and skeptical raised eyestalk",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH16"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH17",
    "semanticIdentity": "spec001:PORTRAIT-CH17",
    "kind": "portrait",
    "name": "QSFP Chimera portrait",
    "purpose": "Compendium identity and limitation entry; Four deliberately grouped neck motifs on one broad module shell; profile-dependent lanes",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH17"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH18",
    "semanticIdentity": "spec001:PORTRAIT-CH18",
    "kind": "portrait",
    "name": "Rainbow Serpent portrait",
    "purpose": "Compendium identity and limitation entry; Prismatic ribbed scales, separate wavelength ribbons and relaxed serpentine arc",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH18"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH19",
    "semanticIdentity": "spec001:PORTRAIT-CH19",
    "kind": "portrait",
    "name": "Electric Eel portrait",
    "purpose": "Compendium identity and limitation entry; Deep teal body, insulated bronze fins and separate power/data markings supplied as UI",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH19"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH20",
    "semanticIdentity": "spec001:PORTRAIT-CH20",
    "kind": "portrait",
    "name": "Echo Bat portrait",
    "purpose": "Compendium identity and limitation entry; Large dish ears, soft charcoal wings and amber repeater pendant; listening pose",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH20"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH21",
    "semanticIdentity": "spec001:PORTRAIT-CH21",
    "kind": "portrait",
    "name": "Metronome Golem portrait",
    "purpose": "Compendium identity and limitation entry; Pendulum torso and offset brass hands; reassuring slow pose, no urgency",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH21"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH22",
    "semanticIdentity": "spec001:PORTRAIT-CH22",
    "kind": "portrait",
    "name": "Chameleon portrait",
    "purpose": "Compendium identity and limitation entry; Block-pattern skin and two independently attentive eyes; restrained color changes",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH22"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH23",
    "semanticIdentity": "spec001:PORTRAIT-CH23",
    "kind": "portrait",
    "name": "Noise Demon portrait",
    "purpose": "Compendium identity and limitation entry; Ragged smoke-like mane around a solid charcoal face; humorous bafflement, no strobe",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH23"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH24",
    "semanticIdentity": "spec001:PORTRAIT-CH24",
    "kind": "portrait",
    "name": "Crosstalk Twins portrait",
    "purpose": "Compendium identity and limitation entry; Two intertwined but distinct cable-creature heads in one paired portrait and model identity",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH24"
  },
  {
    "assetId": "spec001:ASSET-PORTRAIT-CH25",
    "semanticIdentity": "spec001:PORTRAIT-CH25",
    "kind": "portrait",
    "name": "Backhoe of Doom portrait",
    "purpose": "Compendium identity and limitation entry; Chunky excavator silhouette with expressive bucket and work-worn yellow panels; formidable, absurd",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "compendium-portrait",
    "plannedContentId": "spec001:CH25"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-01",
    "semanticIdentity": "spec001:ILLUSTRATION-01",
    "kind": "illustration",
    "name": "Power and link: two observations",
    "purpose": "Separate lit power lamp and dark link lamp, with adjacent real text states",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-02",
    "semanticIdentity": "spec001:ILLUSTRATION-02",
    "kind": "illustration",
    "name": "Known test payload",
    "purpose": "Two highlighted bytes inside a larger opaque supplied frame; real UI prints 0x4E 0x51 and bits",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-03",
    "semanticIdentity": "spec001:ILLUSTRATION-03",
    "kind": "illustration",
    "name": "Notebook evidence card",
    "purpose": "Open notebook with distinct observation, hypothesis and freshness shapes; labels outside image",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-04",
    "semanticIdentity": "spec001:ILLUSTRATION-04",
    "kind": "illustration",
    "name": "Three physical routes",
    "purpose": "Copper, fiber and radio path thumbnails converging on the same known-good endpoints",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-05",
    "semanticIdentity": "spec001:ILLUSTRATION-05",
    "kind": "illustration",
    "name": "Continuity tester and open path",
    "purpose": "Tester probes either side of a plainly separated copper path",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-06",
    "semanticIdentity": "spec001:ILLUSTRATION-06",
    "kind": "illustration",
    "name": "Cable route-length comparison",
    "purpose": "Two path diagrams with segment boundaries for 95 m and 105 m fictional cases",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-07",
    "semanticIdentity": "spec001:ILLUSTRATION-07",
    "kind": "illustration",
    "name": "Regeneration versus reconnection",
    "purpose": "Before/after waveform beside intact medium; separate unbridged gap panel",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-08",
    "semanticIdentity": "spec001:ILLUSTRATION-08",
    "kind": "illustration",
    "name": "Antique serial message strip",
    "purpose": "Tortoise telegraph and sequential message marks on a continuous strip",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-09",
    "semanticIdentity": "spec001:ILLUSTRATION-09",
    "kind": "illustration",
    "name": "Connector inspection lens",
    "purpose": "Lens above capped connector with separate clean, dirty and damaged inspection panels",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-10",
    "semanticIdentity": "spec001:ILLUSTRATION-10",
    "kind": "illustration",
    "name": "Fiber and optic profile pair",
    "purpose": "Unicorn and Hydra profile cards with visibly different keyed geometry and real UI labels",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-11",
    "semanticIdentity": "spec001:ILLUSTRATION-11",
    "kind": "illustration",
    "name": "Optical budget balance",
    "purpose": "Source, loss components and receiver interval arranged left to right without baked numbers",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-12",
    "semanticIdentity": "spec001:ILLUSTRATION-12",
    "kind": "illustration",
    "name": "Receiver operating window",
    "purpose": "Bounded receiving interval with low-margin and overload markers described in text",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-13",
    "semanticIdentity": "spec001:ILLUSTRATION-13",
    "kind": "illustration",
    "name": "Alignment scope",
    "purpose": "Scope, two compatible antennas and unobstructed declared path",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-14",
    "semanticIdentity": "spec001:ILLUSTRATION-14",
    "kind": "illustration",
    "name": "Signal and noise comparison",
    "purpose": "Two independent bars and a labeled difference bracket rendered by UI",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-15",
    "semanticIdentity": "spec001:ILLUSTRATION-15",
    "kind": "illustration",
    "name": "Channel analyzer field sheet",
    "purpose": "Analyzer beside two dated observation cards with distinct revision stamps",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-16",
    "semanticIdentity": "spec001:ILLUSTRATION-16",
    "kind": "illustration",
    "name": "Weather diary comparison",
    "purpose": "Same antenna view in two conditions with an empty caption band for observed evidence",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-17",
    "semanticIdentity": "spec001:ILLUSTRATION-17",
    "kind": "illustration",
    "name": "Module compatibility checklist",
    "purpose": "Hermit shell next to form factor, supported PHY, medium and wavelength comparison slots",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-18",
    "semanticIdentity": "spec001:ILLUSTRATION-18",
    "kind": "illustration",
    "name": "Delivered-power ledger",
    "purpose": "One supplied delivered-budget tray and three endpoint demand tiles",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-19",
    "semanticIdentity": "spec001:ILLUSTRATION-19",
    "kind": "illustration",
    "name": "Toy four-symbol key",
    "purpose": "Four equally distinct symbol shapes with accessible UI values and two-bit mappings",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-20",
    "semanticIdentity": "spec001:ILLUSTRATION-20",
    "kind": "illustration",
    "name": "Common-capability intersection",
    "purpose": "Two endpoint card groups with a shared central slot",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-21",
    "semanticIdentity": "spec001:ILLUSTRATION-21",
    "kind": "illustration",
    "name": "Repair clamp and safe preparation",
    "purpose": "Clamp, inspected damaged section and a deliberately open preparation checklist",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-22",
    "semanticIdentity": "spec001:ILLUSTRATION-22",
    "kind": "illustration",
    "name": "Rift route record",
    "purpose": "Three route panels plus a separate isolation panel, visually equal in dignity",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-23",
    "semanticIdentity": "spec001:ILLUSTRATION-23",
    "kind": "illustration",
    "name": "Fresh validation receipt",
    "purpose": "New observation card placed beside a visibly stale earlier card",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-ILLUSTRATION-24",
    "semanticIdentity": "spec001:ILLUSTRATION-24",
    "kind": "illustration",
    "name": "Maintenance epilogue folio",
    "purpose": "Three distinct page silhouettes for steady light, borrowed dawn and honest shutdown",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "diagnostic-illustration"
  },
  {
    "assetId": "spec001:ASSET-MUSIC-title",
    "semanticIdentity": "spec001:MUSIC-title",
    "kind": "music",
    "name": "The Apprentice Descends",
    "purpose": "Invitation and curiosity; no borrowed melody or artist imitation",
    "plannedRoomIds": [
      "spec001:TITLE"
    ],
    "plannedUse": "music"
  },
  {
    "assetId": "spec001:ASSET-MUSIC-workshop",
    "semanticIdentity": "spec001:MUSIC-workshop",
    "kind": "music",
    "name": "Tools Before Thunder",
    "purpose": "Reassuring central hub; supports conversation and hypothesis-making",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "music"
  },
  {
    "assetId": "spec001:ASSET-MUSIC-copper",
    "semanticIdentity": "spec001:MUSIC-copper",
    "kind": "music",
    "name": "The Braided Road",
    "purpose": "Copper Warrens investigation; also reusable in R04 after deliberate mix review",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "music"
  },
  {
    "assetId": "spec001:ASSET-MUSIC-fiber",
    "semanticIdentity": "spec001:MUSIC-fiber",
    "kind": "music",
    "name": "Light Has a Long Memory",
    "purpose": "Wonder in Photon Gardens and a restrained reusable Prism Vault bed",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "music"
  },
  {
    "assetId": "spec001:ASSET-MUSIC-radio",
    "semanticIdentity": "spec001:MUSIC-radio",
    "kind": "music",
    "name": "Across the Skywell",
    "purpose": "Open space and uncertain observation; reusable in R08 only after balance review",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "music"
  },
  {
    "assetId": "spec001:ASSET-MUSIC-clockworks",
    "semanticIdentity": "spec001:MUSIC-clockworks",
    "kind": "music",
    "name": "A Step in Your Own Time",
    "purpose": "Untimed symbol practice; pulse is atmosphere, not a countdown",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "music"
  },
  {
    "assetId": "spec001:ASSET-MUSIC-rift",
    "semanticIdentity": "spec001:MUSIC-rift",
    "kind": "music",
    "name": "The Severed, Considered",
    "purpose": "Paused deliberate repair planning; dramatic but not combat/action timer",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "music"
  },
  {
    "assetId": "spec001:ASSET-MUSIC-epilogue",
    "semanticIdentity": "spec001:MUSIC-epilogue",
    "kind": "music",
    "name": "What the Record Remembers",
    "purpose": "Common reflective ending after explicit E01/E02/E03 text classification; tone does not label shutdown repaired",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "music"
  },
  {
    "assetId": "spec001:ASSET-AMBIENCE-R01",
    "semanticIdentity": "spec001:AMBIENCE-R01",
    "kind": "ambience",
    "name": "The Arrival Lift ambience",
    "purpose": "Compare separately labeled power and link indications; no sound proves communication",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "ambience"
  },
  {
    "assetId": "spec001:ASSET-AMBIENCE-R02",
    "semanticIdentity": "spec001:AMBIENCE-R02",
    "kind": "ambience",
    "name": "The Titan's Workshop ambience",
    "purpose": "Hear a workshop at rest; route selection and notebook remain text actions",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "ambience"
  },
  {
    "assetId": "spec001:ASSET-AMBIENCE-R03",
    "semanticIdentity": "spec001:AMBIENCE-R03",
    "kind": "ambience",
    "name": "The Copper Warrens ambience",
    "purpose": "Distinguish atmosphere from measured continuity or interference evidence",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "ambience"
  },
  {
    "assetId": "spec001:ASSET-AMBIENCE-R04",
    "semanticIdentity": "spec001:AMBIENCE-R04",
    "kind": "ambience",
    "name": "The Echo Cavern ambience",
    "purpose": "Reverberation is mood; regeneration cannot bridge the displayed break",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "ambience"
  },
  {
    "assetId": "spec001:ASSET-AMBIENCE-R05",
    "semanticIdentity": "spec001:AMBIENCE-R05",
    "kind": "ambience",
    "name": "The Photon Gardens ambience",
    "purpose": "Optical light stays light; no electrical-power claim or guaranteed parallel payload lanes",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "ambience"
  },
  {
    "assetId": "spec001:ASSET-AMBIENCE-R06",
    "semanticIdentity": "spec001:AMBIENCE-R06",
    "kind": "ambience",
    "name": "The Prism Vault ambience",
    "purpose": "Loss, level, margin and overload remain numeric accessible observations",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "ambience"
  },
  {
    "assetId": "spec001:ASSET-AMBIENCE-R07",
    "semanticIdentity": "spec001:AMBIENCE-R07",
    "kind": "ambience",
    "name": "The Skywell ambience",
    "purpose": "Wind is not a universal signal-quality or throughput meter",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "ambience"
  },
  {
    "assetId": "spec001:ASSET-AMBIENCE-R08",
    "semanticIdentity": "spec001:AMBIENCE-R08",
    "kind": "ambience",
    "name": "The Storm Observatory ambience",
    "purpose": "Text records channel, signal and noise; thunder does not select the correct channel",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "ambience"
  },
  {
    "assetId": "spec001:ASSET-AMBIENCE-R09",
    "semanticIdentity": "spec001:AMBIENCE-R09",
    "kind": "ambience",
    "name": "The Shell Market ambience",
    "purpose": "Keep connector fit, supported profile and delivered power as separate checks",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "ambience"
  },
  {
    "assetId": "spec001:ASSET-AMBIENCE-R10",
    "semanticIdentity": "spec001:AMBIENCE-R10",
    "kind": "ambience",
    "name": "The Clockworks ambience",
    "purpose": "Timing is a toy signal lesson; main progress never requires beat matching",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "ambience"
  },
  {
    "assetId": "spec001:ASSET-AMBIENCE-R11",
    "semanticIdentity": "spec001:AMBIENCE-R11",
    "kind": "ambience",
    "name": "The Backhoe Rift ambience",
    "purpose": "Danger is narrated and paused for decisions; never conceal a route-closing choice",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "ambience"
  },
  {
    "assetId": "spec001:ASSET-AMBIENCE-R12",
    "semanticIdentity": "spec001:AMBIENCE-R12",
    "kind": "ambience",
    "name": "The Iron Threshold ambience",
    "purpose": "A gate reached is not a successful test; future realm boundary remains explicit",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "ambience"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-001",
    "semanticIdentity": "spec001:EFFECT-001",
    "kind": "effect",
    "name": "Interface focus tick",
    "purpose": "Brief wooden tick on explicit focused-control activation",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-002",
    "semanticIdentity": "spec001:EFFECT-002",
    "kind": "effect",
    "name": "Notebook page turn",
    "purpose": "Single paper turn when opening a notebook section",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-003",
    "semanticIdentity": "spec001:EFFECT-003",
    "kind": "effect",
    "name": "Evidence entered",
    "purpose": "Pencil scratch after committed observation",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-004",
    "semanticIdentity": "spec001:EFFECT-004",
    "kind": "effect",
    "name": "Hypothesis pinned",
    "purpose": "Soft tack into cork after hypothesis commit",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-005",
    "semanticIdentity": "spec001:EFFECT-005",
    "kind": "effect",
    "name": "Inventory pickup",
    "purpose": "Leather satchel clasp on actual item acquisition",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-006",
    "semanticIdentity": "spec001:EFFECT-006",
    "kind": "effect",
    "name": "Combination assembled",
    "purpose": "Two-part mechanical fit after valid inventory combination",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-007",
    "semanticIdentity": "spec001:EFFECT-007",
    "kind": "effect",
    "name": "Action unavailable",
    "purpose": "Gentle dull tap following explained unsupported action",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-008",
    "semanticIdentity": "spec001:EFFECT-008",
    "kind": "effect",
    "name": "Save acknowledged",
    "purpose": "Quiet double notebook clasp only on confirmed server save",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-009",
    "semanticIdentity": "spec001:EFFECT-009",
    "kind": "effect",
    "name": "Footsteps on lift metal",
    "purpose": "Two alternating soft boot contacts during visible walk",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-010",
    "semanticIdentity": "spec001:EFFECT-010",
    "kind": "effect",
    "name": "Footsteps on basalt",
    "purpose": "Dry boot scuff for rock floor walk",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-011",
    "semanticIdentity": "spec001:EFFECT-011",
    "kind": "effect",
    "name": "Footsteps on garden gravel",
    "purpose": "Light granular crunch during garden walk",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-012",
    "semanticIdentity": "spec001:EFFECT-012",
    "kind": "effect",
    "name": "Footsteps on workshop timber",
    "purpose": "Warm hollow boot contact near workbench",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-013",
    "semanticIdentity": "spec001:EFFECT-013",
    "kind": "effect",
    "name": "Lift latch",
    "purpose": "Mechanical latch followed by small weight settle on arrival",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-014",
    "semanticIdentity": "spec001:EFFECT-014",
    "kind": "effect",
    "name": "Workshop bellows",
    "purpose": "Short air-and-leather stroke on furnace inspection",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-015",
    "semanticIdentity": "spec001:EFFECT-015",
    "kind": "effect",
    "name": "Copper motor spin-down",
    "purpose": "Descending whirr after interference-source isolation when state authorizes it",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-016",
    "semanticIdentity": "spec001:EFFECT-016",
    "kind": "effect",
    "name": "Repeater relay",
    "purpose": "Two restrained relay contacts on repeater activation",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-017",
    "semanticIdentity": "spec001:EFFECT-017",
    "kind": "effect",
    "name": "Connector cleaning stroke",
    "purpose": "Dry gentle swipe for completed cleaning action",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-018",
    "semanticIdentity": "spec001:EFFECT-018",
    "kind": "effect",
    "name": "Prism shutter",
    "purpose": "Small iris click during selected optical filter inspection",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-019",
    "semanticIdentity": "spec001:EFFECT-019",
    "kind": "effect",
    "name": "Antenna adjustment",
    "purpose": "Controlled ratchet on confirmed alignment adjustment",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-020",
    "semanticIdentity": "spec001:EFFECT-020",
    "kind": "effect",
    "name": "Observatory dome latch",
    "purpose": "Two low metal catches on accessible observatory opening",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-021",
    "semanticIdentity": "spec001:EFFECT-021",
    "kind": "effect",
    "name": "Hermit module seat",
    "purpose": "Keyed connector click only after compatible selection is committed",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-022",
    "semanticIdentity": "spec001:EFFECT-022",
    "kind": "effect",
    "name": "Timing gate lever",
    "purpose": "Single brass detent when stepping the toy sampler",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-023",
    "semanticIdentity": "spec001:EFFECT-023",
    "kind": "effect",
    "name": "Photon inspect glimmer",
    "purpose": "Short glass harmonic while Photon exposes an inspection target",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-024",
    "semanticIdentity": "spec001:EFFECT-024",
    "kind": "effect",
    "name": "Copperhead continuity trace",
    "purpose": "Low paired pulse for Copperhead tracing a selected physical section",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-025",
    "semanticIdentity": "spec001:EFFECT-025",
    "kind": "effect",
    "name": "Unicorn profile match",
    "purpose": "Pure bowed-glass note on profile comparison",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-026",
    "semanticIdentity": "spec001:EFFECT-026",
    "kind": "effect",
    "name": "Hydra mode demonstration",
    "purpose": "Soft spread of related glass tones on voluntary exhibit",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-027",
    "semanticIdentity": "spec001:EFFECT-027",
    "kind": "effect",
    "name": "Thunderbird survey",
    "purpose": "Feather rustle and restrained radio-like sweep on survey",
    "plannedRoomIds": [
      "spec001:R07"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-028",
    "semanticIdentity": "spec001:EFFECT-028",
    "kind": "effect",
    "name": "Hermit shell comparison",
    "purpose": "Two different hollow taps during module comparison",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-029",
    "semanticIdentity": "spec001:EFFECT-029",
    "kind": "effect",
    "name": "Eel power audit",
    "purpose": "Low rounded hum and ledger tick during budget inspection",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-030",
    "semanticIdentity": "spec001:EFFECT-030",
    "kind": "effect",
    "name": "Echo Bat regeneration",
    "purpose": "Short clean repeat with finite tail on regeneration demonstration",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-031",
    "semanticIdentity": "spec001:EFFECT-031",
    "kind": "effect",
    "name": "Chameleon common support",
    "purpose": "Two tones settling on one shared tone when comparing capabilities",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-032",
    "semanticIdentity": "spec001:EFFECT-032",
    "kind": "effect",
    "name": "Measurement sampling",
    "purpose": "Soft instrument sweep while requested measurement is displayed",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-033",
    "semanticIdentity": "spec001:EFFECT-033",
    "kind": "effect",
    "name": "Measurement passes scoped check",
    "purpose": "Small resolved two-note phrase only after actual validator pass",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-034",
    "semanticIdentity": "spec001:EFFECT-034",
    "kind": "effect",
    "name": "Measurement outside bounds",
    "purpose": "Soft unresolved interval after explicit failing result",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-035",
    "semanticIdentity": "spec001:EFFECT-035",
    "kind": "effect",
    "name": "Stale measurement marker",
    "purpose": "Paper stamp when previous evidence becomes stale",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-036",
    "semanticIdentity": "spec001:EFFECT-036",
    "kind": "effect",
    "name": "Copper repair clamp",
    "purpose": "Metal clamp and cable tension release after confirmed repair",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-037",
    "semanticIdentity": "spec001:EFFECT-037",
    "kind": "effect",
    "name": "Fiber splice closure",
    "purpose": "Precision hinge and cover snap after committed splice",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-038",
    "semanticIdentity": "spec001:EFFECT-038",
    "kind": "effect",
    "name": "Radio bridge deployment",
    "purpose": "Tripod unfold and quiet switch detent after bridge setup",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-039",
    "semanticIdentity": "spec001:EFFECT-039",
    "kind": "effect",
    "name": "Backhoe conduit break",
    "purpose": "Short low clunk and grit, skippable on narrated encounter",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-EFFECT-040",
    "semanticIdentity": "spec001:EFFECT-040",
    "kind": "effect",
    "name": "Safe isolation latch",
    "purpose": "Deliberate switch latch after explicit shutdown confirmation",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "effect"
  },
  {
    "assetId": "spec001:ASSET-VOICE-001",
    "semanticIdentity": "spec001:VOICE-001",
    "kind": "voice",
    "name": "Narrator — tutorial 001",
    "purpose": "Introduce warm industrial adventure without technical claims",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-001",
    "plannedSpeakerId": "narrator"
  },
  {
    "assetId": "spec001:ASSET-VOICE-002",
    "semanticIdentity": "spec001:VOICE-002",
    "kind": "voice",
    "name": "Narrator — tutorial 002",
    "purpose": "O01; teach two observations",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-002",
    "plannedSpeakerId": "narrator"
  },
  {
    "assetId": "spec001:ASSET-VOICE-003",
    "semanticIdentity": "spec001:VOICE-003",
    "kind": "voice",
    "name": "Narrator — key-clue 003",
    "purpose": "O01 / LO1; avoid power-link conflation",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-003",
    "plannedSpeakerId": "narrator"
  },
  {
    "assetId": "spec001:ASSET-VOICE-004",
    "semanticIdentity": "spec001:VOICE-004",
    "kind": "voice",
    "name": "Narrator — tutorial 004",
    "purpose": "AC01 / C14; equivalent controls",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-004",
    "plannedSpeakerId": "narrator"
  },
  {
    "assetId": "spec001:ASSET-VOICE-005",
    "semanticIdentity": "spec001:VOICE-005",
    "kind": "voice",
    "name": "Narrator — tutorial 005",
    "purpose": "AC21; spoken hexadecimal read as separate characters; not full frame",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-005",
    "plannedSpeakerId": "narrator"
  },
  {
    "assetId": "spec001:ASSET-VOICE-006",
    "semanticIdentity": "spec001:VOICE-006",
    "kind": "voice",
    "name": "Narrator — key-clue 006",
    "purpose": "AC21 / LO1; accurate simulation boundary",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-006",
    "plannedSpeakerId": "narrator"
  },
  {
    "assetId": "spec001:ASSET-VOICE-007",
    "semanticIdentity": "spec001:VOICE-007",
    "kind": "voice",
    "name": "Narrator — key-clue 007",
    "purpose": "T01/T02; explicitly fictional profile and unit",
    "plannedRoomIds": [
      "spec001:R03"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-007",
    "plannedSpeakerId": "narrator"
  },
  {
    "assetId": "spec001:ASSET-VOICE-008",
    "semanticIdentity": "spec001:VOICE-008",
    "kind": "voice",
    "name": "Narrator — key-clue 008",
    "purpose": "T03; regeneration is not reconnection",
    "plannedRoomIds": [
      "spec001:R04"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-008",
    "plannedSpeakerId": "narrator"
  },
  {
    "assetId": "spec001:ASSET-VOICE-009",
    "semanticIdentity": "spec001:VOICE-009",
    "kind": "voice",
    "name": "Narrator — key-clue 009",
    "purpose": "T04/T05/T06/T15; lower and upper limits plus margin",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-009",
    "plannedSpeakerId": "narrator"
  },
  {
    "assetId": "spec001:ASSET-VOICE-010",
    "semanticIdentity": "spec001:VOICE-010",
    "kind": "voice",
    "name": "Narrator — key-clue 010",
    "purpose": "T08/T09/T13; SNR and freshness",
    "plannedRoomIds": [
      "spec001:R08"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-010",
    "plannedSpeakerId": "narrator"
  },
  {
    "assetId": "spec001:ASSET-VOICE-011",
    "semanticIdentity": "spec001:VOICE-011",
    "kind": "voice",
    "name": "Narrator — tutorial 011",
    "purpose": "O10 / C9; untimed required lesson",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-011",
    "plannedSpeakerId": "narrator"
  },
  {
    "assetId": "spec001:ASSET-VOICE-012",
    "semanticIdentity": "spec001:VOICE-012",
    "kind": "voice",
    "name": "Narrator — key-clue 012",
    "purpose": "T12 / LO5; symbols versus throughput",
    "plannedRoomIds": [
      "spec001:R10"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-012",
    "plannedSpeakerId": "narrator"
  },
  {
    "assetId": "spec001:ASSET-VOICE-013",
    "semanticIdentity": "spec001:VOICE-013",
    "kind": "voice",
    "name": "Narrator — reaction 013",
    "purpose": "Warm failure reaction; no technical success implied",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-013",
    "plannedSpeakerId": "narrator"
  },
  {
    "assetId": "spec001:ASSET-VOICE-014",
    "semanticIdentity": "spec001:VOICE-014",
    "kind": "voice",
    "name": "Narrator — tutorial 014",
    "purpose": "NQ-08; exact retry retention, no implicit save",
    "plannedRoomIds": [
      "spec001:R11"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-014",
    "plannedSpeakerId": "narrator"
  },
  {
    "assetId": "spec001:ASSET-VOICE-015",
    "semanticIdentity": "spec001:VOICE-015",
    "kind": "voice",
    "name": "Narrator — ending 015",
    "purpose": "E01 / LO6; scoped permanent validation",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-015",
    "plannedSpeakerId": "narrator"
  },
  {
    "assetId": "spec001:ASSET-VOICE-016",
    "semanticIdentity": "spec001:VOICE-016",
    "kind": "voice",
    "name": "Narrator — ending 016",
    "purpose": "E02 / LO6; temporary success remains temporary",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-016",
    "plannedSpeakerId": "narrator"
  },
  {
    "assetId": "spec001:ASSET-VOICE-017",
    "semanticIdentity": "spec001:VOICE-017",
    "kind": "voice",
    "name": "Narrator — ending 017",
    "purpose": "E03 / LO6; honest unresolved result",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-017",
    "plannedSpeakerId": "narrator"
  },
  {
    "assetId": "spec001:ASSET-VOICE-018",
    "semanticIdentity": "spec001:VOICE-018",
    "kind": "voice",
    "name": "Narrator — ending 018",
    "purpose": "C3 / NQ-12; future boundary and return",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-018",
    "plannedSpeakerId": "narrator"
  },
  {
    "assetId": "spec001:ASSET-VOICE-019",
    "semanticIdentity": "spec001:VOICE-019",
    "kind": "voice",
    "name": "Titan — tutorial 019",
    "purpose": "Titan welcome; evidence-first investigation",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-019",
    "plannedSpeakerId": "spec001:CH02"
  },
  {
    "assetId": "spec001:ASSET-VOICE-020",
    "semanticIdentity": "spec001:VOICE-020",
    "kind": "voice",
    "name": "Titan — key-clue 020",
    "purpose": "O02; declared scope, not global claim",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-020",
    "plannedSpeakerId": "spec001:CH02"
  },
  {
    "assetId": "spec001:ASSET-VOICE-021",
    "semanticIdentity": "spec001:VOICE-021",
    "kind": "voice",
    "name": "Titan — tutorial 021",
    "purpose": "O02 / LO3; separate observation and inference",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-021",
    "plannedSpeakerId": "spec001:CH02"
  },
  {
    "assetId": "spec001:ASSET-VOICE-022",
    "semanticIdentity": "spec001:VOICE-022",
    "kind": "voice",
    "name": "Titan — tutorial 022",
    "purpose": "NQ-02 / T16; alternatives",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-022",
    "plannedSpeakerId": "spec001:CH02"
  },
  {
    "assetId": "spec001:ASSET-VOICE-023",
    "semanticIdentity": "spec001:VOICE-023",
    "kind": "voice",
    "name": "Titan — key-clue 023",
    "purpose": "NQ-06; optional collection, valid conventional alternative",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-023",
    "plannedSpeakerId": "spec001:CH02"
  },
  {
    "assetId": "spec001:ASSET-VOICE-024",
    "semanticIdentity": "spec001:VOICE-024",
    "kind": "voice",
    "name": "Titan — tutorial 024",
    "purpose": "Nine-recruit party contract; max two",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-024",
    "plannedSpeakerId": "spec001:CH02"
  },
  {
    "assetId": "spec001:ASSET-VOICE-025",
    "semanticIdentity": "spec001:VOICE-025",
    "kind": "voice",
    "name": "Titan — key-clue 025",
    "purpose": "LO1/LO6; scope of link test",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-025",
    "plannedSpeakerId": "spec001:CH02"
  },
  {
    "assetId": "spec001:ASSET-VOICE-026",
    "semanticIdentity": "spec001:VOICE-026",
    "kind": "voice",
    "name": "Titan — tutorial 026",
    "purpose": "C9; assistance not shame",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-026",
    "plannedSpeakerId": "spec001:CH02"
  },
  {
    "assetId": "spec001:ASSET-VOICE-027",
    "semanticIdentity": "spec001:VOICE-027",
    "kind": "voice",
    "name": "Titan — key-clue 027",
    "purpose": "T13; stale evidence",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-027",
    "plannedSpeakerId": "spec001:CH02"
  },
  {
    "assetId": "spec001:ASSET-VOICE-028",
    "semanticIdentity": "spec001:VOICE-028",
    "kind": "voice",
    "name": "Titan — reaction 028",
    "purpose": "Nonpunitive feedback; no incorrect solution award",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-028",
    "plannedSpeakerId": "spec001:CH02"
  },
  {
    "assetId": "spec001:ASSET-VOICE-029",
    "semanticIdentity": "spec001:VOICE-029",
    "kind": "voice",
    "name": "Titan — key-clue 029",
    "purpose": "T14; content-error distinction",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-029",
    "plannedSpeakerId": "spec001:CH02"
  },
  {
    "assetId": "spec001:ASSET-VOICE-030",
    "semanticIdentity": "spec001:VOICE-030",
    "kind": "voice",
    "name": "Titan — tutorial 030",
    "purpose": "O11 / C9; informed consequential action",
    "plannedRoomIds": [
      "spec001:R02"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-030",
    "plannedSpeakerId": "spec001:CH02"
  },
  {
    "assetId": "spec001:ASSET-VOICE-031",
    "semanticIdentity": "spec001:VOICE-031",
    "kind": "voice",
    "name": "Titan — key-clue 031",
    "purpose": "O12; fresh independent validation",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-031",
    "plannedSpeakerId": "spec001:CH02"
  },
  {
    "assetId": "spec001:ASSET-VOICE-032",
    "semanticIdentity": "spec001:VOICE-032",
    "kind": "voice",
    "name": "Titan — ending 032",
    "purpose": "E01 / SQ04; maintenance",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-032",
    "plannedSpeakerId": "spec001:CH02"
  },
  {
    "assetId": "spec001:ASSET-VOICE-033",
    "semanticIdentity": "spec001:VOICE-033",
    "kind": "voice",
    "name": "Titan — ending 033",
    "purpose": "E02; valid workaround with follow-up",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-033",
    "plannedSpeakerId": "spec001:CH02"
  },
  {
    "assetId": "spec001:ASSET-VOICE-034",
    "semanticIdentity": "spec001:VOICE-034",
    "kind": "voice",
    "name": "Titan — ending 034",
    "purpose": "E03; safe continuation, no false restoration",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-034",
    "plannedSpeakerId": "spec001:CH02"
  },
  {
    "assetId": "spec001:ASSET-VOICE-035",
    "semanticIdentity": "spec001:VOICE-035",
    "kind": "voice",
    "name": "Photon — tutorial 035",
    "purpose": "Photon identity and O01 prompt",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-035",
    "plannedSpeakerId": "spec001:CH03"
  },
  {
    "assetId": "spec001:ASSET-VOICE-036",
    "semanticIdentity": "spec001:VOICE-036",
    "kind": "voice",
    "name": "Photon — reaction 036",
    "purpose": "O01; separately inspect indicators",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-036",
    "plannedSpeakerId": "spec001:CH03"
  },
  {
    "assetId": "spec001:ASSET-VOICE-037",
    "semanticIdentity": "spec001:VOICE-037",
    "kind": "voice",
    "name": "Photon — tutorial 037",
    "purpose": "NQ-04; persistence within adventure, not account-save promise",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-037",
    "plannedSpeakerId": "spec001:CH03"
  },
  {
    "assetId": "spec001:ASSET-VOICE-038",
    "semanticIdentity": "spec001:VOICE-038",
    "kind": "voice",
    "name": "Photon — key-clue 038",
    "purpose": "AC21; explicit lab comparison boundary",
    "plannedRoomIds": [
      "spec001:R01"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-038",
    "plannedSpeakerId": "spec001:CH03"
  },
  {
    "assetId": "spec001:ASSET-VOICE-039",
    "semanticIdentity": "spec001:VOICE-039",
    "kind": "voice",
    "name": "Photon — tutorial 039",
    "purpose": "O05 / LO3; inspect first",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-039",
    "plannedSpeakerId": "spec001:CH03"
  },
  {
    "assetId": "spec001:ASSET-VOICE-040",
    "semanticIdentity": "spec001:VOICE-040",
    "kind": "voice",
    "name": "Photon — key-clue 040",
    "purpose": "Safe optical inspection language; technical reviewer confirms production wording",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-040",
    "plannedSpeakerId": "spec001:CH03"
  },
  {
    "assetId": "spec001:ASSET-VOICE-041",
    "semanticIdentity": "spec001:VOICE-041",
    "kind": "voice",
    "name": "Photon — key-clue 041",
    "purpose": "T07; profile before arithmetic",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-041",
    "plannedSpeakerId": "spec001:CH03"
  },
  {
    "assetId": "spec001:ASSET-VOICE-042",
    "semanticIdentity": "spec001:VOICE-042",
    "kind": "voice",
    "name": "Photon — key-clue 042",
    "purpose": "C10; propagation modes caveat",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-042",
    "plannedSpeakerId": "spec001:CH03"
  },
  {
    "assetId": "spec001:ASSET-VOICE-043",
    "semanticIdentity": "spec001:VOICE-043",
    "kind": "voice",
    "name": "Photon — reaction 043",
    "purpose": "C10; light versus electrical power",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-043",
    "plannedSpeakerId": "spec001:CH03"
  },
  {
    "assetId": "spec001:ASSET-VOICE-044",
    "semanticIdentity": "spec001:VOICE-044",
    "kind": "voice",
    "name": "Photon — tutorial 044",
    "purpose": "T13; retained stale evidence",
    "plannedRoomIds": [
      "spec001:R05"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-044",
    "plannedSpeakerId": "spec001:CH03"
  },
  {
    "assetId": "spec001:ASSET-VOICE-045",
    "semanticIdentity": "spec001:VOICE-045",
    "kind": "voice",
    "name": "Photon — key-clue 045",
    "purpose": "AC21; R12 repaired journey",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-045",
    "plannedSpeakerId": "spec001:CH03"
  },
  {
    "assetId": "spec001:ASSET-VOICE-046",
    "semanticIdentity": "spec001:VOICE-046",
    "kind": "voice",
    "name": "Photon — ending 046",
    "purpose": "E01; evidence supports celebration",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-046",
    "plannedSpeakerId": "spec001:CH03"
  },
  {
    "assetId": "spec001:ASSET-VOICE-047",
    "semanticIdentity": "spec001:VOICE-047",
    "kind": "voice",
    "name": "Photon — ending 047",
    "purpose": "E02; limitation visible",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-047",
    "plannedSpeakerId": "spec001:CH03"
  },
  {
    "assetId": "spec001:ASSET-VOICE-048",
    "semanticIdentity": "spec001:VOICE-048",
    "kind": "voice",
    "name": "Photon — ending 048",
    "purpose": "E03; encouraging unresolved outcome",
    "plannedRoomIds": [
      "spec001:R12"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-048",
    "plannedSpeakerId": "spec001:CH03"
  },
  {
    "assetId": "spec001:ASSET-VOICE-049",
    "semanticIdentity": "spec001:VOICE-049",
    "kind": "voice",
    "name": "Hermit — tutorial 049",
    "purpose": "Hermit identity; O09 evidence before cosmetics",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-049",
    "plannedSpeakerId": "spec001:CH16"
  },
  {
    "assetId": "spec001:ASSET-VOICE-050",
    "semanticIdentity": "spec001:VOICE-050",
    "kind": "voice",
    "name": "Hermit — key-clue 050",
    "purpose": "O09 / T07; form factor alone insufficient",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-050",
    "plannedSpeakerId": "spec001:CH16"
  },
  {
    "assetId": "spec001:ASSET-VOICE-051",
    "semanticIdentity": "spec001:VOICE-051",
    "kind": "voice",
    "name": "Hermit — key-clue 051",
    "purpose": "C10; speak acronym clearly, no invented universal rate",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-051",
    "plannedSpeakerId": "spec001:CH16"
  },
  {
    "assetId": "spec001:ASSET-VOICE-052",
    "semanticIdentity": "spec001:VOICE-052",
    "kind": "voice",
    "name": "Hermit — key-clue 052",
    "purpose": "CH17 limitation; QSFP shape not capability guarantee",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-052",
    "plannedSpeakerId": "spec001:CH16"
  },
  {
    "assetId": "spec001:ASSET-VOICE-053",
    "semanticIdentity": "spec001:VOICE-053",
    "kind": "voice",
    "name": "Hermit — tutorial 053",
    "purpose": "T10; explicit delivered-power basis",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-053",
    "plannedSpeakerId": "spec001:CH16"
  },
  {
    "assetId": "spec001:ASSET-VOICE-054",
    "semanticIdentity": "spec001:VOICE-054",
    "kind": "voice",
    "name": "Hermit — key-clue 054",
    "purpose": "T10; fictional example exact arithmetic",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-054",
    "plannedSpeakerId": "spec001:CH16"
  },
  {
    "assetId": "spec001:ASSET-VOICE-055",
    "semanticIdentity": "spec001:VOICE-055",
    "kind": "voice",
    "name": "Hermit — reaction 055",
    "purpose": "LO1; power not data",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-055",
    "plannedSpeakerId": "spec001:CH16"
  },
  {
    "assetId": "spec001:ASSET-VOICE-056",
    "semanticIdentity": "spec001:VOICE-056",
    "kind": "voice",
    "name": "Hermit — key-clue 056",
    "purpose": "T07; compatibility not overridden by power",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-056",
    "plannedSpeakerId": "spec001:CH16"
  },
  {
    "assetId": "spec001:ASSET-VOICE-057",
    "semanticIdentity": "spec001:VOICE-057",
    "kind": "voice",
    "name": "Hermit — key-clue 057",
    "purpose": "T04; pronunciation technical review required",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-057",
    "plannedSpeakerId": "spec001:CH16"
  },
  {
    "assetId": "spec001:ASSET-VOICE-058",
    "semanticIdentity": "spec001:VOICE-058",
    "kind": "voice",
    "name": "Hermit — key-clue 058",
    "purpose": "T05/T06; range and margin",
    "plannedRoomIds": [
      "spec001:R06"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-058",
    "plannedSpeakerId": "spec001:CH16"
  },
  {
    "assetId": "spec001:ASSET-VOICE-059",
    "semanticIdentity": "spec001:VOICE-059",
    "kind": "voice",
    "name": "Hermit — tutorial 059",
    "purpose": "O09; no collect-all requirement",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-059",
    "plannedSpeakerId": "spec001:CH16"
  },
  {
    "assetId": "spec001:ASSET-VOICE-060",
    "semanticIdentity": "spec001:VOICE-060",
    "kind": "voice",
    "name": "Hermit — reaction 060",
    "purpose": "SQ02; grounded power audit humor",
    "plannedRoomIds": [
      "spec001:R09"
    ],
    "plannedUse": "voice-line",
    "plannedContentId": "spec001:DIALOGUE-VOICE-060",
    "plannedSpeakerId": "spec001:CH16"
  }
];
