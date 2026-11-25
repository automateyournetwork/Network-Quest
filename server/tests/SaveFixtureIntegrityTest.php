<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use Opis\JsonSchema\Validator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Tests public fixture inputs/expectations, never a running account/save service. */
final class SaveFixtureIntegrityTest extends TestCase
{
    private const ROOT = __DIR__ . '/../..';

    private static function document(string $path): mixed
    {
        return json_decode(file_get_contents(self::ROOT . '/' . $path), false, flags: JSON_THROW_ON_ERROR);
    }

    private static function conformance(): object
    {
        return self::document('tests/fixtures/save-conformance.json');
    }

    private static function candidate(array $patches): object
    {
        $value = self::document(self::conformance()->schemaBase);
        foreach ($patches as $patch) {
            $parts = explode('/', substr($patch->path, 1));
            $key = array_pop($parts);
            $parent = $value;
            foreach ($parts as $part) {
                $parent = $parent->{$part};
            }
            if ($patch->op === 'remove') {
                unset($parent->{$key});
            } elseif ($patch->op === 'set') {
                $parent->{$key} = $patch->value;
            } elseif ($patch->op === 'repeat') {
                $parent->{$key} = str_repeat($patch->text, $patch->count);
            } else {
                throw new LogicException('Unknown fixture input operation.');
            }
        }
        return $value;
    }

    public static function schemaCases(): iterable
    {
        foreach (self::conformance()->schemaCases as $case) {
            yield $case->id => [$case];
        }
    }

    #[DataProvider('schemaCases')]
    public function testIndependentlyAuthoredSchemaExpectation(object $case): void
    {
        $validator = new Validator();
        $schema = self::document(self::conformance()->schemaContract);
        $result = $validator->validate(self::candidate($case->patches), $schema);
        self::assertSame($case->schemaValid, $result->isValid(), $case->id);
        if (str_starts_with($case->id, 'SEM-')) {
            self::assertTrue($case->schemaValid);
            self::assertStringStartsWith('reject-new-operation:', $case->semanticExpectation);
        }
    }

    public static function wireCases(): iterable
    {
        foreach (self::conformance()->wireCases as $case) {
            yield $case->id => [$case];
        }
    }

    #[DataProvider('wireCases')]
    public function testWireFixtureBytesAreIndependentOfCharacterCount(object $case): void
    {
        $base = file_get_contents(self::ROOT . '/' . self::conformance()->schemaBase);
        $wire = match ($case->recipe) {
            'exact-minimal-file-plus-ascii-space-padding' => $base . str_repeat(' ', $case->targetBytes - strlen($base)),
            'replace-note-string-with-hex' => str_replace('"personalNotes": ""', '"personalNotes": "' . hex2bin($case->hex) . '"', $base),
            'remove-final-closing-brace' => substr(rtrim($base), 0, -1),
            default => throw new LogicException('Unknown fixture wire recipe.'),
        };
        if (isset($case->targetBytes)) {
            self::assertSame($case->targetBytes, strlen($wire));
        }
        self::assertSame($case->validUtf8, mb_check_encoding($wire, 'UTF-8'));
        try {
            $decoded = json_decode($wire, false, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            self::assertFalse($case->validJson);
            return;
        }
        self::assertTrue($case->validJson);
        self::assertSame($case->schemaValid, (new Validator())->validate($decoded, self::document(self::conformance()->schemaContract))->isValid());
    }

    public function testNotesBoundaryCountsUnicodeCharactersNotBytes(): void
    {
        $note = str_repeat('🧭', 4096);
        self::assertSame(4096, mb_strlen($note, 'UTF-8'));
        self::assertSame(16384, strlen($note));
        self::assertSame(4096, mb_strlen(str_repeat("e\u{0301}", 2048), 'UTF-8'));
    }

    public function testBothIndependentlyWrittenMigrationSnapshotsUseCurrentSaveShape(): void
    {
        $baseline = self::document('tests/fixtures/save-migration-baseline.json');
        $schema = self::document(self::conformance()->schemaContract);
        $validator = new Validator();
        self::assertTrue($validator->validate($baseline->input, $schema)->isValid());
        self::assertTrue($validator->validate($baseline->expected, $schema)->isValid());
        self::assertFalse($validator->validate($baseline->unknownNewerSnapshot, $schema)->isValid());
        self::assertSame('pending', $baseline->behavioralAcceptance);
        foreach ($baseline->preservePaths as $path) {
            $before = $baseline->input;
            $after = $baseline->expected;
            foreach (explode('.', $path) as $key) {
                $before = $before->{$key};
                $after = $after->{$key};
            }
            self::assertEquals($before, $after, $path);
        }
        self::assertSame('E03', $baseline->expected->outcomeHistory[0]->outcome);
        self::assertNull($baseline->expected->world->continueOutcome);
        self::assertTrue($baseline->expected->notebook->measurements[0]->stale);
    }

    public function testServiceCasesRemainPendingAndUseExactContractStatusFamilies(): void
    {
        $fixture = self::document('server/tests/Fixtures/save-cases.json');
        $ids = [];
        foreach ($fixture->cases as $case) {
            self::assertArrayNotHasKey($case->id, $ids);
            $ids[$case->id] = true;
            self::assertSame('pending', $case->behavioralAcceptance);
            self::assertObjectHasProperty($case->requestProfile, $fixture->requestProfiles);
            self::assertContains($case->expected->status, [200, 201, 204, 400, 401, 403, 404, 409, 412, 413, 422, 428, 429, 503]);
            self::assertNotEmpty($case->expected->assertions);
        }
        foreach ($fixture->sources as $source) {
            self::assertDoesNotMatchRegularExpression('~(^/|\.\.|https?:|\.env)~', $source->path);
            self::assertStringContainsString($source->anchor, file_get_contents(self::ROOT . '/' . $source->path));
        }
        self::assertSame(604800, $fixture->policy->writeReceiptSeconds);
        self::assertSame(86400, $fixture->policy->deletionReceiptSeconds);
        self::assertSame('no-store', $fixture->responseRules->all->{'Cache-Control'});
    }

    public function testDeletionReceiptFixtureHasCanonical256BitEncoding(): void
    {
        $fixture = self::document('server/tests/Fixtures/save-cases.json');
        $profile = $fixture->requestProfiles->{'deletion-status'};
        $token = $profile->headers->{'X-Deletion-Receipt'};
        $decoded = base64_decode(strtr($token, '-_', '+/') . '=', true);
        self::assertSame(43, strlen($token));
        self::assertNotFalse($decoded);
        self::assertSame(32, strlen($decoded));
        self::assertSame($token, rtrim(strtr(base64_encode($decoded), '+/', '-_'), '='));
        self::assertNull($profile->session);
        self::assertSame(['Origin', 'X-Deletion-Receipt'], array_keys(get_object_vars($profile->headers)));
        // Noncanonical pad bits decode to the same bytes but must not be accepted.
        $other = substr($token, 0, -1) . '9';
        self::assertSame($decoded, base64_decode(strtr($other, '-_', '+/') . '=', true));
        self::assertNotSame($other, rtrim(strtr(base64_encode($decoded), '+/', '-_'), '='));
    }

    public function testSchemaReferencesCannotLoadRemoteDocuments(): void
    {
        $visit = function (mixed $value) use (&$visit): void {
            if (!is_object($value) && !is_array($value)) {
                return;
            }
            foreach ($value as $key => $child) {
                if ($key === '$ref') {
                    self::assertStringStartsWith('#/', $child);
                }
                $visit($child);
            }
        };
        $visit(self::document(self::conformance()->schemaContract));
    }
}
