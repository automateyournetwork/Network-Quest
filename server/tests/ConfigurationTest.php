<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\Configuration;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';
require_once __DIR__ . '/../src/Configuration.php';

final class ConfigurationTest extends TestCase
{
    private TestEnvironment $environment;
    private TestEnvironment $recovery;
    private array $data;
    private array $roots;

    protected function setUp(): void
    {
        $this->environment = TestEnvironment::create();
        $this->recovery = TestEnvironment::create();
        $this->roots = [realpath(__DIR__ . '/../..'), realpath(__DIR__ . '/../public')];
        $this->data = ['origin' => 'https://game.invalid:8443', 'gamePath' => '/arcade/play/network-quest/',
            'databasePath' => $this->environment->directory() . '/synthetic.sqlite',
            'ledgerFile' => $this->recovery->directory() . '/synthetic.sqlite', 'rollbackRoots' => [$this->environment->directory()],
            'backupSeconds' => 30 * 86400, 'restorationSeconds' => 7 * 86400, 'retentionEvidence' => 'synthetic test policy',
            'rateKey' => rtrim(strtr(base64_encode(str_repeat('s', 32)), '+/', '-_'), '='),
            'googleClientId' => 'synthetic-client.apps.googleusercontent.com', 'googleClientSecret' => 'synthetic-google-secret',
            'githubClientId' => 'synthetic-github-client', 'githubClientSecret' => 'synthetic-github-secret',
            'googleCallback' => 'https://game.invalid:8443/arcade/play/network-quest/api/v1/auth/google/callback',
            'githubCallback' => 'https://game.invalid:8443/arcade/play/network-quest/api/v1/auth/github/callback'];
    }

    protected function tearDown(): void { $this->environment->close(); $this->recovery->close(); }

    private function file(?string $raw = null): string
    {
        return $this->environment->writeFile('config-' . bin2hex(random_bytes(4)) . '.json', $raw ?? json_encode($this->data, JSON_THROW_ON_ERROR));
    }

    public function testExplicitPrivateJsonAndDerivedExactPaths(): void
    {
        $config = Configuration::load($this->file(), $this->roots);
        self::assertSame($this->data['origin'], $config->origin);
        self::assertSame('/arcade/play/network-quest/api/v1', $config->apiPath);
        self::assertSame($this->data['googleCallback'], $config->googleCallback);
        self::assertSame(str_repeat('s', 32), $config->rateKey);
        self::assertFileDoesNotExist($this->data['databasePath'], 'Reading configuration cannot open or migrate storage.');
    }

    #[DataProvider('invalidFields')]
    public function testRejectsInvalidOrUnknownFields(string $key, mixed $value): void
    {
        $this->data[$key] = $value;
        $this->expectException(InvalidArgumentException::class);
        Configuration::load($this->file(), $this->roots);
    }

    public static function invalidFields(): iterable
    {
        foreach (['http://game.invalid', 'https://game.invalid/', 'https://game.invalid@evil.invalid', 'https://GAME.invalid', 'https://game.invalid:99999'] as $v) yield ['origin', $v];
        foreach (['/', '/game', '//game/', '/game/../other/', '/game/%2e/'] as $v) yield ['gamePath', $v];
        foreach (['rateKey', 'googleClientId', 'googleClientSecret', 'githubClientId', 'githubClientSecret'] as $k) yield [$k, ''];
        yield ['googleCallback', 'https://evil.invalid/arcade/play/network-quest/api/v1/auth/google/callback'];
        yield ['githubCallback', 'https://game.invalid:8443/arcade/play/network-quest/api/v1/auth/github/callback?x=1'];
        yield ['googleCallback', 'https://game.invalid:8443/other/api/v1/auth/google/callback'];
        yield ['testAuth', false]; yield ['NQ_TEST_AUTH', '']; yield ['httpHandler', 'fake']; yield ['databasePath', '/tmp/../private/game.sqlite'];
        yield ['rollbackRoots', []]; yield ['backupSeconds', 0]; yield ['restorationSeconds', '604800'];
        yield ['retentionEvidence', '']; yield ['ledgerFile', '/tmp/../ledger.sqlite'];
        yield ['rateKey', str_repeat('a', 43)]; yield ['googleClientSecret', "synthetic\nsecret"]; yield ['githubClientId', []];
    }

    public function testMissingKeysDuplicateKeysAndExecutableTextAreRejected(): void
    {
        $missing = $this->data; unset($missing['githubClientSecret']);
        foreach ([json_encode($missing), '{"origin":"https://evil.invalid",' . substr(json_encode($this->data), 1),
            '<?php throw new RuntimeException("must never execute");', '[]', str_repeat(' ', 16385),
            '{"origi\\u006e":"https://evil.invalid",' . substr(json_encode($this->data), 1)] as $raw) {
            try { Configuration::load($this->file($raw), $this->roots); self::fail('Expected strict private configuration rejection.'); }
            catch (InvalidArgumentException $error) { self::assertStringNotContainsString('secret', $error->getMessage()); }
        }
    }

    public function testPublicPathsEmptyRootsNoncanonicalAndSymlinkRejected(): void
    {
        $path = $this->file();
        foreach ([[$path, []], [$path, [$this->environment->directory()]], [dirname($path) . '/./' . basename($path), $this->roots],
            [$path, ['/tmp']], ['relative.json', $this->roots]] as [$candidate, $roots]) {
            try { Configuration::load($candidate, $roots); self::fail('Expected path rejection.'); }
            catch (InvalidArgumentException) { self::assertTrue(true); }
        }
        $link = $this->environment->directory() . '/config-link.json';
        symlink($path, $link);
        try {
            try { Configuration::load($link, $this->roots); self::fail('Expected symlink rejection.'); }
            catch (InvalidArgumentException) { self::assertTrue(true); }
        } finally { unlink($link); }
    }

    public function testPublicDatabaseAndPermissionsRejectedWithoutMutation(): void
    {
        $this->data['databasePath'] = $this->roots[0] . '/forbidden.sqlite';
        try { Configuration::load($this->file(), $this->roots); self::fail('Public DB refused.'); }
        catch (InvalidArgumentException) { self::assertFileDoesNotExist($this->data['databasePath']); }
        $this->data['databasePath'] = $this->environment->directory() . '/synthetic.sqlite';
        $path = $this->file(); chmod($path, 0644);
        try {
            try { Configuration::load($path, $this->roots); self::fail('Public config refused.'); }
            catch (InvalidArgumentException) { self::assertSame(0644, fileperms($path) & 0777); }
        } finally { chmod($path, 0600); }
    }
}
