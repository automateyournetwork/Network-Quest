// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Exercise all three media branches and reach R12 through a real permanent repair.
import { readFile } from 'node:fs/promises';
import { clickButton, closeFrame } from '../../tests/e2e/support/adventure-controls.ts';

export async function allRooms(page, observe) {
  const names = ["The Arrival Lift","The Titan's Workshop","The Copper Warrens","The Echo Cavern","The Photon Gardens",
    "The Prism Vault","The Skywell","The Storm Observatory","The Shell Market","The Clockworks","The Backhoe Rift","The Iron Threshold"];
  const click = async name => {
    if (['Repair plan','Validate repair','Diagnostics'].includes(name)) await closeFrame(page);
    await clickButton(page,name);
  };
  const room = async index => {
    const id='R'+String(index).padStart(2,'0');
    const content=JSON.parse(await readFile(new URL('../../content/spec001/rooms/'+id+'.json',import.meta.url),'utf8'));
    await observe(index,content.walkRegions[0].label);
  };
  const walk = async (index,label='Walk to '+names[index-1]) => { await click('Walk'); await click(label); await room(index); };
  const sequence = async (...labels) => { for(const label of labels) await click(label); };
  const measure = async complete => {
    await sequence('Diagnostics','Take measurement');
    const panel=page.getByRole('dialog',{name:'Diagnostics',exact:true});
    await panel.locator('ol[aria-label="Recorded measurements"] li').last().getByRole('button',{name:'Submit this reading'}).click();
    if ((await panel.textContent()).includes('Objective complete.')!==complete) throw Error('Objective completion disagrees');
    await click('Close diagnostics');
  };
  await room(1);
  await sequence('Look','Look at power indication','Look at link indication','Talk','Talk to Photon the Firefly','Skip dialogue','Use','Inspect physical path');
  await walk(2);
  await sequence('Talk','Talk to the Titan','Skip dialogue','Look','Identify known-good endpoints','Identify physical path under test','Notebook');
  await page.getByRole('textbox',{name:'Hypothesis',exact:true}).fill('Compare before and after intervention, then test endpoint service.');
  await sequence('Pin hypothesis','Close notebook','Continue as guest');
  await walk(3);
  await sequence('Use','Read and keep the supplied compatibility card','Read and keep the diagnosed-defect card; this is not a performed measurement');
  await measure(false); await sequence('Use','Fit the supplied replacement section: 85 m + 10 m'); await measure(true);
  await walk(4); await sequence('Use','Read and keep the before-record instructions; retain an actual measured open result','Read and keep the repeater role and limits','Conclude: a repeater needs the physical connection restored');
  await measure(true); await walk(3); await walk(2); await walk(5);
  await sequence('Use','Read and keep all five supplied compatibility checks','Select the supplied fully matching optic/fiber pair: all five fields match',
    'Inspect the original connection at the dock before any intervention','Have the dock fit the supplied compatible replacement to the inspected connection','Reinspect the replaced connection to confirm the diagnosed defect was removed');
  await measure(true); await walk(6); await sequence('Use','Read and keep the current compatibility and inspection reminder','Select passive path B: total loss 9 dB');
  await measure(true); await walk(5); await walk(2,'Walk to The Titan’s Workshop'); await walk(7);
  await sequence('Use','Keep the path survey in the notebook','Keep the endpoint settings card','Select the alternate surveyed path','Match both endpoint band, channel and PHY settings');
  await measure(true); await walk(8); await sequence('Use','Keep the survey and freshness instructions','Isolate the local emitter and return to surveyed conditions','Select fictional scenario channel B at both endpoints');
  await measure(true); await walk(7); await walk(2); await walk(9);
  await sequence('Use','Read and record all separate equipment checks','Select 100/full','Choose complete kit B: 12 W + 11 W + 7 W');
  await measure(true); await walk(2); await walk(10);
  await sequence('Use','Read and record the physical-role and upper-layer explanation','Use untimed step-by-step decoding',
    'Explain: sample physical signals representing bits; this does not discover addresses');
  for (const [position,pair] of ['00','10','11','01'].entries()) await sequence('Inspect sample position '+position,'Write '+pair+' for sample position '+position);
  await measure(true); await walk(11,'Walk toward The Backhoe Rift');
  await sequence('Repair plan','Copper replacement — 95 m','Permanent installation','Read and keep plan requirements','Review current plan');
  await page.getByRole('checkbox',{name:'I understand that execution changes the route and makes earlier readings stale'}).check();
  await sequence('Execute reviewed plan','Close repair controls');
  await click('Walk'); await click('Walk to the validation balcony');
  await sequence('Validate repair','Read classification criteria','Measure repaired link','Run endpoint test','Classify permanent restoration');
  const ending=page.getByRole('dialog',{name:'The Steady Light',exact:true});
  await ending.getByRole('button',{name:'Continue',exact:true}).click();
  await room(12);
}
