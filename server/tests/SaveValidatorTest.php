<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\SaveValidator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../src/SaveValidator.php';

final class SaveValidatorTest extends TestCase
{
    private const ROOT = __DIR__ . '/../..';

    private static function read(string $path): string { return file_get_contents(self::ROOT . '/' . $path); }
    private static function doc(string $path): object { return json_decode(self::read($path), flags: JSON_THROW_ON_ERROR); }
    private static function conformance(): object { return self::doc('tests/fixtures/save-conformance.json'); }
    private static function fixture(): object { return self::doc('tests/services/save-validator-policy.json'); }
    private static function base(): string { return self::read(self::conformance()->schemaBase); }
    private static function validator(): SaveValidator { return new SaveValidator([self::fixture()->policy]); }

    private static function patched(array $patches): string
    {
        $value = json_decode(self::base(), flags: JSON_THROW_ON_ERROR);
        foreach ($patches as $patch) {
            $parts = explode('/', substr($patch->path, 1));
            $key = array_pop($parts);
            $parent = $value;
            foreach ($parts as $part) { $parent = $parent->{$part}; }
            if ($patch->op === 'remove') { unset($parent->{$key}); }
            else { $parent->{$key} = $patch->op === 'repeat' ? str_repeat($patch->text, $patch->count) : $patch->value; }
        }
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public static function schemaCases(): iterable
    {
        foreach (self::conformance()->schemaCases as $case) { yield $case->id => [$case]; }
    }

    #[DataProvider('schemaCases')]
    public function testIndependentSchemaAndSemanticExpectations(object $case): void
    {
        $raw = self::patched($case->patches);
        $validator = self::validator();
        self::assertSame($case->schemaValid, $validator->validateStructure($raw)->ok);
        $result = $validator->validateNewWrite($raw);
        self::assertTrue($result->provisional);
        self::assertSame($case->schemaValid && !str_starts_with($case->id, 'SEM-'), $result->ok);
    }

    public static function semanticCases(): iterable
    {
        foreach (self::fixture()->semanticCases as $case) { yield $case->id => [$case]; }
        foreach (self::doc('server/tests/Fixtures/save-cases.json')->cases as $case) {
            if (str_starts_with($case->id, 'SV-UNSAFE-')) {
                yield $case->id => [(object) ['patches' => $case->requestChanges->bodyPatch, 'code' => 'safe-state']];
            }
        }
    }

    #[DataProvider('semanticCases')]
    public function testSharedIndependentRelationshipExpectations(object $case): void
    {
        $raw = self::patched($case->patches);
        $result = self::validator()->validateNewWrite($raw);
        self::assertSame($case->code, $result->code);
        self::assertSame($case->code === null, $result->ok);
        self::assertTrue($result->provisional);
        if ($result->ok) {
            self::assertSame($raw, $result->candidateJson);
            self::assertEquals(json_decode($raw), $result->candidate());
        }
    }

    public static function wireCases(): iterable
    {
        $base = self::base();
        foreach (self::conformance()->wireCases as $case) {
            $raw = match ($case->recipe) {
                'exact-minimal-file-plus-ascii-space-padding' => $base . str_repeat(' ', $case->targetBytes - strlen($base)),
                'replace-note-string-with-hex' => str_replace('"personalNotes": ""', '"personalNotes": "' . hex2bin($case->hex) . '"', $base),
                'remove-final-closing-brace' => substr(rtrim($base), 0, -1),
            };
            yield $case->id => [$raw, $case->id === 'WIRE-BOUNDARY' ? null : ($case->id === 'WIRE-OVER' ? 'body-too-large' : 'json')];
        }
        foreach (self::fixture()->rawCases as $case) {
            yield $case->id => [$case->raw ?? str_replace('"personalNotes": ""', '"personalNotes": ' . $case->notesJson, $base), $case->code];
        }
        yield 'utf8-bom' => ["\xef\xbb\xbf" . $base, 'json'];
        yield 'nonfinite-number' => [str_replace('"configurationRevision": 0', '"configurationRevision": 1e999', $base), 'schema'];
        yield 'deep-json' => [str_repeat('[', 1000) . '0' . str_repeat(']', 1000), 'json'];
    }

    #[DataProvider('wireCases')]
    public function testStrictWireDecoding(string $raw, ?string $code): void
    {
        $result = self::validator()->validateNewWrite($raw);
        self::assertSame($code, $result->code);
        self::assertSame($code === null, $result->ok);
    }

    public function testStaleMeasurementsAndReadingRules(): void
    {
        $case = array_values(array_filter(self::conformance()->schemaCases, fn ($case) => $case->id === 'SEM-FRESHNESS'))[0];
        $value = json_decode(self::patched($case->patches));
        $row = $value->notebook->measurements[0];
        $row->stale = true;
        self::assertTrue(self::validator()->validateNewWrite(json_encode($value))->ok);
        $row->stale = false;
        $row->configurationRevision = 0;
        self::assertTrue(self::validator()->validateNewWrite(json_encode($value))->ok);
        $row->attemptId = strtoupper($row->attemptId);
        self::assertTrue(self::validator()->validateNewWrite(json_encode($value))->ok);
        $row->attemptId = '20000000-0000-4000-8000-000000000001';
        self::assertSame('measurement', self::validator()->validateNewWrite(json_encode($value))->code);
        $row->attemptId = $value->world->attemptId;
        $row->readings[0]->name = 'unsupported';
        self::assertSame('measurement', self::validator()->validateNewWrite(json_encode($value))->code);
        $row->readings[0]->name = 'length';
        $row->conclusionCode = 'unsupported';
        self::assertSame('measurement', self::validator()->validateNewWrite(json_encode($value))->code);
        $row->conclusionCode = 'fixture-inspected';
        $value->notebook->measurements[] = clone $row;
        self::assertSame('relationship', self::validator()->validateNewWrite(json_encode($value))->code);
    }

    public function testPolicyAndCandidateOwnershipNoDataInErrorsAndSeparateNewWritePolicy(): void
    {
        $policy = self::fixture()->policy;
        $validator = new SaveValidator([$policy]);
        $policy->members->room = [];
        $result = $validator->validateNewWrite(self::base());
        self::assertTrue($result->ok);
        $result->candidate()->world->roomId = 'changed';
        self::assertSame('spec001:R01', $result->candidate()->world->roomId);
        self::assertSame(self::base(), $result->candidateJson);
        $bad = str_replace('"personalNotes": ""', '"personalNotes": "' . str_repeat('secret', 4096) . '"', self::base());
        $error = $validator->validateNewWrite($bad);
        self::assertNull($error->candidateJson);
        self::assertNull($error->candidate());
        self::assertStringNotContainsString('secret', json_encode($error));
        self::assertSame('content-version', (new SaveValidator([]))->validateNewWrite(self::base())->code);
    }

    public function testUnknownStoredVersionHasNoReadResetOrMigrationSideEffect(): void
    {
        $future = self::doc('tests/fixtures/save-migration-baseline.json')->unknownNewerSnapshot;
        $raw = json_encode($future);
        self::assertFalse(self::validator()->validateNewWrite($raw)->ok);
        self::assertSame($raw, json_encode($future));
        self::assertFalse(method_exists(SaveValidator::class, 'readStored'));
    }

    public function testUnsupportedPolicyBranchIsNotDroppedFromAnAlternative(): void
    {
        $policy = self::fixture()->policy;
        $policy->objectivePrerequisites->{'spec001:O01'} = (object) ['kind' => 'any', 'conditions' => [(object) ['kind' => 'always'], (object) ['kind' => 'item-available']]];
        $this->expectException(InvalidArgumentException::class);
        new SaveValidator([$policy]);
    }

    public function testUnsafeFlagUsesJsonNumericEqualityWithoutStringOrBooleanCoercion(): void
    {
        $policy = self::fixture()->policy;
        $policy->unsafeFlags->{'spec001:fixture.progress'} = [1];
        $validator = new SaveValidator([$policy]);
        foreach (['1', '1.0', '1e0'] as $value) {
            $raw = str_replace('"flags": {}', '"flags": {"spec001:fixture.progress": ' . $value . '}', self::base());
            self::assertSame('safe-state', $validator->validateNewWrite($raw)->code);
        }
        foreach (['true', '"1"'] as $value) {
            $raw = str_replace('"flags": {}', '"flags": {"spec001:fixture.progress": ' . $value . '}', self::base());
            self::assertTrue($validator->validateNewWrite($raw)->ok);
        }
    }
}
