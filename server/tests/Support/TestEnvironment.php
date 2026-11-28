<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest\Tests\Support;

use CurlHandle;
use InvalidArgumentException;
use LogicException;
use PDO;
use PDOException;
use RuntimeException;

/** Test-only owner of newly allocated disposable files. Cannot adopt external storage. */
final class TestEnvironment
{
    private array $files = [];
    private array $connections = [];
    private array $processes = [];
    private array $pipes = [];
    private bool $closed = false;
    private ?string $origin = null;
    private ?int $phpPort = null;
    private ?string $sessionToken = null;
    private readonly array $rootIdentity;

    private function __construct(private readonly string $root)
    {
        $this->rootIdentity = lstat($root);
    }

    public static function create(): self
    {
        if (func_num_args() !== 0) {
            throw new InvalidArgumentException('Test storage locations are allocated, never supplied.');
        }
        // POSIX runtime baseline: ignore caller-controlled TMPDIR and production paths.
        // Canonicalizing the system /tmp link is safe; no caller selects a directory.
        $parent = realpath('/tmp');
        $repository = dirname(__DIR__, 3);
        if ($parent === false || !is_dir($parent) || !is_writable($parent)
            || $parent === $repository || str_starts_with($parent, $repository . '/')) {
            throw new RuntimeException('An external temporary directory is required.');
        }
        $root = $parent . '/network-quest-tests-' . bin2hex(random_bytes(24));
        $mask = umask(0077);
        try {
            if (!mkdir($root, 0700)) {
                throw new RuntimeException('Could not allocate isolated test storage.');
            }
        } finally {
            umask($mask);
        }
        $environment = new self($root);
        $environment->writeFile('ownership', bin2hex(random_bytes(32)));
        return $environment;
    }

    public function directory(): string
    {
        return $this->root;
    }

