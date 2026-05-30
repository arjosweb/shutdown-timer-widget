import test from 'node:test';
import assert from 'node:assert/strict';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { ShutdownService } from '../services/shutdownService';

function setPlatform(platform: NodeJS.Platform): () => void {
    const originalDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', {
        value: platform,
    });
    return () => {
        if (originalDescriptor) {
            Object.defineProperty(process, 'platform', originalDescriptor);
        }
    };
}

function createServiceDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'shutdown-service-test-'));
}

test('cancelShutdown sends shutdown -c on linux', async () => {
    const restorePlatform = setPlatform('linux');
    try {
        const userDataPath = createServiceDir();
        const service = new ShutdownService(userDataPath);
        const commands: string[] = [];

        (service as unknown as { execSudo: (command: string) => Promise<void> }).execSudo = async (
            command: string,
        ) => {
            commands.push(command);
        };

        await service.cancelShutdown();

        assert.ok(commands.includes('/sbin/shutdown -c'));
    } finally {
        restorePlatform();
    }
});

test('cancelShutdown sends shutdown /a on windows', async () => {
    const restorePlatform = setPlatform('win32');
    try {
        const userDataPath = createServiceDir();
        const service = new ShutdownService(userDataPath);
        const commands: string[] = [];

        (service as unknown as { execSudo: (command: string) => Promise<void> }).execSudo = async (
            command: string,
        ) => {
            commands.push(command);
        };

        await service.cancelShutdown();

        assert.ok(commands.includes('shutdown /a'));
    } finally {
        restorePlatform();
    }
});

test('scheduleShutdown rounds linux timer to minutes', async () => {
    const restorePlatform = setPlatform('linux');
    try {
        const userDataPath = createServiceDir();
        const service = new ShutdownService(userDataPath);
        const commands: string[] = [];

        (service as unknown as { execSudo: (command: string) => Promise<void> }).execSudo = async (
            command: string,
        ) => {
            commands.push(command);
        };

        await service.scheduleShutdown(61);

        assert.ok(commands.includes('/sbin/shutdown -h +2'));
    } finally {
        restorePlatform();
    }
});

test('scheduleShutdown does not create pmset shutdown on macOS', async () => {
    const restorePlatform = setPlatform('darwin');
    try {
        const userDataPath = createServiceDir();
        const service = new ShutdownService(userDataPath);
        const commands: string[] = [];

        (service as unknown as { execSudo: (command: string) => Promise<void> }).execSudo = async (
            command: string,
        ) => {
            commands.push(command);
        };

        await service.scheduleShutdown(60);

        assert.equal(commands.some((command) => command.includes('pmset schedule shutdown')), false);
    } finally {
        restorePlatform();
    }
});
