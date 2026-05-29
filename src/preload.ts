import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('timerAPI', {
    // Timer controls
    startTimer: (seconds: number) => ipcRenderer.invoke('start-timer', seconds),
    stopTimer: () => ipcRenderer.invoke('stop-timer'),
    restartTimer: () => ipcRenderer.invoke('restart-timer'),

    // System controls
    forceShutdown: () => ipcRenderer.invoke('force-shutdown'),

    // Window controls
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),

    // Listeners
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

    // Remove listeners
    removeAllListeners: () => {
        ipcRenderer.removeAllListeners('timer-tick');
        ipcRenderer.removeAllListeners('timer-state-change');
        ipcRenderer.removeAllListeners('timer-complete');
        ipcRenderer.removeAllListeners('timer-error');
    },

    // Language sync
    setLanguage: (lang: string) => ipcRenderer.send('set-language', lang)
});