    /** Filenames only; no absolute, nested, URI, existing or symlink targets. */
    public function writeFile(string $name, string $contents): string
    {
        $this->assertOwned();
        if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$/D', $name)) {
            throw new InvalidArgumentException('Expected a single test filename.');
        }
        $path = $this->root . '/' . $name;
        if (file_exists($path) || is_link($path)) {
            throw new RuntimeException('Test files cannot replace existing paths.');
        }
        $mask = umask(0077);
        try {
            $handle = fopen($path, 'x+b');
            if ($handle === false) {
                throw new RuntimeException('Could not create an owned test file.');
            }
            try {
                if (fwrite($handle, $contents) !== strlen($contents) || !fflush($handle)) {
                    throw new RuntimeException('Could not write an owned test file.');
                }
            } finally {
                fclose($handle);
                $this->files[$name] = lstat($path);
            }
        } finally {
            umask($mask);
        }
        return $path;
    }

    /** Every call opens a separate connection to this object's one new synthetic DB. */
    public function connect(): PDO
    {
        if (func_num_args() !== 0) {
            throw new InvalidArgumentException('A test cannot select a database path.');
        }
        $this->assertOwned();
        if (!isset($this->files['synthetic.sqlite'])) {
            $this->writeFile('synthetic.sqlite', '');
        }
        $connection = new PDO('sqlite:' . $this->root . '/synthetic.sqlite', null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $connection->exec('PRAGMA foreign_keys = ON');
        $connection->exec('PRAGMA journal_mode = DELETE');
        $connection->exec('PRAGMA synchronous = FULL');
        $connection->exec('PRAGMA busy_timeout = 250');
        $this->connections[] = $connection;
        return $connection;
    }

    /** Native session transport fixture, not an application account or auth implementation. */
    public function createSessionFixture(string $identity): void
    {
        if (!preg_match('/^fixture-[a-z0-9-]{1,40}$/D', $identity) || $this->sessionToken !== null) {
            throw new InvalidArgumentException('Use one explicitly synthetic identity per fixture server.');
        }
        $this->sessionToken = bin2hex(random_bytes(32));
        $this->writeFile('sess_' . $this->sessionToken, 'identity|' . serialize($identity));
    }

    public function startApi(array $environmentOverrides = []): string
    {
        // Narrow negative-test options cannot redirect storage or load an alternate router.
        if (array_diff(array_keys($environmentOverrides), ['NQ_ENVIRONMENT', 'NQ_TEST_AUTH', 'NQ_TEST_IDENTITY', 'NQ_CONFIG_FILE']) !== []) {
            throw new InvalidArgumentException('Unsupported negative-test environment option.');
        }
        return $this->start(dirname(__DIR__, 2) . '/public/index.php', $environmentOverrides);
    }

    /** Explicit owned synthetic JSON only; exercises the actual entry, never a test-auth switch. */
    public function startConfiguredApi(string $configuration): string
    {
        $this->assertOwned();
        if (dirname($configuration) !== $this->root || !isset($this->files[basename($configuration)])) {
            throw new InvalidArgumentException('Configured tests require an owned private file.');
        }
        return $this->start(dirname(__DIR__, 2) . '/public/index.php', [
            'NQ_CONFIG_FILE' => $configuration,
            'NQ_DOCUMENT_ROOTS_JSON' => json_encode([realpath(dirname(__DIR__, 3)), realpath(dirname(__DIR__, 2) . '/public')], JSON_THROW_ON_ERROR),
        ]);
    }

    public function startFixtureServer(): string
    {
        if ($this->sessionToken === null) {
            throw new LogicException('Create a synthetic session before starting its fixture server.');
        }
        return $this->start(__DIR__ . '/session-router.php', [
            'NQ_HARNESS_DIRECTORY' => $this->root,
            'NQ_HARNESS_SESSION' => $this->sessionToken,
        ]);
    }

    /** The HTTPS proxy enforces the exact Node version when it starts. */
    public static function nodeBinary(): string
    {
        $node = getenv('NQ_TEST_NODE_BIN') ?: dirname(__DIR__, 3) . '/.runtime/node-v26.13.1-darwin-arm64/bin/node';
        if (!str_starts_with($node, '/') || !is_executable($node)) {
            throw new RuntimeException('Supply the absolute pinned Node 26.13.1 binary as NQ_TEST_NODE_BIN.');
        }
        return $node;
    }

    private function start(string $router, array $extra): string
    {
        $this->assertOwned();
        if ($this->processes !== [] || PHP_VERSION !== '8.4.28') {
            throw new LogicException('Start once per environment with pinned PHP 8.4.28.');
        }
        $node = self::nodeBinary();
        $this->certificate();
        $errors = $this->writeFile('transport-errors', '');
        $listener = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
        if ($listener === false) {
            throw new RuntimeException('Could not reserve a loopback PHP port.');
        }
        $address = stream_socket_get_name($listener, false);
        $this->phpPort = (int) substr($address, strrpos($address, ':') + 1);
        fclose($listener);
        $token = bin2hex(random_bytes(32));
        $childEnvironment = ['LANG' => 'C', 'LC_ALL' => 'C', 'TMPDIR' => $this->root,
            'NQ_ENVIRONMENT' => 'local', 'NQ_DEV_PROXY_TOKEN' => $token];
        $php = proc_open([PHP_BINARY, '-d', 'display_errors=0', '-d', 'log_errors=0',
            '-d', 'auto_prepend_file=', '-d', 'auto_append_file=', '-d', 'expose_php=0',
            '-d', 'session.auto_start=0', '-d', 'session.save_path=' . $this->root,
            '-S', '127.0.0.1:' . $this->phpPort, '-t', dirname(__DIR__, 2) . '/public', $router],
            // CLI access logs may contain query strings: discard them at the process boundary.
            [0 => ['file', '/dev/null', 'r'], 1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']],
            $unused, $this->root, array_replace($childEnvironment, $extra));
        if (!is_resource($php)) {
            throw new RuntimeException('Could not start isolated PHP.');
        }
        $this->processes[] = $php;
        $ready = false;
        for ($attempt = 0; $attempt < 100 && proc_get_status($php)['running']; $attempt++) {
            $socket = @stream_socket_client('tcp://127.0.0.1:' . $this->phpPort, $errno, $error, 0.05);
            if ($socket !== false) {
                fclose($socket);
                $ready = true;
                break;
            }
            usleep(20000);
        }
        if (!$ready) {
            throw new RuntimeException('Isolated PHP did not become ready.');
        }
        $transport = proc_open([$node, __DIR__ . '/https-proxy.mjs', $this->root . '/certificate.pem',
            $this->root . '/private-key.pem', (string) $this->phpPort],
            [0 => ['file', '/dev/null', 'r'], 1 => ['pipe', 'w'], 2 => ['file', $errors, 'a']],
            $pipes, $this->root, ['LANG' => 'C', 'LC_ALL' => 'C', 'NQ_PROXY_TOKEN' => $token]);
        if (!is_resource($transport)) {
            throw new RuntimeException('Could not start isolated HTTPS.');
        }
        $this->processes[] = $transport;
        $this->pipes[] = $pipes[1];
        stream_set_blocking($pipes[1], false);
        $output = '';
        for ($attempt = 0; $attempt < 100 && proc_get_status($transport)['running']; $attempt++) {
            $output .= stream_get_contents($pipes[1]);
            if (str_contains($output, "\n")) {
                $data = json_decode(trim($output), true);
                if (is_array($data) && preg_match('~^https://127\.0\.0\.1:[1-9][0-9]{0,4}$~D', $data['origin'] ?? '')) {
                    return $this->origin = $data['origin'];
                }
                break;
            }
            usleep(20000);
        }
        throw new RuntimeException('Isolated HTTPS did not become ready.');
    }

    public function newClient(bool $trustCertificate = true): CurlHandle
    {
        $this->assertOwned();
        $client = curl_init();
        curl_setopt_array($client, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_TIMEOUT => 5,
            CURLOPT_COOKIEFILE => '', CURLOPT_PROXY => '', CURLOPT_PATH_AS_IS => true]);
        if ($trustCertificate) {
            curl_setopt($client, CURLOPT_CAINFO, $this->root . '/certificate.pem');
        }
        return $client;
    }

    public function request(string $method, string $path, array $headers = [], string $body = '', ?CurlHandle $client = null): array
    {
        $this->assertOwned();
        if ($this->origin === null || !str_starts_with($path, '/') || str_starts_with($path, '//')) {
            throw new LogicException('Requests require a running fixture and an origin-relative path.');
        }
        $client ??= $this->newClient();
        $responseHeaders = [];
        curl_setopt_array($client, [CURLOPT_URL => $this->origin . $path, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $body, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_NOBODY => $method === 'HEAD',
            CURLOPT_HEADERFUNCTION => static function ($handle, string $line) use (&$responseHeaders): int {
                if (str_contains($line, ':')) {
                    [$name, $value] = explode(':', $line, 2);
                    $responseHeaders[strtolower(trim($name))] = trim($value);
                }
                return strlen($line);
            }]);
        $response = curl_exec($client);
        if ($response === false) {
            throw new RuntimeException('TLS request failed (' . curl_errno($client) . ').');
        }
        return ['status' => curl_getinfo($client, CURLINFO_RESPONSE_CODE), 'headers' => $responseHeaders, 'body' => $response];
    }

    /** Negative transport probe; no proxy token or trusted forwarding headers. */
    public function directPhpRequest(string $path): array
    {
        if ($this->phpPort === null || !str_starts_with($path, '/')) {
            throw new LogicException('No isolated PHP listener.');
        }
        $client = curl_init('http://127.0.0.1:' . $this->phpPort . $path);
        curl_setopt_array($client, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 2, CURLOPT_PROXY => '']);
        $body = curl_exec($client);
        if ($body === false) {
            throw new RuntimeException('Direct isolated PHP probe failed.');
        }
        return ['status' => curl_getinfo($client, CURLINFO_RESPONSE_CODE), 'body' => $body];
    }

    public function diagnostics(): string
    {
        $this->assertOwned();
        return isset($this->files['transport-errors']) ? file_get_contents($this->root . '/transport-errors') : '';
    }

    private function certificate(): void
    {
        $config = $this->writeFile('openssl.cnf', "[req]\ndistinguished_name=dn\nx509_extensions=server\nprompt=no\n"
            . "[dn]\nCN=127.0.0.1\n[server]\nsubjectAltName=IP:127.0.0.1\nbasicConstraints=critical,CA:TRUE\n"
            . "keyUsage=critical,digitalSignature,keyEncipherment,keyCertSign\nextendedKeyUsage=serverAuth\n");
        $options = ['config' => $config, 'digest_alg' => 'sha256', 'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA, 'x509_extensions' => 'server'];
        $key = openssl_pkey_new($options);
        $csr = $key === false ? false : openssl_csr_new(['commonName' => '127.0.0.1'], $key, $options);
        $certificate = $csr === false ? false : openssl_csr_sign($csr, null, $key, 1, $options, random_int(1, PHP_INT_MAX));
        if ($certificate === false || !openssl_pkey_export($key, $keyPem, null, $options)
            || !openssl_x509_export($certificate, $certificatePem)) {
            throw new RuntimeException('Could not generate a scoped test TLS certificate.');
        }
        $this->writeFile('private-key.pem', $keyPem);
        $this->writeFile('certificate.pem', $certificatePem);
    }

    /** Check every owned inode and all directory entries before touching storage. */
    private function assertOwned(): void
    {
        if ($this->closed) {
            throw new LogicException('Test environment is closed.');
        }
        clearstatcache();
        $metadata = lstat($this->root);
        if ($metadata === false || is_link($this->root) || realpath($this->root) !== $this->root
            || ($metadata['mode'] & 0177777) !== 0040700 || !$this->sameIdentity($metadata, $this->rootIdentity)) {
            throw new RuntimeException('Test directory ownership changed.');
        }
        foreach (scandir($this->root) as $name) {
            if ($name !== '.' && $name !== '..' && !isset($this->files[$name])) {
                // Active SQLite rollback journals belong to a connection, never recursive cleanup.
                if ($name === 'synthetic.sqlite-journal' && $this->connections !== []) {
                    $journal = lstat($this->root . '/' . $name);
                    if ($journal !== false && ($journal['mode'] & 0170000) === 0100000
                        && $journal['uid'] === $this->rootIdentity['uid'] && $journal['nlink'] === 1
                        && ($journal['mode'] & 0077) === 0) {
                        continue;
                    }
                }
                throw new RuntimeException('Unowned entry found in test storage.');
            }
        }
        foreach ($this->files as $name => $identity) {
            $file = lstat($this->root . '/' . $name);
            if ($file === false || ($file['mode'] & 0170000) !== 0100000 || $file['nlink'] !== 1
                || ($file['mode'] & 0077) !== 0 || !$this->sameIdentity($file, $identity)) {
                throw new RuntimeException('Owned test file was replaced or made public.');
            }
        }
    }

    private function sameIdentity(array $actual, array $expected): bool
    {
        return $actual['dev'] === $expected['dev'] && $actual['ino'] === $expected['ino']
            && $actual['uid'] === $expected['uid'];
    }

    public function close(): void
    {
        if ($this->closed) {
            return;
        }
        $this->stopProcesses();
        $this->assertOwned();
        foreach ($this->connections as $connection) {
            try {
                // Also handles explicit SQL BEGIN IMMEDIATE, not just PDO beginTransaction().
                $connection->exec('ROLLBACK');
            } catch (PDOException $error) {
                if (!str_contains($error->getMessage(), 'no transaction is active')) {
                    throw $error;
                }
            }
        }
        $this->connections = [];
        $this->assertOwned(); // No lingering/unowned SQLite sidecar can be deleted.
        foreach (array_keys($this->files) as $name) {
            if (!unlink($this->root . '/' . $name)) {
                throw new RuntimeException('Could not remove owned test file.');
            }
            unset($this->files[$name]);
        }
        if (!rmdir($this->root)) {
            throw new RuntimeException('Could not remove owned test directory.');
        }
        $this->closed = true;
    }

    private function stopProcesses(): void
    {
        foreach (array_reverse($this->processes) as $process) {
            if (proc_get_status($process)['running']) {
                proc_terminate($process);
                for ($attempt = 0; $attempt < 100 && proc_get_status($process)['running']; $attempt++) {
                    usleep(10000);
                }
                if (proc_get_status($process)['running']) {
                    proc_terminate($process, 9);
                }
            }
            proc_close($process);
        }
        $this->processes = [];
        foreach ($this->pipes as $pipe) {
            if (is_resource($pipe)) {
                fclose($pipe);
            }
        }
        $this->pipes = [];
    }

    public function __destruct()
    {
        // Best-effort process cleanup only. Never recursively delete on an unverified path.
        $this->stopProcesses();
    }
}
