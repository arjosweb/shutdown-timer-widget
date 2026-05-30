import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('timerAPI', {
    startTimer: (seconds: number) => ipcRenderer.invoke('start-timer', seconds),
    stopTimer: () => ipcRenderer.invoke('stop-timer'),
    restartTimer: () => ipcRenderer.invoke('restart-timer'),
    getTimerState: () => ipcRenderer.invoke('get-timer-state'),

    forceShutdown: () => ipcRenderer.invoke('force-shutdown'),
    tryCloseWindow: () => ipcRenderer.invoke('try-close-window'),

    minimizeWindow: () => ipcRenderer.send('minimize-window'),

    onTick: (callback: (seconds: number) => void) => {
        ipcRenderer.on('timer-tick', (_event: IpcRendererEvent, seconds: number) => callback(seconds));
    },
    onStateChange: (callback: (state: string) => void) => {
        ipcRenderer.on('timer-state-change', (_event: IpcRendererEvent, state: string) => callback(state));
    },
    onComplete: (callback: () => void) => {
        ipcRenderer.on('timer-complete', () => callback());
    },
    onError: (callback: (message: string) => void) => {
        ipcRenderer.on('timer-error', (_event: IpcRendererEvent, message: string) => callback(message));
    },
    onForceShutdownPending: (callback: () => void) => {
        ipcRenderer.on('force-shutdown-pending', () => callback());
    },

    removeAllListeners: () => {
        ipcRenderer.removeAllListeners('timer-tick');
        ipcRenderer.removeAllListeners('timer-state-change');
        ipcRenderer.removeAllListeners('timer-complete');
        ipcRenderer.removeAllListeners('timer-error');
        ipcRenderer.removeAllListeners('force-shutdown-pending');
    },

    setLanguage: (lang: string) => ipcRenderer.send('set-language', lang),
});
