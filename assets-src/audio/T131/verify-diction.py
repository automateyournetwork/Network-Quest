# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Check printed dialogue, cast and technical phonemes against the actual generation receipts."""
import hashlib
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
AUDITIONS = OUT.parent / 'auditions'
# Each pair is a literal piece of the frozen line and its expected Kokoro English phone sequence.
TARGETS = {
    '041': [('supplied profile', 'səplˈId pɹˈOfˌIl'), ('compatibility test', 'kəmpˌæTəbˈɪləTi tˈɛst')],
    '042': [('light propagation', 'lˈIt pɹˌɑpəɡˈAʃən'), ('independent payload channels', 'ˌɪndəpˈɛndənt pˈAlˌOd ʧˈænᵊlz')],
    '043': [('electrical power', 'əlˈɛktɹəkᵊl pˈWəɹ'), ('fiber', 'fˈIbəɹ')],
    '044': [('inspect and measure again', 'ɪnspˈɛkt ænd mˈɛʒəɹ əɡˈɛn')],
    '045': [('known pattern', 'nˈOn pˈæTəɹn'), ('arrived', 'əɹˈIvd'), ('sent', 'sˈɛnt')],
    '046': [('fresh check', 'fɹˈɛʃ ʧˈɛk'), ('a record', 'ɐ ɹˈɛkəɹd')],
    '047': [('Borrowed dawn', 'bˈɑɹOd dˈɔn'), ('temporary part', 'tˈɛmpəɹˌɛɹi pˈɑɹt')],
    '048': [('unresolved', 'ˌʌnɹəzˈɑlvd'), ('safe place', 'sˈAf plˈAs')],
    '049': [('specifications', 'spˌɛsəfəkˈAʃənz'), ('polish', 'pˈɑlɪʃ')],
    '050': [('physical profile', 'fˈɪzəkᵊl pɹˈOfˌIl'), ('medium', 'mˈidiəm'), ('required wavelength','ɹəkwˈIəɹd wˈAvlˌɛŋθ')],
    '051': [('S F P', 'ˈɛs ˈɛf pˈi'), ('form factor', 'fˈɔɹm fˈæktəɹ')],
    '052': [('Chimera', 'kImˈɪɹə'), ('lanes and breakout support', 'lˈAnz ænd bɹˈAkˌWt səpˈɔɹt')],
    '053': [('delivered power', 'dəlˈɪvəɹd pˈWəɹ'), ('source power', 'sˈɔɹs pˈWəɹ'), ('endpoints', 'ˈɛndpYnts')],
    '054': [('Twelve, eleven and ten watts', 'twˈɛlv, əlˈɛvᵊn ænd tˈɛn wˈɑts'), ('total thirty-three', 'tˈOTᵊl θˈɜɹTiθɹˌi'), ('thirty-watt budget', 'θˈɜɹTiwˌɑt bˈʌʤət'), ('three watts short', 'θɹˈi wˈɑts ʃˈɔɹt')],
    '055': [('Communicating', 'kəmjˈunᵻkˌATɪŋ'), ('not yet established', 'nˌɑt jˈɛt əstˈæblɪʃt')],
    '056': [('optical budget', 'ˈɑptəkᵊl bˈʌʤət'), ('incompatible optic and fiber pair', 'ˌɪnkəmpˈæTəbᵊl ˈɑptɪk ænd fˈIbəɹ pˈɛɹ')],
    '057': [('D B M is a power level', 'dˈi bˈi ˈɛm ɪz ɐ pˈWəɹ lˈɛvᵊl'), ('D B expresses', 'dˈi bˈi ɪkspɹˈɛsᵻz'), ('difference or ratio', 'dˈɪfəɹəns ɔɹ ɹˈAʃiO')],
    '058': [('sensitivity','sˌɛnsətˈɪvəTi'), ('reserve margin','ɹəzˈɜɹv mˈɑɹʤən'), ('exceed','ɪksˈid'), ('maximum receive level','mˈæksəməm ɹəsˈiv lˈɛvᵊl')],
    '059': [('compatible parts', 'kəmpˈæTəbᵊl pˈɑɹts'), ('chosen route', 'ʧˈOzᵊn ɹˈut')],
    '060': [('ledger', 'lˈɛʤəɹ'), ('adding watts', 'ˈædɪŋ wˈɑts')]
}


def read(path):
    return json.loads(path.read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    rows = read(OUT.parent / 'production-plan.json')['voices'][40:60]
    old = {r['canonical']['assetId']: r for r in read(AUDITIONS / 'provenance/voice-run.json')['records']}
    cast = {r['canonical']['speakerId']: (r['voice'], r['voiceSha256']) for r in old.values()}
    results = []
    for row in rows:
        aid = row['assetId']
        number = aid[-3:]
        historic = old.get(aid)
        if historic:
            path = AUDITIONS / 'metadata-followup/voices' / (historic['slug'] + '.json')
        else:
            path = OUT / 'records' / ('voice-' + number + '-generation.json')
        record = read(path)
        assert aid == record['assetId'] and row['lineId'] == row['captionId'] == record['lineId']
        assert row['speakerId'] == record['speakerId']
        assert (record['voiceId'], record['voiceSha256']) == cast[row['speakerId']]
        assert row['text'] == record['text'] == (ROOT / record['scriptPath']).read_text()
        assert sha(ROOT / record['scriptPath']) == row['textSha256'] == record['scriptSha256']
        assert sha(ROOT / record['rawPath']) == record['rawSha256']
        phonemes = ' '.join(record['phonemes'])
        landmarks = []
        for text, expected in TARGETS[number]:
            assert text in row['text'] and expected in phonemes, (number,text,expected)
            landmarks.append({'text': text,'phonemes': expected})
        results.append({'assetId': aid,'captionId': row['captionId'],'roomId': row['roomId'],
            'speakerId': row['speakerId'],'voiceId': record['voiceId'],'category': row['category'],
            'technicalIntent': row['learningIntent'],'textSha256': row['textSha256'],
            'generationRecord': {'path': str(path.relative_to(ROOT)),'sha256': sha(path)},
            'historical': bool(historic),'speed': record['speed'],'landmarks': landmarks,
            'wordsPerMinute': round(historic['approxWordsPerMinute'] if historic else record['wordsPerMinute'], 2)})
    assert len(results) == len({r['captionId'] for r in results}) == len(TARGETS) == 20
    assert [r['assetId'][-3:] for r in results if r['historical']] == ['042','051','057']
    report = {'method': 'Checked exact source bytes, caption identity, auditioned voice embedding and expected phonemes in the actual Kokoro generation. Audible delivery and technical intelligibility require playback review.', 'results': results}
    (OUT / 'records/diction.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')


if __name__ == '__main__':
    main()
