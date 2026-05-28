// @ts-ignore
import * as sudo from 'sudo-prompt';

export class ShutdownService {
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

            // Criamos a flag para todas as plataformas para ter um state source of truth
            const path = require('path');
            const dir = path.dirname(this.flagPath);
            try {
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                fs.writeFileSync(this.flagPath, sessionId);
                console.log(`[ShutdownService] Flag (${sessionId}) criada em: ${this.flagPath}`);
            } catch (e: any) {
                return reject(new Error(`Falha ao criar flag file: ${e.message}`));
            }

            let command = '';
            if (platform === 'darwin' || platform === 'linux') {
                // Cria um script shell temporário para lidar com o sleep e a lógica de desligamento
                const scriptPath = path.join(dir, 'shutdown_script.sh');
                const scriptContent = `#!/bin/bash
sleep ${seconds}
if [ -f "${this.flagPath}" ] && [ "$(cat "${this.flagPath}")" = "${sessionId}" ]; then
    # 1. Limpa a flag PRIMEIRO
    rm -f "${this.flagPath}"
    
    # 2. Lógica de desligamento
    if [ "$(uname)" = "Darwin" ]; then
        # Ignora sinais de encerramento para garantir que o script não seja morto pelo shutdown em andamento
        trap '' SIGTERM SIGHUP SIGINT
        
        # Tenta o desligamento gracioso (fecha os apps visivelmente)
        GUI_USER=$(stat -f '%Su' /dev/console)
        sudo -u $GUI_USER osascript -e 'tell app "System Events" to shut down'
        
        # Aguarda 10 segundos. Se um app bloquear com aviso de "salvar", 
        # o script continua e força o desligamento para garantir a ação.
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

                command = `"${scriptPath}" > /dev/null 2>&1 &`;
            } else if (platform === 'win32') {
                // No Windows, shutdown /s já é o padrão. Para limpar a flag, precisaríamos 
                // criar um script bat similar ou deixar que o usuário limpe manualmente/no boot.
                // Como o foco é macOS, vamos manter o comando padrão do windows.
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
        const fs = require('fs');

        console.log('[ShutdownService] Tentando cancelar shutdown. Verificando flag:', this.flagPath);
        try {
            if (fs.existsSync(this.flagPath)) {
                fs.unlinkSync(this.flagPath);
                console.log('[ShutdownService] Flag de shutdown removida. O processo de fundo será ignorado.');
            } else {
                console.log('[ShutdownService] Nenhuma flag de shutdown encontrada.');
            }
        } catch (e: any) {
            console.warn('[ShutdownService] Erro ao remover flag:', e.message);
        }

        if (platform === 'darwin' || platform === 'linux') {
            // Como agora usamos um script de bash com sleep em background que apenas checa a flag,
            // ao deletar a flag acima, o script automaticamente não fará nada ao terminar o sleep.
            // Executar `sudo /sbin/shutdown -c` não é mais necessário e causa prompt de "Password:" no console.
            console.log('[ShutdownService] Cancelamento concluído para macOS/Linux (flag baseada).');
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
        if (this.getStatus()) {
            await this.cancelShutdown();
        }
        return this.scheduleShutdown(seconds);
    }

    getStatus(): boolean {
        const fs = require('fs');
        return fs.existsSync(this.flagPath);
    }
}
