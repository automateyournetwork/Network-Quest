# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Check the frozen caption and a term in the local Kokoro phoneme trace for each line."""
import hashlib
import json
from pathlib import Path

BATCH = Path(__file__).resolve().parent
ROOT = BATCH.parents[2]
AUDITIONS = BATCH.parent / 'auditions'

# Kokoro's English phones use compact symbols such as I for the vowel in "fiber".
TERMS = {
    '021': ('Hypotheses', 'hIpˈɑθəsˌiz'),
    '022': ('Copper, fiber and radio', 'kˈɑpəɹ, fˈIbəɹ ænd ɹˈAdiO'),
    '023': ('conventional tool', 'kənvˈɛnʧᵊnəl tˈul'),
    '024': ('two active allies', 'tˈu ˈæktɪv ˈælˌIz'),
    '025': ('application fails', 'ˌæpləkˈAʃən fˈAlz'),
    '026': ('record its use', 'ɹəkˈɔɹd ɪts jˈus'),
    '027': ('new configuration', 'nˈu kənfˌɪɡjəɹˈAʃən'),
    '028': ('hypothesis', 'hIpˈɑθəsɪs'),
    '029': ('malformed challenge', 'mˌælfˈɔɹmd ʧˈælənʤ'),
    '030': ('Rift', 'ɹˈɪft'),
    '031': ('declared endpoint test', 'dəklˈɛɹd ˈɛndpYnt tˈɛst'),
    '032': ('maintenance plan', 'mˈAntᵊnəns plˈæn'),
    '033': ('temporary bridge', 'tˈɛmpəɹˌɛɹi bɹˈɪʤ'),
    '034': ('unresolved fault', 'ˌʌnɹəzˈɑlvd fˈɔlt'),
    '035': ('Photon', 'fˈOtˌɑn'),
    '036': ('link lamp', 'lˈɪŋk lˈæmp'),
    '037': ('notebook keeps clues', 'nˈOtbˌʊk kˈips klˈuz'),
    '038': ('universal error detector', 'jˌunəvˈɜɹsᵊl ˈɛɹəɹ dətˈɛktəɹ'),
    '039': ('connector inspection', 'kənˈɛktəɹ ɪnspˈɛkʃən'),
    '040': ('live optical port or fiber end', 'lˈIv ˈɑptəkᵊl pˈɔɹt ɔɹ fˈIbəɹ ˈɛnd'),
}


def read(path):
    return json.loads(path.read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    plan = read(BATCH.parent / 'production-plan.json')['voices']
    historical = read(AUDITIONS / 'provenance/voice-run.json')['records']
    cast = {row['canonical']['speakerId']: row for row in historical}
    old = {row['canonical']['assetId']: row for row in historical}
    results = []
    for line in plan[20:40]:
        number = line['assetId'][-3:]
        word, phones = TERMS[number]
        retained = old.get(line['assetId'])
        source = (AUDITIONS / 'metadata-followup/voices' / (retained['slug'] + '.json') if retained
                  else BATCH / 'records' / f'voice-{number}-generation.json')
        rec = read(source)
        approved = cast[line['speakerId']]
        assert line['assetId'] == rec['assetId'] and rec['lineId'] == line['lineId'] == line['captionId']
        assert rec['voiceSha256'] == approved['voiceSha256'] and rec['voiceId'] == approved['voice']
        assert rec['text'] == line['text'] and word in line['text']
        assert (ROOT / rec['scriptPath']).read_bytes() == line['text'].encode()
        assert sha(ROOT / rec['scriptPath']) == rec['scriptSha256'] == line['textSha256']
        assert rec.get('deliveryText', rec['text']) == line['text'] and not rec['pronunciationOverrides']
        assert sha(ROOT / rec['rawPath']) == rec['rawSha256'] and phones in ' '.join(rec['phonemes'])
        results.append({
            'assetId': line['assetId'], 'captionId': line['captionId'], 'speakerId': line['speakerId'],
            'roomId': line['roomId'], 'textSha256': line['textSha256'],
            'wordOrPhrase': word, 'matchingModelPhonemes': phones, 'voiceId': rec['voiceId'],
            'speed': rec['speed'], 'wordsPerMinute': round(retained['approxWordsPerMinute'], 2) if retained else rec['wordsPerMinute'],
            'record': str(source.relative_to(ROOT)), 'recordSha256': sha(source), 'reusedT065': bool(retained)
        })
    assert len(results) == len(TERMS) == 20
    report = {'method': 'Compared frozen script bytes, model phoneme trace and auditioned cast embedding per line. Listening supplies the separate audible pronunciation and performance judgment.', 'results': results}
    (BATCH / 'records/diction.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
