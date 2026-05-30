import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import * as sudo from 'sudo-prompt';

export interface ShutdownMeta {
    sessionId: string;
    endAt: number;
    totalSeconds: number;
}

export class ShutdownService {
    private readonly flagPath: string;
    private readonly metaPath: string;
    private readonly options = {
        name: 'Shutdown Timer',
    };

    constructor(userDataPath: string) {
        this.flagPath = path.join(userDataPath, '.shutdown_timer_active');
        this.metaPath = path.join(userDataPath, '.shutdown_timer_meta');
    }

    /**
     * Schedules OS shutdown for the given duration.
     * On macOS, shutdown at timer zero is performed solely by pmset at the scheduled absolute time.
     */
    async scheduleShutdown(seconds: number): Promise<boolean> {
        const platform = process.platform;
        const sessionId = Date.now().toString();
        const endAt = Date.now() + seconds * 1000;

        try {
            this.writeControlFiles(sessionId, endAt, seconds);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            throw new Error(`Failed to create control files: ${message}`);
        }

        try {
            if (platform === 'darwin') {
                await this.scheduleDarwinShutdown(endAt);
            } else if (platform === 'win32') {
                await this.execSudo(`shutdown /s /t ${seconds}`);
            } else if (platform === 'linux') {
                const minutes = Math.max(1, Math.ceil(seconds / 60));
                await this.execSudo(`/sbin/shutdown -h +${minutes}`);
            } else {
                throw new Error(`Unsupported platform: ${platform}`);
            }
            return true;
        } catch (error: unknown) {
            this.clearControlFilesSync(sessionId);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(message);
        }
    }

