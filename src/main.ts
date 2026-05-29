import { app, BrowserWindow, ipcMain, Notification, dialog, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import { TimerManager } from './services/timerManager';
import { ShutdownService } from './services/shutdownService';

let mainWindow: BrowserWindow | null = null;
let timer: TimerManager;
let shutdownService: ShutdownService;
let tray: Tray | null = null;
let isQuitting = false;
let currentLanguage = 'pt-BR';

const mainTranslations: Record<string, Record<string, any>> = {
    'pt-BR': {
        trayShow: 'Mostrar',
        trayCancel: 'Cancelar Desligamento',
        trayQuit: 'Sair',
        trayTooltipPrefix: 'Desligamento em',
        trayTooltipDefault: 'Shutdown Timer',
        notificationTitle: 'Shutdown Timer',
        notificationBody: 'O computador será desligado em {seconds} segundos!',
        dialogCloseTitle: 'Timer em andamento',
        dialogCloseMessage: 'Um desligamento está agendado. O que deseja fazer?',
        dialogCloseDetail: 'Se você sair, o desligamento será cancelado.',
        dialogCloseButtons: ['Minimizar', 'Parar Timer e Sair'],
        dialogPendingTitle: 'Desligamento Pendente',
        dialogPendingMessage: 'Um desligamento foi agendado em uma sessão anterior. O que deseja fazer?',
        dialogPendingButtons: ['Manter Agendamento', 'Cancelar Desligamento'],
        errorMinTime: 'O tempo mínimo é de 10 segundos.'
    },
    'en': {
        trayShow: 'Show',
        trayCancel: 'Cancel Shutdown',
        trayQuit: 'Quit',
        trayTooltipPrefix: 'Shutdown in',
        trayTooltipDefault: 'Shutdown Timer',
        notificationTitle: 'Shutdown Timer',
        notificationBody: 'The computer will be turned off in {seconds} seconds!',
        dialogCloseTitle: 'Timer in progress',
        dialogCloseMessage: 'A shutdown is scheduled. What do you want to do?',
        dialogCloseDetail: 'If you quit, the shutdown will be canceled.',
        dialogCloseButtons: ['Minimize', 'Stop Timer and Quit'],
        dialogPendingTitle: 'Pending Shutdown',
        dialogPendingMessage: 'A shutdown was scheduled in a previous session. What do you want to do?',
        dialogPendingButtons: ['Keep Scheduled', 'Cancel Shutdown'],
        errorMinTime: 'The minimum time is 10 seconds.'
    },
    'es': {
        trayShow: 'Mostrar',
        trayCancel: 'Cancelar Apagado',
        trayQuit: 'Salir',
        trayTooltipPrefix: 'Apagado en',
        trayTooltipDefault: 'Shutdown Timer',
        notificationTitle: 'Shutdown Timer',
        notificationBody: '¡La computadora se apagará en {seconds} segundos!',
        dialogCloseTitle: 'Temporizador en curso',
        dialogCloseMessage: 'Se ha programado un apagado. ¿Qué desea hacer?',
        dialogCloseDetail: 'Si sale, se cancelará el apagado.',
        dialogCloseButtons: ['Minimizar', 'Detener Temporizador y Salir'],
        dialogPendingTitle: 'Apagado Pendiente',
        dialogPendingMessage: 'Se programó un apagado en una sesión anterior. ¿Qué desea hacer?',
        dialogPendingButtons: ['Mantener Programación', 'Cancelar Apagado'],
        errorMinTime: 'El tiempo mínimo es de 10 segundos.'
    }
};

function createTray() {
    if (tray) return;
    
    let iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
    let icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
        iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');
        icon = nativeImage.createFromPath(iconPath);
    }
    if (icon.isEmpty()) {
        icon = nativeImage.createEmpty();
    } else {
        // Redimensionar ícone para não ficar gigante na barra superior (macOS/Windows)
        icon = icon.resize({ width: 16, height: 16 });
    }
    
    tray = new Tray(icon);
    
    updateTrayMenu();
    updateTrayTooltip(timer ? timer.getState().remainingSeconds : 0);
    
    tray.on('click', () => {
        mainWindow?.show();
        mainWindow?.restore();
        if (tray) { tray.destroy(); tray = null; }
    });
}

