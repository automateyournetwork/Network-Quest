<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest;

use InvalidArgumentException;
use JsonException;
use Opis\JsonSchema\Parsers\SchemaParser;
use Opis\JsonSchema\Schema;
use Opis\JsonSchema\SchemaLoader;
use Opis\JsonSchema\Validator;
use stdClass;

/** A retained provisional result, never an HTTP decision or an authorization. */
final readonly class SaveValidationResult
{
    public bool $provisional;

    public function __construct(
        public bool $ok,
        public ?string $code,
        public string $path,
        public ?string $candidateJson = null,
    ) {
        $this->provisional = true;
    }

    /** A fresh copy: callers cannot mutate the retained validated payload. */
    public function candidate(): ?stdClass
    {
        return $this->candidateJson === null ? null : json_decode($this->candidateJson, false, SaveValidator::MAX_JSON_DEPTH, JSON_THROW_ON_ERROR);
    }
}

/**
 * Only validates still-new writes. No HTTP, DB, session, configuration discovery,
 * migration or stored-version reader. T043 resolves an authorized receipt before
 * calling this, then reauthorizes and rechecks receipts in its final transaction
 * before using EITHER the success or the provisional error. Preserve original
 * request bytes for fingerprints; no normalization or reserialization occurs.
 * Policy objects must be trusted, reviewed, version-specific registry projections.
 */
final class SaveValidator
{
    public const MAX_BYTES = 262144;
    public const MAX_NOTE_CODEPOINTS = 4096;
    public const MAX_JSON_DEPTH = 32;
    private readonly Validator $validator;
    private readonly Schema $schema;
    private readonly array $policies;

    /** @param list<stdClass> $policies See SaveContentPolicy in the TS module. */
    public function __construct(array $policies)
    {
        $versions = array_map(static fn (stdClass $p): string => $p->contentVersion, $policies);
        if (count(array_unique($versions)) !== count($versions)) {
            throw new InvalidArgumentException('Duplicate save policy version.');
        }
        foreach ($policies as $policy) {
            foreach ($policy->objectivePrerequisites as $expression) { self::checkDependency($expression); }
        }
        $this->policies = json_decode(json_encode($policies, JSON_THROW_ON_ERROR), false, 64, JSON_THROW_ON_ERROR);
        // Static bundled contract only. No resolver means no local-file or remote
        // schema retrieval; internal #/$defs references are resolved from this object.
        $loader = new SchemaLoader(new SchemaParser(options: [
            'allowFormats' => true, 'allowFilters' => false, 'allowMappers' => false,
            'allowDefaults' => false, 'allowGlobals' => false, 'allowSlots' => false,
        ]), null, false);
        $contract = json_decode(file_get_contents(__DIR__ . '/../../specs/001-physical-layer-underworld/contracts/save.schema.json'), false, 64, JSON_THROW_ON_ERROR);
        $this->schema = $loader->loadObjectSchema($contract);
        $this->validator = new Validator($loader, 1, true);
    }

    private static function fail(string $code, string $path = ''): SaveValidationResult
    {
        return new SaveValidationResult(false, $code, $path);
    }

