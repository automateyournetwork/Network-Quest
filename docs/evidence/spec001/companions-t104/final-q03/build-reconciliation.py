"""Build a reference ledger, never change T092 fixtures or convert TODOs into passes."""
from pathlib import Path
from hashlib import sha256
from collections import Counter
import json
BASE=Path('docs/evidence/spec001/companions-t104')
OUT=BASE/'final-q03'
old=json.loads((BASE/'oracle-mapping/mapping.json').read_text())
gaps={c['id']:c for c in json.loads((BASE/'gaps-58ce1a0/gap-case-index.json').read_text())['cases']}
current=BASE/'current-joined'
root156='docs/evidence/spec001/quality/Q03/root-checks/03-affected.txt'
rootBroad='docs/evidence/spec001/optional/MG03/root-checks/03-client.txt'
refs={}
def reference(key,path,anchor,execution,scope):
 p=Path(path);text=p.read_text();line=next(i+1 for i,s in enumerate(text.splitlines()) if anchor in s)
 refs[key]={'path':str(p),'line':line,'anchor':anchor,'sha256':sha256(p.read_bytes()).hexdigest(),'execution':execution,'scope':scope}
 return key
prepared='Actual production interfaces with explicitly prepared unrelated initial room/O01-O02/kit or party fixture context. No native route claim.'
for row in gaps.values():
 key='gap:'+row['id'];reference(key,row['source'],row['anchor'],root156,prepared+' Current156 normal-discovery execution includes this unchanged source.')
for label in ['START','PRACTICE','EXIT','RETRY','SKIP','FINISH','REPLAY','UNTIMED']:
 reference('MG-'+label,current/'minigame-exact.test.ts',{'FINISH':'FINISH and new-action','REPLAY':'FINISH and new-action'}.get(label,label+' '),root156,prepared+' O06/O08 prerequisites and revision8 observations are earned through actual operations. MG03 actually selects, predicts and measures. Controlled clock only in this suite.')
tech={
 'OPT-MG01-DECODE':'MG01 %s evaluates','OPT-MG01-WRONG-ORDER':'MG01 %s evaluates','OPT-MG01-ONE-SYMBOL':'MG01 %s evaluates',
 'OPT-SQ02-WRONG-DIAGNOSIS':'SQ02 wrong within-budget','OPT-SQ03-COMPARE':'SQ03 COMPARE exposes','OPT-SQ03-BOUNDARY':'SQ03 BOUNDARY completes','OPT-SQ03-STALE-PREDICTION':'SQ03 STALE uses','OPT-MG03-STALE-PREDICTION':'MG03 STALE uses','OPT-SQ04-NOTE-NOT-CLUE':'SQ04 NOTE-NOT-CLUE','OPT-SQ04-DUPLICATE-ROOM':'SQ04 DUPLICATE keeps','OPT-MG02-INCOMPATIBLE':'MG02 INCOMPATIBLE executes'}
for key,anchor in tech.items():reference(key,current/'technical-fields.test.ts',anchor,root156,prepared+' Direct actual predicate observations and actual controller outcomes are distinguished.')
for key,anchor in {'OPT-SQ01-DECODE':'SQ01 %s executes','OPT-SQ01-WRONG-ORDER':'SQ01 %s executes','OPT-SQ01-ONE-SYMBOL':'SQ01 %s executes','OPT-SQ02-DIAGNOSE':'SQ02 DIAGNOSE','OPT-SQ02-POWER-BOUNDARIES':'SQ02 POWER-BOUNDARIES'}.items():
 reference(key,OUT/'remaining-sq-fields.test.ts',anchor,str(OUT/'sq-fields-initial.txt'),prepared+' Separate five-case run on the exact final Q03 archive; not included in the303 total.')
mg=Path('docs/evidence/spec001/optional/MG03/promoted')
existing={
 'OPT-MG03-COMPARE':('runtime.test.ts','COMPARE/FINISH explicitly'),
 'OPT-MG03-BOUNDARY':('runtime.test.ts','BOUNDARY20 uses'),
 'OPT-MG03-LOCKED-BEFORE-OBJECTIVE':('runtime.test.ts','START/LOCKED enforces'),
 'OPT-MG02-BUDGETS':('mg02-regression.test.ts','actual production adapter preserves'),
 'OPT-MG02-LOCKED-BEFORE-OBJECTIVE':('mg02-regression.test.ts','OPT-MG02-START / LOCKED'),
 'OPT-MG01-NO-O10-SCORE':('mg01-regression.test.ts','OPT-MG01-SKIP / NO-O10-SCORE'),
 'OPT-MALFORMED-SYMBOLS':('mg01-regression.test.ts','malformed authored content precedes'),
 'OPT-EMPTY-ANSWER':('mg01-regression.test.ts','invalid answer %j')}
