import { app, BrowserWindow, ipcMain, Notification, dialog } from 'electron';
import * as path from 'path';
import { TimerManager } from './services/timerManager';
import { ShutdownService } from './services/shutdownService';

let mainWindow: BrowserWindow | null = null;
let timer: TimerManager;
let shutdownService: ShutdownService;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 380,
        height: 540,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        hasShadow: false,
        vibrancy: 'under-window',
        visualEffectState: 'active',
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: -100, y: -100 },
        skipTaskbar: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Load from the same folder structure (dist/renderer/index.html will be needed or dist/../renderer/index.html)
    // Since we compile to dist, __dirname is dist.
    // We will keep renderer in 'renderer' at root, so path is ../renderer/index.html
    // OR we copy renderer to dist. Let's assume we copy renderer to dist.
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    // Workaround for movable frameless window
    mainWindow.setMovable(true);
    // Force hide traffic lights on macOS
    if (process.platform === 'darwin') {
        mainWindow.setWindowButtonVisibility(false);
    }

    mainWindow.on('close', (e) => {
        if (timer && timer.getState().state === 'running') {
            const choice = dialog.showMessageBoxSync(mainWindow!, {
                type: 'question',
                buttons: ['Minimizar', 'Parar Timer e Sair'],
                title: 'Timer em andamento',
                message: 'Um shutdown está agendado. O que deseja fazer?',
                detail: 'Se você sair, o shutdown será cancelado.',
                defaultId: 0,
                cancelId: 0, // Esc ou fechar janela = Minimizar
            });

            if (choice === 0) {
                // Minimizar
                e.preventDefault();
                mainWindow?.minimize();
            } else {
                // Parar Timer e Sair
                // O evento 'close' prossegue, 'closed' é chamado, depois 'window-all-closed',
                // e 'before-quit' fará a limpeza (cancelShutdown).
            }
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function setupTimerEvents() {
    timer.on('tick', (seconds: number) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('timer-tick', seconds);
        }

        // Notificação nos últimos 30 segundos
        if (seconds === 30) {
            new Notification({
                title: 'Shutdown Timer',
                body: 'O computador será desligado em 30 segundos!',
                urgency: 'critical',
            }).show();
        }
    });

    timer.on('state-change', (state: string) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('timer-state-change', state);
        }
    });

    timer.on('complete', async () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('timer-complete');
        }
        console.log('[Main] Timer visual completo. O sistema deve desligar em breve via agendamento (screen/shutdown).');
    });
}

function setupIPCHandlers() {
    ipcMain.handle('start-timer', async (_event, seconds: number) => {
        try {
            await shutdownService.scheduleShutdown(seconds);
            timer.start(seconds);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('stop-timer', async () => {
        try {
            // Paramos o timer visual IMEDIATAMENTE para a UI responder rápido.
            timer.stop();
            // O cancelamento real (deletar flag) acontece em background.
            await shutdownService.cancelShutdown();
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('restart-timer', async () => {
        try {
            const totalSeconds = timer.totalSeconds;
            if (totalSeconds > 0) {
                await shutdownService.rescheduleShutdown(totalSeconds);
                timer.restart();
            }
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('force-shutdown', async () => {
        try {
            timer.stop();
            await shutdownService.forceShutdown();
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.on('minimize-window', () => {
        if (mainWindow) {
            mainWindow.minimize();
        }
    });

    ipcMain.on('close-window', async () => {
        // A lógica de confirmação e cancelamento agora reside no evento 'close' da janela e 'before-quit'.
        if (mainWindow) {
            mainWindow.close();
        }
    });
}

// ── App Lifecycle ─────────────────────────────
app.whenReady().then(() => {
    timer = new TimerManager();
    shutdownService = new ShutdownService(app.getPath('userData'));

    setupTimerEvents();
    setupIPCHandlers();
    createWindow();
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', async () => {
    if (timer && timer.getState().state === 'running') {
        timer.stop();
        try {
            await shutdownService.cancelShutdown();
        } catch (e: any) {
            console.error('Erro ao limpar shutdown:', e.message);
        }
    }
});