    /**
     * Cancels a scheduled shutdown.
     */
    async cancelShutdown(): Promise<boolean> {
        const platform = process.platform;

        console.log('[ShutdownService] Cancelling shutdown. Flag path:', this.flagPath);
        try {
            if (fs.existsSync(this.flagPath)) {
                fs.unlinkSync(this.flagPath);
            }
            if (fs.existsSync(this.metaPath)) {
                fs.unlinkSync(this.metaPath);
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.warn('[ShutdownService] Error removing control files:', message);
        }

        if (platform === 'darwin') {
            await this.cancelDarwinSchedules();
        } else if (platform === 'linux') {
            await this.execSudo('/sbin/shutdown -c').catch((err: Error) => {
                console.warn('[ShutdownService] shutdown -c failed:', err.message);
            });
        } else if (platform === 'win32') {
            await this.execSudo('shutdown /a').catch((err: Error) => {
                console.warn('[ShutdownService] shutdown /a failed:', err.message);
            });
        }

        return true;
    }

    /**
     * Executes immediate shutdown on macOS using AppleScript (no sudo/password required)
     * with a fallback to /sbin/shutdown -h now if requested or if AppleScript fails.
     */
    async shutdownDarwinImmediately(): Promise<void> {
        console.log('[ShutdownService] Triggering immediate macOS shutdown...');

        // Try AppleScript first (silent, passwordless, user-friendly)
        try {
            await this.execCommand("osascript -e 'tell application \"System Events\" to shut down'");
            console.log('[ShutdownService] AppleScript shutdown command sent successfully.');
            return;
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.warn('[ShutdownService] AppleScript shutdown failed, trying fallback:', message);
        }

        // Fallback to sudo shutdown if AppleScript fails
        await this.execSudo('/sbin/shutdown -h now');
    }

    private execCommand(command: string): Promise<void> {
        return new Promise((resolve, reject) => {
            exec(command, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }

    /**
     * Forces shutdown immediately.
     */
    async forceShutdown(): Promise<boolean> {
        const platform = process.platform;

        if (platform === 'darwin') {
            await this.shutdownDarwinImmediately();
            return true;
        }

        let command = '';
        if (platform === 'linux') {
            command = '/sbin/shutdown -h now';
        } else if (platform === 'win32') {
            command = 'shutdown /s /f /t 0';
        } else {
            throw new Error(`Unsupported platform: ${platform}`);
        }

        console.log(`[ShutdownService] Force shutdown: ${command}`);
        await this.execSudo(command);
        return true;
    }

    async rescheduleShutdown(seconds: number): Promise<boolean> {
        if (this.getStatus()) {
            await this.cancelShutdown();
        }
        return this.scheduleShutdown(seconds);
    }

    getStatus(): boolean {
        return fs.existsSync(this.flagPath);
    }

    getMeta(): ShutdownMeta | null {
        try {
            if (fs.existsSync(this.metaPath)) {
                const content = fs.readFileSync(this.metaPath, 'utf8');
                return JSON.parse(content) as ShutdownMeta;
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.error('[ShutdownService] Error reading metadata:', message);
        }
        return null;
    }

    private writeControlFiles(sessionId: string, endAt: number, totalSeconds: number): void {
        const dir = path.dirname(this.flagPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(this.flagPath, sessionId);
        const meta: ShutdownMeta = { sessionId, endAt, totalSeconds };
        fs.writeFileSync(this.metaPath, JSON.stringify(meta));
        console.log(`[ShutdownService] Control files created (session=${sessionId}, endAt=${endAt})`);
    }

    private formatPmsetScheduleDate(endAtMs: number): string {
        const d = new Date(endAtMs);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        const HH = String(d.getHours()).padStart(2, '0');
        const MM = String(d.getMinutes()).padStart(2, '0');
        const SS = String(d.getSeconds()).padStart(2, '0');
        return `${mm}/${dd}/${yy} ${HH}:${MM}:${SS}`;
    }

    private async scheduleDarwinShutdown(endAtMs: number): Promise<void> {
        const pmsetDate = this.formatPmsetScheduleDate(endAtMs);
        // Keeps current behavior, but this also clears other system power schedules.
        const command = `/usr/bin/pmset schedule cancelall ; /usr/bin/pmset schedule shutdown "${pmsetDate}"`;
        console.log(`[ShutdownService] pmset schedule (unified): ${command} (endAt=${endAtMs})`);
        await this.execSudo(command);
    }

    private async cancelDarwinSchedules(): Promise<void> {
        await this.execSudo('/usr/bin/pmset schedule cancelall').catch((err: Error) => {
            console.warn('[ShutdownService] pmset cancelall:', err.message);
        });
    }

    private execSudo(command: string): Promise<void> {
        return new Promise((resolve, reject) => {
            sudo.exec(command, this.options, (error: unknown) => {
                if (error) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : typeof error === 'object' && error !== null && 'message' in error
                              ? String((error as { message: unknown }).message)
                              : String(error);
                    reject(new Error(message));
                    return;
                }
                resolve();
            });
        });
    }

    clearControlFiles(): void {
        try {
            if (fs.existsSync(this.flagPath)) {
                fs.unlinkSync(this.flagPath);
            }
            if (fs.existsSync(this.metaPath)) {
                fs.unlinkSync(this.metaPath);
            }
            console.log('[ShutdownService] Control files cleared locally (no sudo).');
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.error('[ShutdownService] Error clearing control files:', message);
        }
    }

    private clearControlFilesSync(sessionId: string): void {
        try {
            if (fs.existsSync(this.flagPath)) {
                const currentSession = fs.readFileSync(this.flagPath, 'utf8').trim();
                if (currentSession === sessionId) {
                    fs.unlinkSync(this.flagPath);
                }
            }
            if (fs.existsSync(this.metaPath)) {
                const content = fs.readFileSync(this.metaPath, 'utf8');
                const meta = JSON.parse(content) as ShutdownMeta;
                if (meta.sessionId === sessionId) {
                    fs.unlinkSync(this.metaPath);
                }
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.error('[ShutdownService] Error clearing control files:', message);
        }
    }
}
