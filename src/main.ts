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

const FORCE_SHUTDOWN_DELAY_MS = 5000;

const mainTranslations: Record<string, Record<string, string | string[]>> = {
    'pt-BR': {
        trayShow: 'Mostrar',
        trayCancel: 'Cancelar Desligamento',
        trayQuit: 'Sair',
        trayTooltipPrefix: 'Desligamento em',
        trayTooltipDefault: 'Shutdown Timer',
        notificationTitle: 'Shutdown Timer',
        notificationBody: 'O computador será desligado em {seconds} segundos!',
        dialogQuitWhileTimerTitle: 'Cancelar desligamento',
        dialogQuitWhileTimerMessage:
            'Se você fechar a aplicação, o desligamento será cancelado. Prosseguir?',
        dialogQuitWhileTimerButtons: ['Prosseguir', 'Não fechar'],
        dialogPendingTitle: 'Desligamento Pendente',
        dialogPendingMessage: 'Um desligamento foi agendado em uma sessão anterior. O que deseja fazer?',
        dialogPendingButtons: ['Manter Agendamento', 'Cancelar Desligamento'],
        errorMinTime: 'O tempo mínimo é de 10 segundos.',
    },
    en: {
        trayShow: 'Show',
        trayCancel: 'Cancel Shutdown',
        trayQuit: 'Quit',
        trayTooltipPrefix: 'Shutdown in',
        trayTooltipDefault: 'Shutdown Timer',
        notificationTitle: 'Shutdown Timer',
        notificationBody: 'The computer will be turned off in {seconds} seconds!',
        dialogQuitWhileTimerTitle: 'Cancel shutdown',
        dialogQuitWhileTimerMessage:
            'If you close the application, the scheduled shutdown will be cancelled. Proceed?',
        dialogQuitWhileTimerButtons: ['Proceed', 'Do not close'],
        dialogPendingTitle: 'Pending Shutdown',
        dialogPendingMessage: 'A shutdown was scheduled in a previous session. What do you want to do?',
        dialogPendingButtons: ['Keep Scheduled', 'Cancel Shutdown'],
        errorMinTime: 'The minimum time is 10 seconds.',
    },
    es: {
        trayShow: 'Mostrar',
        trayCancel: 'Cancelar Apagado',
        trayQuit: 'Salir',
        trayTooltipPrefix: 'Apagado en',
        trayTooltipDefault: 'Shutdown Timer',
        notificationTitle: 'Shutdown Timer',
        notificationBody: '¡La computadora se apagará en {seconds} segundos!',
        dialogQuitWhileTimerTitle: 'Cancelar apagado',
        dialogQuitWhileTimerMessage:
            'Si cierra la aplicación, se cancelará el apagado programado. ¿Continuar?',
        dialogQuitWhileTimerButtons: ['Continuar', 'No cerrar'],
        dialogPendingTitle: 'Apagado Pendiente',
        dialogPendingMessage: 'Se programó un apagado en una sesión anterior. ¿Qué desea hacer?',
        dialogPendingButtons: ['Mantener Programación', 'Cancelar Apagado'],
        errorMinTime: 'El tiempo mínimo es de 10 segundos.',
    },
};

function getTranslations() {
    return mainTranslations[currentLanguage] || mainTranslations['pt-BR'];
}

function loadTrayIcon(): Electron.NativeImage {
    const candidatePaths = [
        path.join(__dirname, '..', 'assets', 'icon.png'),
        path.join(__dirname, '..', '..', 'assets', 'icon.png'),
        path.join(process.resourcesPath, 'assets', 'icon.png'),
    ];

    for (const candidatePath of candidatePaths) {
        const icon = nativeImage.createFromPath(candidatePath);
        if (!icon.isEmpty()) {
            return icon.resize({ width: 16, height: 16 });
        }
    }

    console.error('[Main] Tray icon not found. Paths tried:', candidatePaths);
    return nativeImage.createEmpty();
}

