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

                // Escreve a flag simples (ID da sessão)
                fs.writeFileSync(this.flagPath, sessionId);

                // Salva metadados ricos em JSON
                const meta: ShutdownMeta = { sessionId, endAt, totalSeconds: seconds };
                fs.writeFileSync(this.metaPath, JSON.stringify(meta));

                console.log(`[ShutdownService] Flag (${sessionId}) criada em: ${this.flagPath}`);
            } catch (e: any) {
                return reject(new Error(`Falha ao criar arquivos de controle: ${e.message}`));
            }

            let command = '';
            if (platform === 'darwin' || platform === 'linux') {
                const scriptPath = path.join(dir, 'shutdown_script.sh');
                const pidPath = path.join(dir, '.shutdown_timer_pid');
                
                // Script Shell resiliente com caffeinate e loop de monitoramento a cada 5 segundos
                const scriptContent = `#!/bin/bash
# Desacopla do processo pai
trap '' SIGHUP

# Salva o PID do script para permitir encerramento se necessário
echo $$ > "${pidPath}"

# Agenda desligamento no hardware (pmset) para garantir que
# o Mac desligue mesmo que este script falhe ou seja interrompido
SHUTDOWN_DATE=$(date -j -v +${seconds}S +"%m/%d/%y %H:%M:%S")
/usr/sbin/pmset schedule shutdown "\${SHUTDOWN_DATE}" 2>/dev/null

# Inicia o caffeinate para impedir o repouso do sistema durante a contagem
/usr/bin/caffeinate -dis -t ${seconds} &
CAFF_PID=$!

# Função de limpeza executada ao encerrar o script
cleanup() {
    /usr/sbin/pmset schedule cancelall 2>/dev/null
    kill $CAFF_PID >/dev/null 2>&1
    rm -f "${pidPath}"
    rm -f "$0"
}
trap cleanup EXIT INT TERM

# Loop de contagem regressiva monitorada
REMAINING=${seconds}
INTERVAL=5

while [ $REMAINING -gt 0 ]; do
    # Se a flag sumir ou mudar de ID, aborta o desligamento e limpa tudo
    if [ ! -f "${this.flagPath}" ] || [ "$(cat "${this.flagPath}")" != "${sessionId}" ]; then
        exit 0
    fi

    if [ $REMAINING -le $INTERVAL ]; then
        sleep $REMAINING
        REMAINING=0
    else
        sleep $INTERVAL
        REMAINING=$((REMAINING - INTERVAL))
    fi
done

# Verificação final de integridade da sessão antes de desligar
if [ -f "${this.flagPath}" ] && [ "$(cat "${this.flagPath}")" = "${sessionId}" ]; then
    rm -f "${this.flagPath}"
    rm -f "${this.metaPath}"

    if [ "$(uname)" = "Darwin" ]; then
        trap '' SIGTERM SIGHUP SIGINT

        # Cancela o pmset para evitar duplicidade (nós vamos desligar manualmente)
        /usr/sbin/pmset schedule cancelall 2>/dev/null

        # Tentativa de desligamento amigável via GUI
        GUI_USER=$(stat -f '%Su' /dev/console)
        sudo -u $GUI_USER osascript -e 'tell app "System Events" to shut down'

        # Tolerância de 10 segundos antes do desligamento bruto
        sleep 10
        /sbin/shutdown -h now
    else
        /sbin/shutdown -h now
    fi
fi
`;
                try {
                    fs.writeFileSync(scriptPath, scriptContent);
                    fs.chmodSync(scriptPath, '755');
                } catch (e: any) {
                    return reject(new Error(`Falha ao criar script de shutdown: ${e.message}`));
                }

                command = `/usr/bin/nohup "${scriptPath}" > /dev/null 2>&1 &`;
            } else if (platform === 'win32') {
                command = `shutdown /s /t ${seconds}`;
            } else {
                return reject(new Error(`Plataforma não suportada: ${platform}`));
            }

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
