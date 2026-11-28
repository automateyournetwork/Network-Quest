// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Additional production actions for the joined timing and Credits revisions.
export function refinements({doc, app, get, wait, click, close, walk, reach, result, suite, input}) {
  const checks = result.refinements = [];
  const sequence = async (...labels) => { for (const label of labels) await click(label); };
  const actorNames = ['Single-Mode Unicorn','Multimode Hydra'];
  async function title() {
    const rect = () => {
      const r=get('New Adventure').getBoundingClientRect();
      return [r.x,r.y,r.width,r.height];
    };
    const initial=rect();
    await new Promise(resolve=>setTimeout(resolve,200));
    const settled=rect();
    if (initial.some((n,i)=>Math.abs(n-settled[i])>1)) throw Error('New Adventure moved on the settled guest title');
    checks.push({check:'Guest title control remained in position',initial,settled});
    if (suite!=='credits') return;
    await click('Credits');
    const panel=await wait(()=>doc.querySelector('[role=dialog][aria-label=Credits]:not([hidden])'),'Credits panel');
    for (const text of ['Blender','OpenAI','ACE-Step','Kokoro','Apache-2.0','CC BY 4.0']) {
      if (!panel.textContent.includes(text)) throw Error('Credits missing '+text);
    }
    const resources=[];
    for (const [label,suffix] of [['Media credits and editable sources','credits/media.html'],['Software notices and full license texts','credits/notices.txt']]) {
      const link=[...panel.querySelectorAll('a[href]')].find(a=>a.textContent===label);
      if (!link || new URL(link.href).origin!==app.location.origin || !link.href.endsWith(suffix) || link.target!=='_blank' || !link.relList.contains('noopener'))
        throw Error('Missing safe new-tab Credits link '+label);
      if (input==='keyboard') await reach(()=>link);
      else link.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
      const rect=link.getBoundingClientRect(), hit=doc.elementFromPoint(rect.left+Math.min(4,rect.width/2),rect.top+rect.height/2);
      if (hit!==link && !link.contains(hit)) throw Error('Credits link obscured after traversal '+label);
      const reply=await app.fetch(link.href);
      if (!reply.ok) throw Error('Credits reference failed '+suffix);
      resources.push({path:suffix,bytes:(await reply.arrayBuffer()).byteLength});
    }
    await click('Close credits');
    checks.push({check:'Credits in game and both same-origin notices',resources});
  }
  async function inGame(){
    if (suite!=='credits') return;
    await click('Credits');
    const panel=await wait(()=>doc.querySelector('[role=dialog][aria-label=Credits]:not([hidden])'),'In-game Credits panel');
    if (!panel.textContent.includes('Reuse and attribution')) throw Error('In-game Credits did not open');
    await click('Close credits'); await close();
    if (!doc.querySelector('.nq-graybox[data-room-id="spec001:R01"][data-rendered=true]')) throw Error('Closing Credits lost the guest room');
    checks.push({check:'Game menu Credits returned to the Arrival Lift'});
  }
  async function discover(){ await sequence('Look',...actorNames); }
  async function recruit(){
    for (const actor of actorNames) await sequence('Party','Invite '+actor,'Activate '+actor,'Close party');
  }
  async function floor(id,label,withParty){
    const stage=await wait(()=>doc.querySelector(`.nq-graybox[data-room-id="spec001:${id}"][data-rendered=true]`),id+' render');
    if(withParty) await wait(()=>stage.dataset.partyCast==='spec001:CH05 spec001:CH06',id+' two recruited companions');
    const before=stage.dataset.playerFoot;
    await sequence('Walk',label);
    await close();
    await wait(()=>stage.dataset.playerFoot && stage.dataset.playerFoot!==before,id+' floor movement');
    checks.push({check:'Visible floor move',room:id,before,after:stage.dataset.playerFoot,party:stage.dataset.partyCast??''});
  }
  async function revisit(){
    await walk(3);await walk(4);await floor('R04','Dry cavern ledge',true);
    await walk(3);await walk(2);
  }
  return {title,inGame,discover,recruit,floor,revisit};
}