function ensureTray(): void {
    if (tray && !tray.isDestroyed()) {
        return;
    }

    const icon = loadTrayIcon();
    tray = new Tray(icon);
    updateTrayMenu();
    updateTrayTooltip(timer ? timer.getState().remainingSeconds : 0);

    tray.on('click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.restore();
            mainWindow.focus();
        }
    });
}

function destroyTray(): void {
    if (tray && !tray.isDestroyed()) {
        tray.destroy();
    }
    tray = null;
}

function updateTrayMenu(): void {
    if (!tray || tray.isDestroyed()) return;

    const t = getTranslations();
    const contextMenu = Menu.buildFromTemplate([
        {
            label: t.trayShow as string,
            click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.show();
                    mainWindow.restore();
                    mainWindow.focus();
                }
            },
        },
        {
            label: t.trayCancel as string,
            click: async () => {
                if (timer.getState().state === 'running') {
                    timer.stop();
                }
                await shutdownService.cancelShutdown();
            },
        },
        { type: 'separator' },
        {
            label: t.trayQuit as string,
            click: async () => {
                const outcome = await handleUserCloseRequest(true);
                if (outcome === 'quit') {
                    app.quit();
                }
            },
        },
    ]);

    tray.setContextMenu(contextMenu);
}

function updateTrayTooltip(seconds: number): void {
    if (!tray || tray.isDestroyed()) return;

    const t = getTranslations();
    if (seconds > 0) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        tray.setToolTip(`${t.trayTooltipPrefix} ${h}h ${m}m ${s}s`);
    } else {
        tray.setToolTip(t.trayTooltipDefault as string);
    }
}

type CloseRequestOutcome = 'blocked' | 'quit' | 'hidden';

async function handleUserCloseRequest(forceQuit = false): Promise<CloseRequestOutcome> {
    if (!timer || timer.getState().state !== 'running') {
        if (process.platform === 'darwin' && !forceQuit) {
            mainWindow?.hide();
            ensureTray();
            return 'hidden';
        }
        isQuitting = true;
        return 'quit';
    }

    const t = getTranslations();
    const buttons = t.dialogQuitWhileTimerButtons as string[];
    const dialogOptions = {
        type: 'warning' as const,
        buttons,
        defaultId: 1,
        cancelId: 1,
        title: t.dialogQuitWhileTimerTitle as string,
        message: t.dialogQuitWhileTimerMessage as string,
    };
    const parent =
        mainWindow && !mainWindow.isDestroyed() ? mainWindow : BrowserWindow.getFocusedWindow();
    const choice = parent
        ? dialog.showMessageBoxSync(parent, dialogOptions)
        : dialog.showMessageBoxSync(dialogOptions);

    if (choice === 0) {
        timer.stop();
        try {
            await shutdownService.cancelShutdown();
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.error('[Main] Failed to cancel shutdown on quit:', message);
        }
        isQuitting = true;
        return 'quit';
    }

    return 'blocked';
}

