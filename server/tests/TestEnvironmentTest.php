<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';

final class TestEnvironmentTest extends TestCase
{
    public function testOnlyNewOwnerOnlyStorageCanBeCreated(): void
    {
        $first = TestEnvironment::create();
        $second = TestEnvironment::create();
        try {
            self::assertNotSame($first->directory(), $second->directory());
            self::assertSame(0700, fileperms($first->directory()) & 0777);
            self::assertStringNotContainsString(dirname(__DIR__, 2), $first->directory());
            $first->writeFile('sentinel', 'owned');
            self::assertSame(0600, fileperms($first->directory() . '/sentinel') & 0777);
            foreach ([$first->directory(), '/', '/production/game.sqlite', '/website/analytics.sqlite', 'relative.sqlite'] as $target) {
                try {
                    TestEnvironment::create($target);
                    self::fail('An existing or caller-supplied storage root was accepted.');
                } catch (InvalidArgumentException) {
                    self::assertTrue(true);
                }
                try {
                    $first->connect($target);
                    self::fail('A caller-supplied database was accepted.');
                } catch (InvalidArgumentException) {
                    self::assertTrue(true);
                }
            }
            foreach (['../escape', '/absolute', 'nested/path', 'bad\\path'] as $name) {
                try {
                    $first->writeFile($name, 'no');
                    self::fail('A path was accepted as an owned filename.');
                } catch (InvalidArgumentException) {
                    self::assertTrue(true);
                }
            }
        } finally {
            $first->close();
            $second->close();
        }
        self::assertDirectoryDoesNotExist($first->directory());
        $this->expectException(LogicException::class);
        $first->connect();
    }

    public function testSeparateConnectionsActuallyContendRollbackAndRemainIsolated(): void
    {
        $environment = TestEnvironment::create();
        $other = TestEnvironment::create();
        try {
            $writer = $environment->connect();
            $reader = $environment->connect();
            self::assertNotSame($writer, $reader);
            self::assertSame(1, (int) $writer->query('PRAGMA foreign_keys')->fetchColumn());
            self::assertSame('delete', $writer->query('PRAGMA journal_mode')->fetchColumn());
            self::assertSame(2, (int) $writer->query('PRAGMA synchronous')->fetchColumn());
            self::assertSame(250, (int) $writer->query('PRAGMA busy_timeout')->fetchColumn());
            $writer->exec('CREATE TABLE synthetic_counter (id INTEGER PRIMARY KEY, value INTEGER NOT NULL)');
            $writer->exec('INSERT INTO synthetic_counter VALUES (1, 7)');
            $writer->exec('BEGIN IMMEDIATE');
            $writer->exec('UPDATE synthetic_counter SET value = 8 WHERE id = 1');
            self::assertSame(7, (int) $reader->query('SELECT value FROM synthetic_counter')->fetchColumn());
            try {
                $reader->exec('BEGIN IMMEDIATE');
                self::fail('Second connection obtained the held writer lock.');
            } catch (PDOException $error) {
                self::assertSame(5, $error->errorInfo[1]);
            }
            $writer->exec('ROLLBACK');
            self::assertSame(7, (int) $reader->query('SELECT value FROM synthetic_counter')->fetchColumn());
            $reader->exec('BEGIN IMMEDIATE');
            $reader->exec('UPDATE synthetic_counter SET value = 9 WHERE id = 1');
            $reader->exec('COMMIT');
            self::assertSame(9, (int) $writer->query('SELECT value FROM synthetic_counter')->fetchColumn());
            self::assertSame(0, (int) $other->connect()->query("SELECT count(*) FROM sqlite_master WHERE name = 'synthetic_counter'")->fetchColumn());
        } finally {
            $environment->close();
            $other->close();
        }
    }

    public function testCleanupRefusesUnownedFilesAndSymlinksWithoutTouchingTheirTargets(): void
    {
        $environment = TestEnvironment::create();
        $other = TestEnvironment::create();
        $target = $other->writeFile('sentinel', 'preserve');
        $link = $environment->directory() . '/unknown';
        try {
            symlink($target, $link);
            try {
                $environment->close();
                self::fail('Cleanup accepted an unowned symlink.');
            } catch (RuntimeException) {
                self::assertSame('preserve', file_get_contents($target));
                self::assertDirectoryExists($environment->directory());
            }
            unlink($link);
            $owned = $environment->writeFile('owned', 'old');
            rename($owned, $owned . '.held');
            symlink($target, $owned);
            try {
                $environment->connect();
                self::fail('Storage containing a replaced owned file was accepted.');
            } catch (RuntimeException) {
                self::assertSame('preserve', file_get_contents($target));
            }
            unlink($owned);
            rename($owned . '.held', $owned);
        } finally {
            $environment->close();
            $other->close();
        }
    }

    public function testExistingFilesPermissionsHardlinksAndRootReplacementFailClosed(): void
    {
        $environment = TestEnvironment::create();
        $other = TestEnvironment::create();
        $owned = $environment->writeFile('owned', 'preserve');
        $root = $environment->directory();
        try {
            try {
                $environment->writeFile('owned', 'replace');
                self::fail('An existing owned file was overwritten.');
            } catch (RuntimeException) {
                self::assertSame('preserve', file_get_contents($owned));
            }
            chmod($owned, 0644);
            try {
                $environment->close();
                self::fail('Public file permissions were accepted.');
            } catch (RuntimeException) {
                self::assertFileExists($owned);
            } finally {
                chmod($owned, 0600);
            }
            $link = $other->directory() . '/external-hardlink';
            link($owned, $link);
            try {
                $environment->close();
                self::fail('A multiply linked owned file was accepted.');
            } catch (RuntimeException) {
                self::assertSame('preserve', file_get_contents($link));
            } finally {
                unlink($link);
            }
            rename($root, $root . '.held');
            symlink($other->directory(), $root);
            try {
                $environment->connect();
                self::fail('A replaced root was accepted.');
            } catch (RuntimeException) {
                self::assertFileDoesNotExist($other->directory() . '/synthetic.sqlite');
            } finally {
                unlink($root);
                rename($root . '.held', $root);
            }
            $connection = $environment->connect();
            $connection->exec('CREATE TABLE synthetic_rollback (value INTEGER)');
            $connection->exec('BEGIN IMMEDIATE');
            $connection->exec('INSERT INTO synthetic_rollback VALUES (1)');
            // close rolls back owned pending work before removing its known files.
        } finally {
            $environment->close();
            $other->close();
        }
        self::assertDirectoryDoesNotExist($root);
    }
}
