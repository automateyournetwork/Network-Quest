# R01–R04 scene-layer production

Loop 134 completed the twelve allocated production identities on 2026-11-27. Three R01 records are identical to their integrated records in the canonical inventory. Their original PNGs, production events, exports and reviews remain at the T064/T066 paths. The Workshop, Copper Warrens and Echo Cavern each have a separately generated background, midground and foreground. A tenth new generation supplied the Workshop paving insert. Its six instances belong to the Workshop midground. The nine new public WebPs total 883,944 bytes.

| Room | Visible landmarks and staging | Three WebPs |
| --- | --- | ---: |
| Titan's Workshop | Warm forge vault and cool gallery, overhead pipe ribs with three hanging tongs, pliers and rasp on the near bench edges. Six copper-set paving inserts mark the actual exit floor positions. | 345,102 B |
| Copper Warrens | Mineral copper ribbons rooted in the upper-left shale, two independent separated trays at upper right, a reel rim opposite exposed loose wire tips at the lower edges. Both repair stations and side approaches remain visible. | 259,974 B |
| Echo Cavern | Receding blue acoustic arches, a small amber postal light, eroded pendant ribs and two different stone silhouettes at the margins. A broad stage separates the broken span and the postal group. | 278,868 B |

The ten original PNGs, exact prompts, settings and tool-return records live in the room source directories. The tool exposed the image URL and output hint. The returned filenames identify each preserved original. All reference inputs were project assets. Every camera guide came from frozen coordinates and actual Blender-imported GLBs. PR144, PR146, PR147 and PR148 were unavailable for their initial guides. All four were present for final cast verification. The guide and final cast each retain their own input hashes. The exact masks, transforms and generation ancestry are available with the [fragment](../../../../../assets-src/images/rooms-01-04.json).

## Inspection

The separate midground images render behind the cast. The foreground alpha is confined to the two T106 wedges. The exported corner details are intentionally small enough to protect narrow-layout controls. Agent inspection covered the opaque originals and the transparency of raw and exported assets on cream and blue-black mattes. The central stage is clear in each export. The crisp edge on the Copper Warrens tray reads as a cut metal lip. The Echo Cavern rib leaves the post light visible. Backgrounds contain environment architecture and floor, while the selected teaching and control elements remain in the live cast or semantic interface.

Blender 5.2.1 LTS rendered final casts of 20, 18 and 15 placed GLBs respectively. Native Firefox 159.0 opened the actual WebPs and cast PNGs at 1280×720 and a contained 16:9 stage at 390×844. One additional capture per room shows 44 CSS pixel diagnostic circles at the frozen exit eye anchors. The narrow captures show the complete room and the tiny on-model labels. Legible text will require the contextual interface. The largest coordinate difference against an independent Three.js camera projection was 0.0054 CSS pixels. This measures the frozen anchors and registration frame. Painted arches have no exact surveyed geometry. The foreground covered zero pixels in the 44×44 CSS pixel regions at all 40 exit and hotspot anchors at both viewport widths.

| Room | Desktop | Narrow | Diagnostic exit overlay | Matte comparisons |
| --- | --- | --- | --- | --- |
| R02 | [Composite](R02/desktop.png) | [390 px](R02/narrow.png) | [Six exits](R02/exits.png) | [Originals](R02/raw-mattes.jpg), [WebPs](R02/web-mattes.jpg) |
| R03 | [Composite](R03/desktop.png) | [390 px](R03/narrow.png) | [Two exits](R03/exits.png) | [Originals](R03/raw-mattes.jpg), [WebPs](R03/web-mattes.jpg) |
| R04 | [Composite](R04/desktop.png) | [390 px](R04/narrow.png) | [Two exits](R04/exits.png) | [Originals](R04/raw-mattes.jpg), [WebPs](R04/web-mattes.jpg) |

## Workshop rework and integration findings

In the first isolated staging, the arches gave few clues to all six registered approaches. A separate built-in generation produced a stone and copper paving texture. The export program applies the orthographic ground-plane transform at each existing exit point with its long edge along the matching boundary. Five inserts are fully visible in the final cast. The lift-return insert is 74.4% visible. The environment preserves the six authored routes and their existing IDs. The media layer cannot select an exit. [Initial view](R02/first-stage/exits.png) · [Revised view](R02/exits.png) · [Pixel measurements](R02/pixels.json)

The frozen placement brings the lift-return control over the Titan and cabinet, the Warrens control across the carousel and the Clockworks control over the Golem. At 1280×720 the solid cast covers 100%, 74.2% and 94.8% of their 44-pixel target squares respectively. The Market square has 12.6% cast coverage near the rack. Characters/props and the exit remain distinct semantic targets. T135 needs visible destination labels or unobstructed marker placement tied to each actual exit, the contained Scene list, keyboard equivalence and selection tests at normal/narrow widths.

PR020's furnace fills most of the back-left arch and appears higher than its intended ground contact. Its size competes with the Titan. This review uses a transparent Blender workbench cast with studio shading. The workbench feet and hypothesis-board feet have no convincing receiving shadows on the painted floor. T135 must inspect scale, footing, shadow receivers, lighting match and owner-reviewed final composition in the native room. A rear arcade opening is scenic until the room binds an actual named exit. T136 must verify curve and sprite clipping with live actors, including the Echo Bat in front of the cavern ribs and the Tortoise by the telegraph and printer.

The initial inventory validator rejected nine overlength preset descriptions. Shortening the metadata produced a clean schema and inventory pass. Current records are exported with quota disabled. Budget acceptance, live-room use, native interactions, sprite animation and owner approval remain with their assigned later tasks. [Initial inventory](first-fragment-inventory.json) · [Corrected inventory](fragment-inventory.json)