function createWindow(): void {
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

    mainWindow.setMovable(true);
    if (process.platform === 'darwin') {
        mainWindow.setWindowButtonVisibility(false);
    }

    mainWindow.on('close', (e) => {
        if (isQuitting) return;

        e.preventDefault();
        void (async () => {
            const outcome = await handleUserCloseRequest();
            if (outcome === 'quit') {
                mainWindow?.destroy();
                app.quit();
            }
        })();
    });

    mainWindow.on('minimize', () => {
        ensureTray();
        mainWindow?.hide();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function setupTimerEvents(): void {
    timer.on('tick', (seconds: number) => {
        updateTrayTooltip(seconds);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('timer-tick', seconds);
        }

        const shouldNotify =
            seconds > 0 &&
            ((timer.totalSeconds >= 30 && seconds === 30) ||
                (timer.totalSeconds < 30 && seconds === timer.totalSeconds));

        if (shouldNotify) {
            const t = getTranslations();
            const notificationBody = (t.notificationBody as string).replace('{seconds}', String(seconds));
            new Notification({
                title: t.notificationTitle as string,
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
        try {
            console.log('[Main] Timer complete. Executing immediate shutdown...');
            if (process.platform === 'darwin') {
                await shutdownService.shutdownDarwinImmediately();
            } else {
                await shutdownService.forceShutdown(0);
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[Main] Failed to execute shutdown on complete:', message);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('timer-error', message);
            }
        }
    });
}

function setupIPCHandlers(): void {
    ipcMain.handle('start-timer', async (_event, seconds: number) => {
        const t = getTranslations();
        if (seconds < 10) {
            return { success: false, error: t.errorMinTime };
        }
        try {
            await shutdownService.scheduleShutdown(seconds);
            timer.start(seconds);
            return { success: true };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message };
        }
    });

    ipcMain.handle('stop-timer', async () => {
        try {
            timer.stop();
            await shutdownService.cancelShutdown();
            return { success: true };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message };
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
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message };
        }
    });

    ipcMain.handle('force-shutdown', async () => {
        try {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('force-shutdown-pending');
            }
            await new Promise((resolve) => setTimeout(resolve, FORCE_SHUTDOWN_DELAY_MS));
            timer.stop();
            await shutdownService.forceShutdown(2000);
            return { success: true };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message };
        }
    });

    ipcMain.handle('get-timer-state', async () => {
        return timer ? timer.getState() : { state: 'idle', remainingSeconds: 0, totalSeconds: 0 };
    });

    ipcMain.handle('try-close-window', async () => {
        const outcome = await handleUserCloseRequest(false);
        if (outcome === 'quit') {
            mainWindow?.destroy();
            app.quit();
        }
        return { outcome };
    });

    ipcMain.on('minimize-window', () => {
        mainWindow?.minimize();
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

app.commandLine.appendSwitch('log-level', '3');

app.whenReady().then(async () => {
    timer = new TimerManager();
    shutdownService = new ShutdownService(app.getPath('userData'));

    const sysLocale = app.getLocale();
    if (sysLocale.startsWith('es')) {
        currentLanguage = 'es';
    } else if (sysLocale.startsWith('en')) {
        currentLanguage = 'en';
    } else {
        currentLanguage = 'pt-BR';
    }

    const meta = shutdownService.getMeta();
    if (meta) {
        const remainingSeconds = Math.round((meta.endAt - Date.now()) / 1000);
        if (remainingSeconds > 10) {
            const t = getTranslations();
            const choice = dialog.showMessageBoxSync({
                type: 'question',
                buttons: t.dialogPendingButtons as string[],
                title: t.dialogPendingTitle as string,
                message: t.dialogPendingMessage as string,
                defaultId: 0,
                cancelId: 0,
            });

            if (choice === 0) {
                const actualRemaining = Math.round((meta.endAt - Date.now()) / 1000);
                if (actualRemaining > 10) {
                    try {
                        await shutdownService.rescheduleShutdown(actualRemaining);
                        timer.start(actualRemaining);
                    } catch (error: unknown) {
                        const message = error instanceof Error ? error.message : String(error);
                        console.error('[Main] Failed to reschedule timer:', message);
                    }
                } else {
                    shutdownService.clearControlFiles();
                }
            } else {
                await shutdownService.cancelShutdown();
            }
        } else {
            shutdownService.clearControlFiles();
        }
    } else if (shutdownService.getStatus()) {
        shutdownService.clearControlFiles();
    }

    setupTimerEvents();
    setupIPCHandlers();

    if (process.platform === 'darwin') {
        ensureTray();
    }

    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    } else if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.restore();
    }
});

app.on('before-quit', (e) => {
    if (!isQuitting && timer && timer.getState().state === 'running') {
        e.preventDefault();
        void handleUserCloseRequest(true).then((outcome) => {
            if (outcome === 'quit') {
                app.quit();
            }
        });
        return;
    }
    isQuitting = true;
    destroyTray();
});