function updateTrayMenu() {
    if (!tray || tray.isDestroyed()) return;

    const t = mainTranslations[currentLanguage] || mainTranslations['pt-BR'];
    const contextMenu = Menu.buildFromTemplate([
        { label: t.trayShow, click: () => {
            mainWindow?.show();
            mainWindow?.restore();
            if (tray) { tray.destroy(); tray = null; }
        }},
        { label: t.trayCancel, click: async () => {
            if (timer.getState().state === 'running') {
                timer.stop();
            }
            await shutdownService.cancelShutdown();
        }},
        { type: 'separator' },
        { label: t.trayQuit, click: () => app.quit() }
    ]);

    tray.setContextMenu(contextMenu);
}

function updateTrayTooltip(seconds: number) {
    if (tray && !tray.isDestroyed()) {
        const t = mainTranslations[currentLanguage] || mainTranslations['pt-BR'];
        if (seconds > 0) {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            tray.setToolTip(`${t.trayTooltipPrefix} ${h}h ${m}m ${s}s`);
        } else {
            tray.setToolTip(t.trayTooltipDefault);
        }
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 380,
        height: 580,
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

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    // Workaround for movable frameless window
    mainWindow.setMovable(true);
    // Force hide traffic lights on macOS
    if (process.platform === 'darwin') {
        mainWindow.setWindowButtonVisibility(false);
    }

    mainWindow.on('close', (e) => {
        if (isQuitting) return;

        if (timer && timer.getState().state === 'running') {
            const t = mainTranslations[currentLanguage] || mainTranslations['pt-BR'];
            const choice = dialog.showMessageBoxSync(mainWindow!, {
                type: 'question',
                buttons: t.dialogCloseButtons,
                title: t.dialogCloseTitle,
                message: t.dialogCloseMessage,
                detail: t.dialogCloseDetail,
                defaultId: 0,
                cancelId: 0, // Esc ou fechar janela = Minimizar
            });

            if (choice === 0) {
                // Minimizar
                e.preventDefault();
                mainWindow?.minimize();
            } else {
                // Parar Timer e Sair
            }
        }
    });

    mainWindow.on('minimize', () => {
        createTray();
        mainWindow?.hide();
    });

    mainWindow.on('restore', () => {
        if (tray && !tray.isDestroyed()) {
            tray.destroy();
            tray = null;
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function setupTimerEvents() {
    timer.on('tick', (seconds: number) => {
        updateTrayTooltip(seconds);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('timer-tick', seconds);
        }

        // Notificação nos últimos 30 segundos (ou no início se o total configurado for menor que 30s)
        const shouldNotify = seconds > 0 && (
            (timer.totalSeconds >= 30 && seconds === 30) ||
            (timer.totalSeconds < 30 && seconds === timer.totalSeconds)
        );
        if (shouldNotify) {
            const t = mainTranslations[currentLanguage] || mainTranslations['pt-BR'];
            const notificationBody = t.notificationBody.replace('{seconds}', String(seconds));
            new Notification({
                title: t.notificationTitle,
                body: notificationBody,
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
        const t = mainTranslations[currentLanguage] || mainTranslations['pt-BR'];
        if (seconds < 10) {
            return { success: false, error: t.errorMinTime };
        }
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
            timer.stop();
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
        if (mainWindow) {
            mainWindow.close();
        }
    });

    ipcMain.on('set-language', (_event, lang: string) => {
        if (mainTranslations[lang]) {
            currentLanguage = lang;
            updateTrayMenu();
            if (timer) {
                updateTrayTooltip(timer.getState().remainingSeconds);
            }
        }
    });
}

// Suprimir erros de parse de certificado do Chromium no macOS
app.commandLine.appendSwitch('log-level', '3');

// ── App Lifecycle ─────────────────────────────
app.whenReady().then(async () => {
    timer = new TimerManager();
    shutdownService = new ShutdownService(app.getPath('userData'));

    if (shutdownService.getStatus()) {
        const t = mainTranslations[currentLanguage] || mainTranslations['pt-BR'];
        const choice = dialog.showMessageBoxSync({
            type: 'question',
            buttons: t.dialogPendingButtons,
            title: t.dialogPendingTitle,
            message: t.dialogPendingMessage,
            defaultId: 0,
            cancelId: 0
        });

        if (choice === 1) {
            await shutdownService.cancelShutdown();
        }
    }

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
    isQuitting = true;
    if (timer && timer.getState().state === 'running') {
        timer.stop();
        try {
            await shutdownService.cancelShutdown();
        } catch (e: any) {
            console.error('Erro ao limpar shutdown:', e.message);
        }
    }
});

