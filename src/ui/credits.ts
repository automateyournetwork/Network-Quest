// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

/** Only the short credits enter the application shell. Detailed registers load on demand. */
export function appendCredits(panel: HTMLElement) {
  const doc = panel.ownerDocument;
  const paragraph = (text: string) => {
    const p = doc.createElement('p');
    p.textContent = text;
    panel.append(p);
  };
  const heading = (text: string) => {
    const h = doc.createElement('h3');
    h.textContent = text;
    panel.append(h);
  };
  const link = (label: string, href: string) => {
    const p = doc.createElement('p'), a = doc.createElement('a');
    a.textContent = label;
    a.href = href;
    // Leaving the adventure tab would discard guest progress.
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    p.append(a);
    panel.append(p);
  };

  paragraph('Network Quest — John Capobianco and contributors.');
  paragraph('John Capobianco directed the Underworld adventure. OpenAI Codex assisted with programming, modeling, art direction and sound design.');
  heading('Art, music and voices');
  paragraph('The team modeled the cast, props and rooms in Blender and rendered the sprite sheets there. OpenAI image generation produced the room layers, portraits and teaching illustrations from project references.');
  paragraph('ACE-Step generated the instrumental music. The team synthesized the ambience and effects and edited the mixes in Audacity. Kokoro voices the narrator, Titan, Photon and Hermit from their written lines.');
  heading('Reuse and attribution');
  paragraph('Original code and build scripts use Apache-2.0. Original writing, artwork, editable media and audio use CC BY 4.0 to the extent the project controls the rights. Credit the project and named creators, keep the applicable notices and describe your changes.');
  paragraph('Three.js renders the rooms. Ajv and its helpers validate game data. Each library and production model keeps its own terms. The following references open in a new tab.');
  link('Media credits and editable sources', import.meta.env.BASE_URL + 'credits/media.html');
  link('Software notices and full license texts', import.meta.env.BASE_URL + 'credits/notices.txt');
  link('Network Quest source repository', 'https://github.com/automateyournetwork/Network-Quest');
}