for key,(name,anchor) in existing.items():reference(key,mg/name,anchor,'docs/evidence/spec001/quality/Q03/root-checks/06-receipt-writer.txt' if name=='runtime.test.ts' else rootBroad,prepared+' Current canonical discovery imports this promoted regression. Broad report has one unrelated room-media timeout, separately rerun by root; this named suite passed.')
reference('SQ04-actual-combine','tests/ui/maintenance-record.test.ts','collects actual sources and awards',rootBroad,prepared+' Real ordinary source actions and controller receipt; no main progress.')
reference('SQ04-source-rooms','tests/state/maintenance-record.test.ts','executes OPT-SQ04-COMBINE',rootBroad,'Actual predicate source-room preservation; supplemental to loaded controller receipt, not native.')
reference('SQ04-epilogue','tests/ui/maintenance-epilogue.test.ts','projects history only with quest=',rootBroad,'Actual earned maintenance history with prepared ending presentation; final native E03 also earns SQ04 and reveals its handover.')
reference('SQ04-note-hypothesis','tests/ui/maintenance-record.test.ts','retains notes without treating',rootBroad,'Explicit prepared negative hypothesis/flag fixture. Source acquisition/controller rejection is real; not native. Supplements current actual personal-note assertion.')
reference('party-membership','docs/evidence/spec001/party/runtime-contract.ts','rejects duplicate and unrecruited',rootBroad,prepared+' Exact activeCH03 plus atomic rejected duplicate/unrecruited commands.')
reference('party-premature','docs/evidence/spec001/party/runtime-contract.ts','repeating recruitment evidence does not itself',rootBroad,prepared+' Nine actual premature progression commands leave entire game unchanged.')
reference('party-zero','docs/evidence/spec001/party/runtime-contract.ts','keeps zero active allies valid',rootBroad,prepared+' Empty party validity only. Whole-route completion remains T105.')
reference('native-all-seven',OUT/'all-seven.spec.ts','const lifecycle=async',str(OUT/'native-corrected.json'),'One cumulative native earned journey:56 lifecycle rows,28 unfinished exits,7 explicitly simulated document-visibility/logical3600s checks. Independent oracle starting states are covered by runtime suites; this journey is not their literal replay.')
reference('native-recovery',OUT/'all-seven.spec.ts',"const retried=await save('safe manual save",str(OUT/'native-corrected.json'),'Native Retry/E03/Restore with4quests,3minigames,EchoL1/EelL2; exact world rollback and exact saved snapshot resave. Existing local PHP identity alone is synthetic.')
reference('timing-contract','src/state/optional-activities.ts','readonly timingEnabled: false',str(OUT/'native-corrected.json'),'No implemented timed capability: literalfalse session contract; final loaded controls plus all7 controlled logical delay prove untimed behavior. No real-hour/performance claim.')
routes={'COMP-PARTY-ZERO','COMP-NO-RECRUITS-COPPER','COMP-NO-RECRUITS-FIBER','COMP-NO-RECRUITS-RADIO'}
rows=[]
for c in old['cases']:
 key=c['id'];proof=[];limits=[];adapt=[];status='mapped-executed-functional-evidence'
 if key in gaps:proof.append('gap:'+key)
 if key.startswith('OPT-MG') and key.split('-')[-1] in ['START','PRACTICE','EXIT','RETRY','SKIP','FINISH','REPLAY','UNTIMED']:proof.append('MG-'+key.split('-')[-1])
 if key in refs:proof.append(key)
 if key=='OPT-SQ04-COMBINE':proof += ['SQ04-actual-combine','SQ04-source-rooms','SQ04-epilogue']
 if key=='OPT-SQ04-NOTE-NOT-CLUE':proof.append('SQ04-note-hypothesis');limits.append('Personal note and missing-source/current route assertions are real interface operations; the supported-hypothesis/flag adversarial combination is a separately labeled prepared negative fixture, not a single native replay.')
 if key in ['COMP-PARTY-UNRECRUITED','COMP-PARTY-DUPLICATE']:proof.append('party-membership')
 if key=='COMP-PARTY-PREMATURE-PROGRESS':proof.append('party-premature')
 if key in routes:
  status='pending-T105-current-whole-route';limits.append('Current explicit empty recruits/active allies, required conventional tools, O11/O12 and unvisited-branch independence delegated to T105. Historical route references remain informative, not current closure.')
  if key=='COMP-PARTY-ZERO':proof.append('party-zero')
 if 'TIMING-GUARD' in key or 'TIMING-OPT-IN' in key:
  status='not-applicable-no-implemented-timed-mode';proof += ['timing-contract','native-all-seven'];limits.append('Conditional optional timed mode does not exist in final all7 source/control graph. SPEC.md137 permits but does not require it. This is N/A, never a passed timed challenge.')
 if key=='COMP-PARTY-INTERRUPT':
  status='partial-media-dependent-precommit-animation';adapt.append('Current synchronous commit/postcommit design: captured actual ability commands after navigation/Restore cannot mutate game or inventory. Literal precommit asynchronous animation cancellation remains deferred to T147/final media regression.')
 if key=='COMP-PARTY-REPLAY':adapt.append('Coordinator-approved generic rewardQuantity maps to the actual once-only ordinary objective identity0→1 after an ability measurement. Exact operation replay and new-ID same completion grant no further effect; inventory unchanged. Fresh legitimate measurements remain allowed.')
 if key.startswith('OPT-') and key.endswith('-RETRY'):adapt.append('Coordinator-approved assistance adaptation: method1 is present before a real wrong full answer; solution3 is honestly exposed by that answer. Entire pre-Retry [1,3] record array equals post-Retry, rather than deleting solution history to force literal[1]. Generic route-tool maps to the reusable real inspection kit quantity1.')
 if key=='OPT-SQ02-WRONG-DIAGNOSIS':adapt.append('Authored feedback conveys33W>30W,excess3W,and lamp-does-not-add-watts. It is a tested teaching-equivalent sentence, not literal equality with the original expected explanation string.')
 if key.startswith('COMP-') and key.endswith('-PROGRESS'):adapt.append('The original requiredExplanation is a teaching requirement: useful authored explanation predicates and actual meaningful progression are asserted; no literal prose equality or learning-outcome claim.')
 if key.startswith('OPT-') and key.split('-')[-1] in ['START','PRACTICE','EXIT','RETRY','SKIP','FINISH','REPLAY','UNTIMED']:proof.append('native-all-seven')
 if key.startswith('OPT-') and key.endswith('-UNTIMED'):limits.append('Runtime whole-state/no-scheduled-timer assertion plus final controlled browser logical3600s. All7 owned-tab probes remained visible, so document visibility properties/event are explicitly simulated and real renderer pause/resume verified. No actual background hour or foreground timing claim.')
 if not proof and key not in routes:raise AssertionError('Unmapped '+key)
 rows.append({**{k:c[k] for k in ['id','subject','kind','sourceCaseIds','oracleInputs','oracleExpected']},'status':status,'expectedFieldKeys':list(c['oracleExpected']),'currentEvidenceReferences':list(dict.fromkeys(proof)),'historicalEvidenceReferences':c['evidenceReferences'],'adaptations':adapt,'limits':limits,'todoDisposition':'Original T092 fixture execution flags and TODO test unchanged. Root reviews this explicit mapping; broad groups never rewrite expectations.'})
assert len(rows)==140 and len({r['id'] for r in rows})==140
result={'task':'T104','publishedProductionCommit':'55b9bfcd7ca1f0aef0b4add6f6d86790e34e7cad','meaning':'Exact original-case reference/status ledger, not140passed test assertions.129 rows have named functional evidence;6conditional rows N/A;4whole-route rows pendingT105;1literalprecommit-animation case partial. Source/predicate/prepared-state/native scopes remain distinct. Multiple assertions can substantiate one original case; one group can exercise several cases.','counts':dict(Counter(r['status'] for r in rows)),'originalInputHashes':{p:sha256(Path(p).read_bytes()).hexdigest() for p in ['tests/fixtures/companions.json','tests/fixtures/optional-activities.json','tests/content/companion-activity-oracles.test.ts']},'references':refs,'historicalReferences':old['references'],'cases':rows}
(OUT/'oracle-reconciliation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result['counts'],indent=2))
