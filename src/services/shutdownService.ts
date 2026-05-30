import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
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
     * Agenda o desligamento baseado na plataforma.
     */
    async scheduleShutdown(seconds: number): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const platform = process.platform;
            const sessionId = Date.now().toString();
            const endAt = Date.now() + (seconds * 1000);

            const dir = path.dirname(this.flagPath);
            try {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                fs.writeFileSync(this.flagPath, sessionId);

                const meta: ShutdownMeta = { sessionId, endAt, totalSeconds: seconds };
                fs.writeFileSync(this.metaPath, JSON.stringify(meta));

                console.log(`[ShutdownService] Flag (${sessionId}) criada em: ${this.flagPath}`);
            } catch (e: any) {
                return reject(new Error(`Falha ao criar arquivos de controle: ${e.message}`));
            }

            if (platform === 'darwin') {
                // Usa pmset schedule como fallback nativo do macOS.
                // O shutdown real é disparado pelo evento 'complete' do TimerManager.
                const shutdownDate = new Date(endAt);
                const mm = String(shutdownDate.getMonth() + 1).padStart(2, '0');
                const dd = String(shutdownDate.getDate()).padStart(2, '0');
                const yy = String(shutdownDate.getFullYear()).slice(-2);
                const HH = String(shutdownDate.getHours()).padStart(2, '0');
                const MM = String(shutdownDate.getMinutes()).padStart(2, '0');
                const SS = String(shutdownDate.getSeconds()).padStart(2, '0');
                const pmsetDate = `${mm}/${dd}/${yy} ${HH}:${MM}:${SS}`;

                const command = `/usr/bin/pmset schedule shutdown "${pmsetDate}"`;
                console.log(`[ShutdownService] Agendando pmset fallback: ${command}`);

                sudo.exec(command, this.options, (error: any) => {
                    if (error) {
                        // pmset falhou (não fatal — o timer do Electron ainda dispara o shutdown)
                        console.warn('[ShutdownService] pmset schedule falhou (não fatal):', error.message || error);
                    }
                    resolve(true);
                });
            } else if (platform === 'win32') {
                const command = `shutdown /s /t ${seconds}`;
                console.log(`[ShutdownService] Executando comando (${platform}): ${command}`);

                sudo.exec(command, this.options, (error: any) => {
                    if (error) {
                        console.error('[ShutdownService] ERRO sudo.exec:', error);
                        this.clearControlFilesSync(sessionId);
                        reject(new Error(error.message || error.toString()));
                        return;
                    }
                    resolve(true);
                });
            } else if (platform === 'linux') {
                const command = `/sbin/shutdown -h +${Math.ceil(seconds / 60)}`;
                console.log(`[ShutdownService] Executando comando (${platform}): ${command}`);

                sudo.exec(command, this.options, (error: any) => {
                    if (error) {
                        console.error('[ShutdownService] ERRO sudo.exec:', error);
                        this.clearControlFilesSync(sessionId);
                        reject(new Error(error.message || error.toString()));
                        return;
                    }
                    resolve(true);
                });
            } else {
                return reject(new Error(`Plataforma não suportada: ${platform}`));
            }
        });
    }

    /**
     * Cancela o desligamento agendado.
     */
    async cancelShutdown(): Promise<boolean> {
        const platform = process.platform;

        console.log('[ShutdownService] Tentando cancelar shutdown. Verificando flag:', this.flagPath);
        try {
            if (fs.existsSync(this.flagPath)) {
                fs.unlinkSync(this.flagPath);
                console.log('[ShutdownService] Flag de shutdown removida.');
            }
            if (fs.existsSync(this.metaPath)) {
                fs.unlinkSync(this.metaPath);
                console.log('[ShutdownService] Metadados de shutdown removidos.');
            }
        } catch (e: any) {
            console.warn('[ShutdownService] Erro ao remover arquivos de controle:', e.message);
        }

        if (platform === 'darwin') {
            return new Promise((resolve) => {
                sudo.exec('/usr/bin/pmset schedule cancelall', this.options, () => {
                    resolve(true);
                });
            });
        }

        if (platform === 'win32') {
            return new Promise((resolve) => {
                sudo.exec('shutdown /a', this.options, () => {
                    resolve(true);
                });
            });
        }

        return true;
    }

    /**
     * Força o desligamento imediato.
     */
    forceShutdown(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            let command = '';
            const platform = process.platform;

            if (platform === 'darwin' || platform === 'linux') {
                command = `/sbin/shutdown -h now`;
            } else if (platform === 'win32') {
                command = `shutdown /s /f /t 0`;
            } else {
                return reject(new Error(`Plataforma não suportada: ${platform}`));
            }

            console.log(`[ShutdownService] Forçando shutdown imediato: ${command}`);

            sudo.exec(command, this.options, (error: any) => {
                if (error) {
                    console.error('[ShutdownService] ERRO ao forçar shutdown:', error);
                    reject(new Error(error.message || error.toString()));
                    return;
                }
                resolve(true);
            });
        });
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
                return JSON.parse(content);
            }
        } catch (e: any) {
            console.error('[ShutdownService] Erro ao ler metadados:', e.message);
        }
        return null;
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
                const meta = JSON.parse(content);
                if (meta.sessionId === sessionId) {
                    fs.unlinkSync(this.metaPath);
                }
            }
        } catch (e: any) {
            console.error('[ShutdownService] Erro ao limpar arquivos de controle de forma síncrona:', e.message);
        }
    }
}