    public function validateStructure(string $rawBody): SaveValidationResult
    {
        if (strlen($rawBody) > self::MAX_BYTES) { return self::fail('body-too-large'); }
        if (!mb_check_encoding($rawBody, 'UTF-8')) { return self::fail('json'); }
        try {
            // Native decode rejects invalid UTF-8, BOM, lone escaped surrogates,
            // malformed JSON and excess nesting without substitutions or repair.
            $candidate = json_decode($rawBody, false, self::MAX_JSON_DEPTH, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return self::fail('json');
        }
        if (!self::finite($candidate) || !$this->validator->validate($candidate, $this->schema)->isValid()) {
            return self::fail('schema');
        }
        return new SaveValidationResult(true, null, '', $rawBody);
    }

    private static function finite(mixed $value): bool
    {
        if (is_float($value)) { return is_finite($value); }
        if (is_object($value) || is_array($value)) {
            foreach ($value as $child) { if (!self::finite($child)) { return false; } }
        }
        return true;
    }

    public function validateNewWrite(string $rawBody): SaveValidationResult
    {
        $structural = $this->validateStructure($rawBody);
        if (!$structural->ok) { return $structural; }
        $s = $structural->candidate();
        $w = $s->world;
        $n = $s->notebook;
        $p = null;
        foreach ($this->policies as $policy) { if ($policy->contentVersion === $s->contentVersion) { $p = $policy; break; } }
        if ($p === null) { return self::fail('content-version', '/contentVersion'); }
        $refs = [
            ['room', [$w->roomId], '/world/roomId'], ['objective', $w->completedObjectiveIds, '/world/completedObjectiveIds'],
            ['quest', $w->completedQuestIds, '/world/completedQuestIds'], ['achievement', $w->achievementIds, '/world/achievementIds'],
            ['effect', $w->dialogueEffectIds, '/world/dialogueEffectIds'], ['flag', array_keys(get_object_vars($w->flags)), '/world/flags'],
            ['item', array_column($w->inventory, 'itemId'), '/world/inventory'], ['character', array_column($w->recruits, 'characterId'), '/world/recruits'],
            ['character', $w->activeAllyIds, '/world/activeAllyIds'], ['compendium', $w->compendiumIds, '/world/compendiumIds'],
            ['fact', $n->factIds, '/notebook/factIds'], ['room', $n->mapRoomIds, '/notebook/mapRoomIds'],
        ];
        foreach ($w->recruits as $i => $r) {
            $refs[] = ['ability', $r->abilityIds, "/world/recruits/$i/abilityIds"];
            $refs[] = ['flag', $r->progressFlags, "/world/recruits/$i/progressFlags"];
        }
        foreach ($n->hypotheses as $i => $r) { $refs[] = ['subject', $r->subjectIds, "/notebook/hypotheses/$i/subjectIds"]; }
        foreach ($n->measurements as $i => $r) {
            $refs[] = ['rule', [$r->ruleId], "/notebook/measurements/$i/ruleId"];
            $refs[] = ['room', [$r->roomId], "/notebook/measurements/$i/roomId"];
            $refs[] = ['subject', $r->subjectIds, "/notebook/measurements/$i/subjectIds"];
        }
        foreach ($s->assistance as $i => $r) {
            $refs[] = ['objective', [$r->objectiveId], "/assistance/$i/objectiveId"];
            $refs[] = ['hint', [$r->hintId], "/assistance/$i/hintId"];
        }
        foreach ($s->outcomeHistory as $i => $r) { $refs[] = ['caveat', $r->caveatIds, "/outcomeHistory/$i/caveatIds"]; }
        foreach ($refs as [$kind, $ids, $path]) {
            foreach ($ids as $id) { if (!in_array($id, $p->members->{$kind}, true)) { return self::fail('reference', $path); } }
        }
        $anchor = $p->safePositions->{$w->position->safePositionId} ?? null;
        if ($anchor === null || $anchor->roomId !== $w->roomId || !in_array($s->safeState, $anchor->eligibleStates, true)
            || ($w->continueOutcome !== null && $s->safeState !== 'safe-continue')) {
            return self::fail('safe-state', '/world/position');
        }
        foreach ($w->flags as $id => $value) {
            foreach ($p->unsafeFlags->{$id} ?? [] as $unsafe) {
                // JSON has one number type; 1 and 1.0 must match just as in JS.
                $numeric = (is_int($value) || is_float($value)) && (is_int($unsafe) || is_float($unsafe));
                if ($numeric ? $value == $unsafe : $value === $unsafe) { return self::fail('safe-state', '/world/flags'); }
            }
        }
        foreach ([
            [array_column($w->inventory, 'itemId'), '/world/inventory'], [array_column($w->recruits, 'characterId'), '/world/recruits'],
            [array_map('strtolower', array_column($n->hypotheses, 'id')), '/notebook/hypotheses'], [array_map('strtolower', array_column($n->measurements, 'id')), '/notebook/measurements'],
            [array_map('strtolower', array_column($s->outcomeHistory, 'id')), '/outcomeHistory'],
        ] as [$ids, $path]) {
            if (count(array_unique($ids)) !== count($ids)) { return self::fail('relationship', $path); }
        }
        foreach ($w->inventory as $item) {
            $max = $p->itemMaxQuantities->{$item->itemId} ?? null;
            if ($max === null || $item->quantity > $max) { return self::fail('relationship', '/world/inventory'); }
        }
        foreach ($w->recruits as $recruit) {
            $allowed = $p->recruits->{$recruit->characterId} ?? null;
            if ($allowed === null || $recruit->level > $allowed->maxLevel
                || array_diff($recruit->abilityIds, $allowed->abilityIds) !== []
                || array_diff($recruit->progressFlags, $allowed->progressFlagIds) !== []) {
                return self::fail('relationship', '/world/recruits');
            }
        }
        if (array_diff($w->activeAllyIds, array_column($w->recruits, 'characterId')) !== []) { return self::fail('relationship', '/world/activeAllyIds'); }
        foreach ($s->assistance as $hint) {
            $allowed = $p->hints->{$hint->hintId} ?? null;
            if ($allowed === null || $hint->objectiveId !== $allowed->objectiveId || $hint->level != $allowed->level) {
                return self::fail('relationship', '/assistance');
            }
        }
        foreach ($w->completedObjectiveIds as $id) {
            $dependency = $p->objectivePrerequisites->{$id} ?? null;
            if ($dependency === null || !self::complete($dependency, $w->completedObjectiveIds)) { return self::fail('objective', '/world/completedObjectiveIds'); }
        }
        foreach ($n->measurements as $measurement) {
            $rule = $p->measurementRules->{$measurement->ruleId} ?? null;
            if ($rule === null || !in_array($measurement->conclusionCode, $rule->conclusionCodes, true)
                || count(array_unique(array_column($measurement->readings, 'name'))) !== count($measurement->readings)
                || (!$measurement->stale && ($measurement->configurationRevision != $w->configurationRevision || strtolower($measurement->attemptId) !== strtolower($w->attemptId)))) {
                return self::fail('measurement', '/notebook/measurements');
            }
            foreach ($measurement->readings as $reading) {
                if (($rule->readings->{$reading->name} ?? null) !== $reading->unit) { return self::fail('measurement', '/notebook/measurements'); }
            }
        }
        return $structural;
    }

    /** Only monotonic objective dependencies, preserving every all/any branch. */
    private static function checkDependency(mixed $value, int $depth = 0): void
    {
        if ($depth > 16 || !$value instanceof stdClass) { throw new InvalidArgumentException('Invalid save completion policy.'); }
        if (($value->kind ?? null) === 'always') { return; }
        if (($value->kind ?? null) === 'objective-complete' && is_string($value->objectiveId ?? null)) { return; }
        if (in_array($value->kind ?? null, ['all', 'any'], true) && is_array($value->conditions ?? null)
            && array_is_list($value->conditions) && count($value->conditions) > 0 && count($value->conditions) <= 64) {
            foreach ($value->conditions as $child) { self::checkDependency($child, $depth + 1); }
            return;
        }
        throw new InvalidArgumentException('Unsupported save completion policy.');
    }

    private static function complete(stdClass $condition, array $ids): bool
    {
        return match ($condition->kind) {
            'always' => true,
            'objective-complete' => in_array($condition->objectiveId, $ids, true),
            'all' => array_all($condition->conditions, static fn ($c) => self::complete($c, $ids)),
            'any' => array_any($condition->conditions, static fn ($c) => self::complete($c, $ids)),
            default => false,
        };
    }
}
