# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Construct an isolated, additive T093 proposal; never modifies active schema."""
import copy
import json
from pathlib import Path

here = Path(__file__).resolve().parent
original = json.loads((here/'content-schema-before-T093.json').read_text())
schema = copy.deepcopy(original)
defs = schema['$defs']
ref = lambda name: {'$ref':'#/$defs/'+name}
array = lambda name, minimum=0, maximum=32: {'type':'array','items':ref(name),'minItems':minimum,'maxItems':maximum,'uniqueItems':True}

defs['character']['properties']['dialogueIds']['minItems'] = 0
defs['character']['properties']['dialogueIds']['description'] = 'Only implemented character conversations. An empty list is honest for the player, non-speaking opponents or unimplemented conversations; do not borrow narrator action collections as dialogue.'
defs['ability']['properties']['conventionalEquivalentItemIds']['minItems'] = 0
defs['ability']['properties']['conventionalEquivalentActionIds'] = array('id',0,32)
defs['ability']['properties']['profileIds'] = array('profileId',1,7)
defs['ability']['allOf'] = [{'anyOf': [
 {'required':['conventionalEquivalentItemIds'],'properties':{'conventionalEquivalentItemIds':{'type':'array','minItems':1}}},
 {'required':['conventionalEquivalentActionIds'],'properties':{'conventionalEquivalentActionIds':{'type':'array','minItems':1}}},
]}]
defs['characterDemonstration'] = {'type':'object','additionalProperties':False,'properties':{
 'objectiveIds':array('objectiveId',1,12),'actionIds':array('id',1,32),'evidenceIds':array('factId',1,32),'ruleIds':array('ruleId',1,15),'profileIds':array('profileId',1,7),
 'evidencePolicy':{'const':'accepted-demonstration-is-learning-only'},'explanation':ref('text')},
 'required':['objectiveIds','actionIds','evidenceIds','ruleIds','profileIds','evidencePolicy','explanation'],
 'description':'An authored learning-review contract for T094. Conditions alone never prove a demonstration. A trusted actual canonical evaluation, accepted conclusion and appropriate readings must have been fresh and valid when demonstrated. Its historical receipt can support invitation/progression after movement, never current repair proof. objectiveIds names canonical provenance; a composite objective result need not carry each scoped ability ruleId. Fact membership or caller-supplied history is not a receipt. A distinct level-2 demonstration occurs after recruitment. actionIds names relevant alternatives/steps, not an unconditional all-actions sequence. Contrasts can explain a failed case without calling it a successful repair. Current ability application always performs fresh canonical physical checks.'}
defs['character']['properties']['recruitment']['properties']['roomIds'] = array('roomId',1,12)
defs['character']['properties']['recruitment']['properties']['demonstration'] = ref('characterDemonstration')
defs['character']['properties']['progression']['items']['properties']['demonstration'] = ref('characterDemonstration')
compendium = defs['character']['properties']['compendium']['properties']
compendium['portraitAssetId'] = ref('id')
compendium['portraitText'] = ref('text')
compendium['discovery'] = {'type':'object','additionalProperties':False,'properties':{'roomIds':array('roomId',1,12),'explanation':ref('text')},'required':['roomIds','explanation']}
compendium['recruitmentSummary'] = ref('text')
compendium['progressionSummary'] = ref('text')
compendium['contextSources'] = {'type':'array','minItems':0,'maxItems':8,'uniqueItems':True,'items':{'type':'object','additionalProperties':False,'properties':{
 'title':ref('text'),'url':{'type':'string','format':'uri','pattern':'^https://','maxLength':2048},'section':ref('text'),'supportedClaim':ref('text'),
 'limitations':array('text',1,8),'retrievedDate':{'type':'string','format':'date'},'scope':{'const':'descriptive-only-not-scored'}},
 'required':['title','url','section','supportedClaim','limitations','retrievedDate','scope']},
 'description':'Primary references for non-scored character/exhibit context only. These cannot be selected by ruleIds/sourceId or introduce new thresholds/profile behavior; the reviewed sources.json remains authoritative for scored rules.'}

# Store a reviewable JSON Patch restricted to definitions actually changed.
patch=[]
for key,value in defs.items():
 if key not in original['$defs']: patch.append({'op':'add','path':'/$defs/'+key,'value':value})
 elif value != original['$defs'][key]: patch.append({'op':'replace','path':'/$defs/'+key,'value':value})
(here/'schema-proposal.patch.json').write_text(json.dumps(patch,ensure_ascii=False,indent=2)+'\n')
(here/'content-schema-T093.json.draft').write_text(json.dumps(schema,ensure_ascii=False,indent=2)+'\n')
print('Isolated proposal modifies only $defs/ability, $defs/character and adds $defs/characterDemonstration.')
