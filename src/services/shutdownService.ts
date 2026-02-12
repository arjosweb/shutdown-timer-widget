// @ts-ignore
import * as sudo from 'sudo-prompt';

export class ShutdownService {
    private shutdownPid: number | null = null;
    private readonly flagPath: string;
    private readonly options = {
        name: 'Shutdown Timer',
    };

    constructor(userDataPath: string) {
        const path = require('path');
        this.flagPath = path.join(userDataPath, '.shutdown_timer_active');
    }

    /**
     * Agenda o desligamento baseado na plataforma.
     */
    async scheduleShutdown(seconds: number): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const platform = process.platform;
            const fs = require('fs');

            // Geramos um ID único para esta sessão de desligamento.
            // Isso evita que um timer antigo (esquecido) execute um desligamento 
            // se o usuário iniciou um novo timer recentemente.
            const sessionId = Date.now().toString();

            if (platform === 'darwin' || platform === 'linux') {
                try {
                    fs.writeFileSync(this.flagPath, sessionId);
                    console.log(`[ShutdownService] Flag (${sessionId}) criada em: ${this.flagPath}`);
                } catch (e: any) {
                    return reject(new Error(`Falha ao criar flag file: ${e.message}`));
                }
            }

            let command = '';
            if (platform === 'darwin' || platform === 'linux') {
                // Comando Ultra-Seguro:
                // 1. Espera o tempo.
                // 2. Verifica se o arquivo existe.
                // 3. Verifica se o conteúdo do arquivo ainda é o mesmo ID desta sessão.
                // 4. Só desliga se tudo bater.
                command = `/bin/sh -c "(/bin/sleep ${seconds} && if [ -f '${this.flagPath}' ] && [ \"\$(cat '${this.flagPath}')\" = \"${sessionId}\" ]; then /sbin/shutdown -h now; fi) > /dev/null 2>&1 &"`;
            } else if (platform === 'win32') {
                command = `shutdown /s /t ${seconds}`;
            } else {
                return reject(new Error(`Plataforma não suportada: ${platform}`));
            }

            console.log(`[ShutdownService] Executando comando (${platform}): ${command}`);

            sudo.exec(command, this.options, (error) => {
                if (error) {
                    console.error('[ShutdownService] ERRO sudo.exec:', error);
                    if (fs.existsSync(this.flagPath)) {
                        const currentSession = fs.readFileSync(this.flagPath, 'utf8');
                        if (currentSession === sessionId) fs.unlinkSync(this.flagPath);
                    }
                    this.shutdownPid = null;
                    reject(new Error(error.message || error.toString()));
                    return;
                }

                this.shutdownPid = 9999;
                resolve(true);
            });
        });
    }

    /**
     * Cancela o desligamento agendado.
     */
    async cancelShutdown(): Promise<boolean> {
        const platform = process.platform;
        const fs = require('fs');

        // No macOS/Linux, deletar a flag é suficiente e SEGURO.
        // O processo em background vai acordar, ver que a flag sumiu (ou mudou o ID) e morrer sozinho.
        // VANTAGEM: Não precisa de sudo, não pede senha, não interfere em outros processos do sistema.
        if (platform === 'darwin' || platform === 'linux') {
            try {
                if (fs.existsSync(this.flagPath)) {
                    fs.unlinkSync(this.flagPath);
                    console.log('[ShutdownService] Flag de shutdown removida. O processo de fundo será ignorado.');
                }
            } catch (e: any) {
                console.warn('[ShutdownService] Erro ao remover flag:', e.message);
            }
        }

        if (platform === 'win32') {
            return new Promise((resolve) => {
                sudo.exec('shutdown /a', this.options, () => {
                    this.shutdownPid = null;
                    resolve(true);
                });
            });
        }

        this.shutdownPid = null;
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

            sudo.exec(command, this.options, (error) => {
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
        if (this.shutdownPid) {
            await this.cancelShutdown();
        }
        return this.scheduleShutdown(seconds);
    }

    getStatus(): boolean {
        return this.shutdownPid !== null;
    }
}
