# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Read-only reconciliation of immutable T092 cases. This does not execute the app.

The output is an inspection ledger, never a substitute for actual assertions or
a fixture-driven expected-return implementation. No original TODO is removed.
"""
from pathlib import Path
import collections
import hashlib
import json

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent

def read(path):
    return (ROOT / path).read_text()

def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()

def json_file(path):
    return json.loads(read(path))

companions = json_file('tests/fixtures/companions.json')
optional = json_file('tests/fixtures/optional-activities.json')
references = {}

def ref(key, path, anchor, evidence, scope):
    lines = read(path).splitlines()
    hits = [n + 1 for n, line in enumerate(lines) if anchor in line]
    assert hits, (key, path, anchor)
    references[key] = dict(path=path, sha256=sha(path), line=hits[0], anchor=anchor,
                           executionEvidence=evidence, scope=scope)
    return key

party_log = 'docs/evidence/spec001/party/focused-release.txt'
party_source = 'docs/evidence/spec001/party/runtime-contract.ts'
party_scope = 'T094 real controller/reducer adapter, prepared unrelated prerequisites/tools; canonical entry tests/state/party.test.ts invokes this contract. Historical execution, not a new run.'
for suffix, anchor in {
    'encounter': 'encounter alone awards neither recruitment',
    'invite': 'valid demonstrated invitation is singular',
    'premature': 'repeating recruitment evidence does not itself',
    'progress': 'explicit post-recruit demonstration unlocks',
    'capacity': 'keeps zero active allies valid',
    'membership': 'rejects duplicate and unrecruited',
    'swap': 'swaps freely in preparation',
    'unsafe': 'rejects swaps during %s',
    'restore': 'invalidates a captured party control after Restore',
}.items():
    ref('party-' + suffix, party_source, anchor, party_log, party_scope)
ref('party-parity', 'tests/state/party-abilities.test.ts', 'both earned abilities and every authored action match conventional reduction', party_log,
    'Actual reducer parity for all authored ability actions. Both branches use the SAME recruited/active game. Not the original three-vector/unrecruited-tool matrix.')
ref('party-evidence', 'tests/state/party-evidence.test.ts', 'refuses $name', party_log,
    'Real demonstrations followed by explicitly corrupted historical records; six provenance negatives per ally. Not native play.')
ref('compendium-fields', 'tests/ui/compendium.test.ts', 'renders the exact discovered identity', 'docs/evidence/spec001/compendium/join-focused-final.txt',
    'Prepared Photon discovery projection; field/source assertions. All characters have native discovery/field coverage below.')
ref('objective-content-error', 'tests/state/objectives.test.ts', 'rejects %s nested %s.%s overrides', 'docs/evidence/spec001/party/root-checks/client.txt',
    'Objective evaluator with explicitly malformed scenario inputs. Does not exercise the original ally/tool pair or exact Echo topology.')
native_comp = 'docs/evidence/spec001/companions-t104/native-complete.spec.ts.txt'
comp_report = 'docs/evidence/spec001/companions-t104/native-complete.json'
for suffix, anchor in {'discovery': 'actual actor discovery and scoped entries', 'progress': 'distinct post-recruit lesson earns level 2',
                       'parity': 'ability equals conventional physical reading', 'stale': 'Stale reading', 'route': 'actual conventional copper repair'}.items():
    ref('native-companion-' + suffix, native_comp, anchor, comp_report,
        'Earned native guest journey at 9a93bf7. Exact sealed harness, 53 grouped checks; not independent original-case sessions and not final joined release.')
native_optional = 'docs/evidence/spec001/companions-t104/optional-979c492/executed.spec.ts.txt'
optional_report = 'docs/evidence/spec001/companions-t104/optional-979c492/native-initial.json'
for subject in ['SQ01', 'SQ02', 'SQ03']:
    ref('native-' + subject, native_optional, f"row('{subject}','", optional_report,
        'Earned native journey at 979c492 with synthetic local identity for one-slot HTTP save. Eight operational groups are not eight exact original cases; later quests have prior optional progress and allies.')
ref('native-recovery', native_optional, 'encounter-failure-Retry', optional_report,
    'Three earned quests, two earned allies, actual Retry/E03/Restore; whole-world rollback and whole-snapshot resave assertions. No provider login.')
ref('copper-route', 'tests/e2e/first-repair-route.spec.ts', 'T078 ${variant.name}', 'docs/evidence/spec001/epilogues/application-green.json',
    'Historical actual copper routes through R12. No explicit saved recruits=[] assertion in this harness; no current joined rerun claimed.')
ref('other-routes', 'tests/e2e/independent-repair-routes.spec.ts', 'snapshot.world.recruits', 'docs/evidence/spec001/epilogues/application-green.json',
    'Historical actual fiber/radio routes assert empty recruits/quests and no copper-room visits in the saved state. Required tools and O11/O12 earned natively.')

sq01 = 'docs/evidence/spec001/optional/SQ01/joined/lifecycle.test.ts'
sq01_log = 'docs/evidence/spec001/optional/SQ01/joined/05-final-integrated.log'
for suffix in ['START', 'PRACTICE', 'FINISH', 'RETRY', 'EXIT', 'SKIP', 'REPLAY', 'UNTIMED']:
    ref('SQ01-' + suffix, sq01, 'OPT-SQ01-' + suffix, sq01_log,
        'Real loaded controller/bus/reducer/CAS; independently prepared room/tool/O01-O02 state. RETRY uses prepared current measurement; UNTImED uses a fake clock only.')
ref('SQ01-vectors', sq01, 'agrees in actual evaluator result', sq01_log, 'Exact T12/C-SYMBOL-WRONG/B-SYMBOL evaluator and actual controller assertions.')
sq02 = 'docs/evidence/spec001/optional/SQ02/joined/runtime.test.ts'
sq02_log = 'docs/evidence/spec001/optional/SQ02/joined/03-final-runtime.log'
for suffix, anchor in {'vectors': 'preserves physical incorrect/learner correct', 'flow': 'handles blank, wrong, practice',
                       'replay': 'rejects failed answer CAS atomically', 'retry': 'retries with fresh attempt/revision'}.items():
    ref('SQ02-' + suffix, sq02, anchor, sq02_log, 'Actual loaded power adapter/controller/CAS; prepared R09 guest with O01/O02 and inspection kit. No browser in this suite.')
sq03 = 'tests/ui/radio-diary.test.ts'
sq03_log = 'docs/evidence/spec001/optional/SQ03/join/14-final-focused.log'
for suffix, anchor in {'start-practice': 'opens without a radio completion', 'compare': 'correctly diagnoses the actual25',
                       'boundary': 'accepts actual20', 'stale': 'executes the frozen stale-prediction',
                       'retry': 'stales retained real readings on Retry'}.items():
    ref('SQ03-' + suffix, sq03, anchor, sq03_log,
        'Actual loaded diary controller and real radio controls/measurements; prepared unrelated progress, not native navigation.')
ref('SQ03-vector-details', 'docs/evidence/spec001/optional/SQ03/authoring.test.ts', 'executes the frozen25',
    'docs/evidence/spec001/optional/SQ03/01-authoring-tests.log',
    'Historical candidate adapter using actual radio evaluator/reducer measurements, before loaded join. Supplements but does not replace current loaded assertions.')
sq04 = 'tests/state/maintenance-lifecycle.test.ts'
sq04_log = 'docs/evidence/spec001/optional/SQ04/joined/20-focused-final.log'
for suffix in ['START', 'PRACTICE', 'FINISH', 'RETRY', 'EXIT', 'SKIP', 'REPLAY', 'UNTIMED']:
    # The parameterized suite dispatches by exact original ID.
    ref('SQ04-' + suffix, sq04, "c.id === 'OPT-SQ04-" + suffix + "'", sq04_log,
        'Real loaded operations on prepared room/kit/O02 state. Output-object equality is not proof of unasserted phase/input details; see each case gap.')
for suffix, anchor in {'COMBINE': 'executes OPT-SQ04-COMBINE', 'NOTE-NOT-CLUE': 'executes OPT-SQ04-NOTE-NOT-CLUE',
                       'DUPLICATE-ROOM': 'executes OPT-SQ04-DUPLICATE-ROOM'}.items():
    ref('SQ04-' + suffix, 'tests/state/maintenance-record.test.ts', anchor, sq04_log,
        'Real immutable-input predicate; source acquisition/current loaded controller assertions are separate.')
ref('SQ04-real-clues', 'tests/ui/maintenance-record.test.ts', 'collects actual sources and awards', sq04_log,
    'Real ordinary source actions on prepared rooms followed by loaded optional completion; not native full navigation.')
ref('SQ04-note-controller', 'tests/ui/maintenance-record.test.ts', 'retains notes without treating a missing inspection', sq04_log,
    'Actual source acquisition/controller rejection; supplied hypothesis/flag are clearly negative fixtures.')
ref('SQ04-epilogue', 'tests/ui/maintenance-epilogue.test.ts', 'projects history only with quest=',
    'docs/evidence/spec001/optional/SQ04/joined/26-epilogue-affected.log',
    'Actual earned history plus prepared ending outcomes tests presentation only, not native classification.')
mg01 = 'docs/evidence/spec001/optional/MG01/joined/runtime.test.ts'
mg01_log = 'docs/evidence/spec001/optional/MG01/joined/verification.json'
for suffix in ['START', 'PRACTICE', 'FINISH', 'RETRY', 'EXIT', 'SKIP', 'REPLAY', 'UNTIMED']:
    ref('MG01-' + suffix, mg01, 'OPT-MG01-' + suffix, mg01_log,
        'Reviewed isolated real implementation at 9a93bf7 archive; source promotion/current regression pending at this inspection. Logical clock only for UNTImED.')
for suffix, anchor in {'wrong': 'wrong order shows honest', 'empty': 'invalid answer %j', 'malformed': 'malformed authored content precedes'}.items():
    ref('MG01-' + suffix, mg01, anchor, mg01_log,
        'Reviewed isolated actual controller/evaluator negative case. Not yet accepted current application in this ledger.')

rows = []
def row(case, refs, observed, gaps, assessment='partial'):
    rows.append(dict(id=case['id'], subject=case['subject'], kind=case['kind'], sourceCaseIds=case['sourceCaseIds'],
                     oracleExpected=case['expected'], oracleInputs=case['inputs'], evidenceReferences=refs,
                     observedCoverage=observed, pendingExactProof=gaps, assessment=assessment,
                     finalCurrentRecheckRequired=True, todoDisposition='preserve-original-todo-pending-reviewed-closure'))

for c in companions['cases']:
    id = c['id']
    if id.startswith('COMP-CH'):
        character, stage = id.split('-')[1:]
        if stage == 'DISCOVERY':
            row(c, ['party-encounter', 'compendium-fields', 'native-companion-discovery'],
                'All nine real encounters reject invitation before demonstration; all 25 native discovered entries expose authored role/limits/sources/realm. Photon projection explicitly asserts discovered/not recruited.',
                ['Native route discovers some characters after their prerequisite objective, so the before-demonstration compendium/no-recruit state is split across runtime/native evidence. Add exact per-character combined assertion.'])
        elif stage == 'RECRUIT':
            row(c, ['party-invite', 'native-companion-progress'],
                'Independent real demonstrations/invitations yield level 1 and no active ally. Repeated invite leaves the whole game equal; native journey invites all nine explicitly.',
                ['Add an exact single-member recruitedIds/recruitCount assertion at original-case checkpoint; existing contract inspects the row and whole-game repeat equality.'])
        elif stage == 'PROGRESS':
            row(c, ['party-progress', 'party-parity', 'party-evidence', 'native-companion-progress'],
                'Distinct canonical post-recruit lessons earn cumulative level 2 once. Both earned ability operations use conventional reductions; native lessons display their explanations.',
                ['Map each original semantic requiredExplanation to its authored advanced ability and concrete useful inspection/explanation assertion; exact physical three-vector equivalence remains separate.'])
        else:
            row(c, ['party-parity', 'native-companion-parity'],
                'Every authored action has actual reducer parity on the same recruited state; native checks compare nonempty physical observations for representative level-1/2 operations.',
                ['Run every original correct/incorrect/boundary vector from scenarioVectorGroup with two separately prepared states at the same scenario/revision: ally recruited+active versus conventional recruits=[] and active=[].',
                 'Assert independent expected physical values/status, nonempty observations, accepted physical effects and objective eligibility after actual required interventions. Do not equate absent observations or infer the whole route.'])
        continue
    table = {
        'ZERO': (['party-capacity','copper-route'], 'Empty active list accepted; historical copper route earns R12 through ordinary tools.', ['Add explicit empty recruited/active/optional state assertions at the no-recruit copper completion checkpoint.']),
        'TWO': (['party-capacity','party-swap'], 'Exact requested pair CH03/CH04 is handled and used as the pre-third-attempt state.', ['Assert the original active output pair directly at the TWO checkpoint, independently of later swap rejection.']),
        'THREE': (['party-capacity'], 'Requested CH03/CH04/CH19 is rejected with whole state unchanged after accepted pair.', ['Add the explicit expected preexisting pair assertion for the original case.']),
        'UNRECRUITED': (['party-membership'], 'With CH03 active, CH03/CH19 is rejected and whole state stays equal.', [],),
        'DUPLICATE': (['party-membership'], 'With CH03 active, CH03/CH03 is rejected and whole state stays equal, preventing a doubled active ability.', [],),
        'FREE-SWAP': (['party-swap'], 'Exact CH03/CH04 to CH04/CH19 transition preserves inventory, increments revision once, stales nonempty measurements and causes no save.', ['Assert the original route-tool quantity 1 explicitly instead of relying only on pre/post inventory equality.']),
        'MISSING-ALLY': (['other-routes','copper-route'], 'Historical ordinary-tool routes reach preparation and final service without a companion interaction.', ['Execute original desired-CH19/unrecruited precommit case, assert return-to-preparation availability and actual ordinary operation accepted in that same prepared case.']),
        'PREMATURE-PROGRESS': (['party-premature'], 'All nine reject premature unlock and preserve whole game before and after beginning unfulfilled practice.', []),
        'UNSAFE-SWAP': (['party-unsafe'], 'Active-encounter/terminal/shutdown/pending-effect states reject a swap with whole state unchanged.', ['Use original active CH03/CH04 and request CH04/CH19; current test uses CH03 to CH04. Assert explanatory return-to-preparation text.']),
        'STALE': (['party-swap','native-companion-stale'], 'Actual swap stales nonempty measurements; native Diagnostics retains stale reading with submission disabled.', ['Execute exact old measurement revision 8/current 9/same-attempt ally case and assert objective count unchanged, not only disabled UI.']),
        'REPLAY': (['party-invite','party-progress','party-parity'], 'Invite/progression rewards are deduplicated; parity tests drive real actions.', ['Actual ability action exact-ID replay and new-ID same-completion replay must count accepted effects, reward quantity and objective awards. Invite/progress replay is not this case.']),
        'INTERRUPT': (['party-restore'], 'Captured party control is rejected after actual snapshot restore with whole state unchanged.', ['Exercise an ability capture/effect pending before leave/Restore, then late completion; prove zero new progress/consumption. No actual asynchronous ally animation has been demonstrated.']),
        'CONTENT-ERROR': (['objective-content-error'], 'Malformed objective profiles fail content validation with no accepted effects.', ['Execute unknown-profile error through ally and ordinary operation entry points; assert no attempt penalty/progress.']),
        'ECHO-UNREVIEWED-TOPOLOGY': (['objective-content-error'], 'Unreviewed topology is rejected at objective boundary.', ['Execute exact two-segments-with-regenerator/missing reviewed limits through Echo entry point; verify content-error and no penalty/progress.']),
    }
    if id.startswith('COMP-NO-RECRUITS-'):
        route = id.rsplit('-',1)[1]
        row(c, ['copper-route' if route=='COPPER' else 'other-routes'],
            'Historical actual independent '+route.lower()+' route obtains ordinary tools and earns O11/O12 without another route prerequisite.',
            ['Current joined route recheck and explicit empty active/optional rewards assertions remain; copper also needs saved empty-recruits assertion. T105 owns separate 52-route reconciliation.'], 'mapped-historical-native')
    else:
        refs, observed, gaps = table[id.removeprefix('COMP-PARTY-')]
        row(c, refs, observed, gaps, 'mapped-runtime' if not gaps else 'partial')

common_time_gap = 'Use actual timer/visibility consumers with an explicitly controlled 3600-second clock plus visibility/background harness; assert no time grading/termination and retained progress before successful completion. No real-hour wait or wall-clock/performance claim is required.'
for c in optional['cases']:
    id, subject = c['id'], c['subject'].split(':')[-1]
    stage = id.removeprefix('OPT-'+subject+'-')
    if c['kind']=='lifecycle':
        if subject in ['MG02','MG03']:
            row(c, [], 'Original independent expectations identified; no actual joined variant inspected in this audit.', ['Await actual joined '+subject+'; execute exact lifecycle inputs/expected outputs through real controls, independently of other optional completions.'], 'awaiting-joined-variant')
            continue
        refs = [subject+'-'+stage] if subject in ['SQ01','SQ04','MG01'] else ([{'START':'SQ02-flow','PRACTICE':'SQ02-flow','FINISH':'SQ02-flow','RETRY':'SQ02-retry','EXIT':'SQ02-flow','SKIP':'SQ02-flow','REPLAY':'SQ02-replay','UNTIMED':'SQ02-flow'}[stage]] if subject=='SQ02' else [{'START':'SQ03-start-practice','PRACTICE':'SQ03-start-practice','FINISH':'SQ03-compare','RETRY':'SQ03-retry','EXIT':'SQ03-start-practice','SKIP':'SQ03-start-practice','REPLAY':'SQ03-retry','UNTIMED':'SQ03-start-practice'}[stage]])
        if subject in ['SQ01','SQ02','SQ03']: refs += ['native-'+subject]
        observed = {
            'START':'Actual entry/instructions and no immediate completion; SQ01/MG01/SQ04 dedicated runtime start checks, SQ02/SQ03 captured/native opening.',
            'PRACTICE':'Actual practice/explanation and recorded worked assistance in independent runtime; native display and no completion for available SQ01–03.',
            'FINISH':'Actual full answer creates its own once-only receipt/fact without a required objective; planned image/depth/decoration fallback is not completed media.',
            'RETRY':'Actual Retry creates a fresh attempt/revision, preserves learning and preparation; native SQ01–03 use actual prior wrong answers and measurements.',
            'EXIT':'Actual shared exit returns to exploration without a new save; native instruction/precompletion and successful feedback exits are observed for SQ01–03.',
            'SKIP':'Native SQ01–03 complete the relevant main objective before optional completion; independent module tests provide prerequisite-free prepared starting states.',
            'REPLAY':'Actual repeated completion keeps one receipt/fact, including new actions and sessions in dedicated SQ01/SQ02/MG01 suites.',
            'UNTIMED':'No enabled timer in observed activity. SQ01 advances fake clock 3600 s; SQ04/MG01 advance fake clock 86400 s and finish. No visibility event in those suites.'
        }[stage]
        gaps = []
        if stage=='START' and subject in ['SQ02','SQ03']:
            gaps += ['Assert all five original start outputs together in the independent no-recruits/no-other-optional prepared case.']
        if stage=='PRACTICE':
            gaps += ['Assert original retry/exit/timing/assistance/unassisted conditions together after the actual worked example; native labels alone do not prove persisted assistance.']
        if stage=='FINISH' and subject in ['SQ01','SQ02','SQ03']:
            gaps += ['Reward receipt/unlock is covered; media-dependent finished reward remains pending. Exact independent main-objective delta and safe-exit assertions must be reconciled with each original input.']
        if stage=='RETRY':
            gaps += ['Reproduce original independent wrong-answer + retained clue/note + method-hint history [1] + actual prior physical change/current measurement at revision 8; assert all retained/stale/no-save/no-unearned-benefit outputs. Wrong-answer solution exposure may legitimately append level 3 and needs explicit oracle interpretation, never hidden normalization.']
            if subject=='SQ04': gaps += ['Existing lifecycle RETRY never submits the required prior wrong answer; whole expected-object equality does not establish that missing input.']
            if subject=='SQ02': gaps += ['Existing dedicated runtime retry is after correct completion and has no measurement; native wrong/retry is a separate cumulative journey.']
        if stage=='EXIT':
            if subject=='SQ01': observed += ' Dedicated runtime suite asserts each actual phase before exiting, including wrong feedback.'
            else: gaps += ['Assert actual reached phase before each unfinished instructions/practice/solving/feedback exit, origin/safe position, main progress, inventory, route reachability, no benefit/save. SQ04 currently loops labels without asserting actual phase.']
        if stage=='SKIP': gaps += ['Original activityStarted=false differs from cumulative native start/exit/then-main flow; independently assert no session/completion, retained inventory/progress and actual required-route reachability.']
        if stage=='REPLAY' and subject in ['SQ02','SQ03','SQ04','MG01']:
            gaps += ['Assert explanation replay available and zero required-objective delta with the new-action original replay, not only receipt length.']
        if stage=='UNTIMED': gaps += [common_time_gap]
        if subject=='MG01': gaps += ['Isolated reviewed source only; current SQ03/SQ04-aware promotion and later all-seven regression still required.']
        row(c, refs, observed, gaps, 'mapped-runtime' if not gaps else 'partial')
        continue
    if '-TIMING-' in id:
        row(c, ['MG01-UNTIMED'] if subject=='MG01' else [],
            'Case explicitly applies only if an authored timed capability exists. Omission is valid; do not manufacture a timer for coverage.',
            ['After final joins inspect loaded authored capability, actual controls and closed input boundary. If no mode exists, root may record reviewed conditional-not-applicable; otherwise execute the original opt-in/guard flow.'], 'conditional-review-pending')
    elif subject in ['MG02','MG03']:
        row(c, [], 'Original physical vectors/prerequisite case retained verbatim; no joined variant evidence credited here.',
            ['Await actual joined '+subject+' and map exact correct/incorrect/boundary/locked/stale behavior. Prepared authoring or another activity is not this runtime.'], 'awaiting-joined-variant')
    elif subject=='SQ01':
        row(c, ['SQ01-vectors','native-SQ01'], 'Exact original toy inputs/results are evaluated and submitted through real controller; full delivery versus one-symbol practice is distinguished.',
            ['Reconcile main-objective delta and retry controls at each exact vector checkpoint in final current suite; no fixture-only equality.'])
    elif subject=='SQ02':
        refs = ['SQ02-vectors','native-SQ02'] if stage!='WRONG-DIAGNOSIS' else ['SQ02-flow','native-SQ02']
        row(c, refs, 'Real 33 W/3 W overage diagnosis, 23 W/7 W and inclusive 30 W/0 W cases, or wrong diagnosis use actual physical adapter and controller. A correct learner explanation does not repair the failed plan.',
            ['Preserve exact independent expected readings/status and explicit no-data-link proof; wrong original link-lamp claim has structured equivalent input, so document this adaptation and assert retry/explanation.'])
    elif subject=='SQ03':
        key = {'COMPARE':'compare','BOUNDARY':'boundary','STALE-PREDICTION':'stale'}[stage]
        row(c, ['SQ03-'+key,'SQ03-vector-details','native-SQ03'],
            'Actual source-bound earlier/current radio measurements and controller comparisons; 25→13 and inclusive 20 dB; actual mitigation without remeasurement cannot unlock delivery.',
            ['Assert each original display/retry/current-use output together on the loaded joined adapter. Numeric revision labels are ordinal provenance placeholders, not permission to inject a correct measurement.'])
    elif subject=='SQ04':
        refs = ['SQ04-'+stage, 'SQ04-real-clues']
        if stage=='COMBINE': refs += ['SQ04-epilogue']
        if stage=='NOTE-NOT-CLUE': refs += ['SQ04-note-controller']
        row(c, refs, 'Exact immutable predicate cases plus actual source acquisition/controller membership. Prepared epilogue verifies quest+fact personalization only for the correct earned combination.',
            ['Final native all-seven run must earn R03/R05/R09 clues; NOTE-NOT-CLUE still needs explicit retry and main-route reachability in the same negative case. DUPLICATE-ROOM predicate result is not a normal UI accepting malformed duplicate selections.'])
    else:
        refs = ['MG01-START','MG01-FINISH']
        if stage=='ONE-SYMBOL': refs = ['MG01-PRACTICE']
        elif stage=='WRONG-ORDER': refs = ['MG01-wrong']
        elif stage=='NO-O10-SCORE': refs = ['MG01-SKIP']
        elif id=='OPT-MALFORMED-SYMBOLS': refs = ['MG01-malformed']
        elif id=='OPT-EMPTY-ANSWER': refs = ['MG01-empty']
        row(c, refs, 'Reviewed isolated actual MG01 handler evidence exists for decode/practice/wrong/no-score/content-fault/invalid-answer behavior; current join is pending.',
            ['Reconcile exact original evaluator trace/output keys after current promotion. Empty-answer case uses null, while the cited controller test uses invalid strings; add actual null-input coverage.'] if id=='OPT-EMPTY-ANSWER' else
            ['Reconcile exact original inputs and expected trace/penalty/controls on current joined MG01; no credit from SQ01 alone.'])

assert len(rows)==140 and len({r['id'] for r in rows})==140
assert {r['id'] for r in rows}=={c['id'] for c in companions['cases']+optional['cases']}
assert all(ref_id in references for r in rows for ref_id in r['evidenceReferences'])
oracle_paths = ['tests/fixtures/companions.json','tests/fixtures/optional-activities.json','tests/content/companion-activity-oracles.test.ts','tests/fixtures/physical-cases.json','tests/fixtures/repair-routes.json','content/spec001/sources.json']
data = dict(task='T104', stage='original-case-inspection-before-gap-execution', date='2026-11-27',
            status='inspection-only-not-runtime-acceptance', originalCases=140, companionCases=53, optionalCases=87,
            sourceHashMeaning='Hashes identify source inspected by this ledger; historical execution receipts retain their own source versions. No source hash here is a claim that a test was rerun.',
            originalInputs={p:sha(p) for p in oracle_paths},
            parentInstruction='Controlled logical clock/visibility is permitted for long background checks; report simulation honestly, with no wall-clock/performance claim.',
            todoEdits=0, counts=dict(collections.Counter(r['assessment'] for r in rows)), references=references, cases=rows)
(OUT/'mapping.json').write_text(json.dumps(data, indent=2, ensure_ascii=False)+'\n')
print(json.dumps({'cases':len(rows),'references':len(references),'counts':data['counts'],'originalTodoEdits':0}))
