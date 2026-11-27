# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
from instruments import *
from fixtures import *
from fieldkit import *

MODELS={121:(notebook,.40,'base',(.40,-1,1.0))}
MODELS.update({
    122:(continuity,.47,'base',(.34,-1,.54)),
    123:(power_meter,.42,'base',(.32,-1,.36)),
    124:(channel_analyzer,.48,'base',(.36,-1,.48)),
    125:(cable_probe,.32,'base',(.28,-1,.9)),
    126:(inspection_lens,.29,'base',(.40,-1,.38)),
    127:(cleaning_wand,.24,'base',(.35,-1,.64)),
    128:(crimper,.32,'base',(.33,-1,1.4)),
    129:(splice_tool,.40,'base',(.40,-1,.82)),
    130:(gloves,.37,'base',(.32,-1,1.18)),
})
MODELS.update({
    131:(warning_cone,.64,'base',(.5,-1,.55)),
    132:(repair_clamp,.27,'center',(.40,-1,.43)),
    133:(cable_ties,.26,'top',(.34,-1,.36)),
    134:(junction_box,.68,'base',(.48,-1,.91)),
    135:(ceiling_insulator,.46,'top',(.42,-1,.38)),
    136:(hanging_lamp,.85,'top',(.48,-1,.10)),
    137:(maintenance_ladder,2.36,'base',(.58,-1,.30)),
    138:(service_hatch,1.14,'base',(.32,-1,.30)),
    139:(pipe_valve,.35,'center',(.51,-1,.67)),
})
MODELS.update({
    140:(crystal_battery,.28,'base',(.43,-1,.34)),
    141:(fuse_cartridge,.13,'base',(.31,-1,.75)),
    142:(grounding_braid,.39,'center',(.32,-1,1.34)),
    143:(equipment_case,.68,'base',(.57,-1,.57)),
    144:(bench_stool,.65,'base',(.51,-1,.48)),
    145:(connector_tray,.39,'base',(.40,-1,1.23)),
    146:(map_scroll,.40,'base',(.24,-1,1.08)),
    147:(maintenance_key,.16,'top',(.36,-1,.35)),
    148:(evidence_tag,.14,'top',(.26,-1,.36)),
    149:(magnifying_visor,.24,'center',(.49,-1,.67)),
    150:(message_token,.13,'base',(.36,-1,1.1)),
})
