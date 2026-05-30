// Helper to access window.timerAPI safely without global augmentation

interface TimerAPI {
    startTimer: (seconds: number) => Promise<{ success: boolean; error?: string }>;
    stopTimer: () => Promise<{ success: boolean; error?: string }>;
    restartTimer: () => Promise<{ success: boolean; error?: string }>;
    getTimerState: () => Promise<{ state: string; remainingSeconds: number; totalSeconds: number }>;
    forceShutdown: () => Promise<{ success: boolean; error?: string }>;
    tryCloseWindow: () => Promise<{ outcome: string }>;
    minimizeWindow: () => void;
    onTick: (callback: (seconds: number) => void) => void;
    onStateChange: (callback: (state: string) => void) => void;
    onComplete: (callback: () => void) => void;
    onError: (callback: (message: string) => void) => void;
    onForceShutdownPending: (callback: () => void) => void;
    removeAllListeners: () => void;
    setLanguage: (lang: string) => void;
}

interface WindowWithTimerAPI extends Window {
    timerAPI?: TimerAPI;
}

// ── Translation Dictionaries ────────────────────────
const translations: Record<string, Record<string, string>> = {
    'pt-BR': {
        timer: 'TIMER',
        timeRemaining: 'TEMPO RESTANTE',
        willTurnOffAt: 'Irá desligar às',
        willTurnOffAtPlaceholder: 'Irá desligar às --:--',
        restartBtn: 'Reiniciar',
        shutdownBtn: 'Desligar',
        hours: 'Horas',
        minutes: 'Minutos',
        seconds: 'Segundos',
        minimize: 'Minimizar',
        start: 'Iniciar',
        stop: 'Parar',
        cancelingText: 'Cancelando...',
        scheduled: 'Agendado',
        canceling: 'Cancelando',
        min10s: 'Mín: 10s',
        minLinux60s: 'Linux mín: 60s',
        minTimeError: 'Tempo mínimo de 10s',
        minLinuxTimeError: 'No Linux, tempo mínimo de 60s',
        wait: 'Aguarde...',
        error: 'Erro',
        permissionDenied: 'permissão negada',
        errorCanceling: 'Erro ao cancelar',
        turningOff: 'Desligando...',
        criticalError: 'Erro crítico: Falha ao carregar API do sistema.\n\nVerifique se o arquivo preload.js foi carregado.'
    },
    'en': {
        timer: 'TIMER',
        timeRemaining: 'TIME REMAINING',
        willTurnOffAt: 'Will turn off at',
        willTurnOffAtPlaceholder: 'Will turn off at --:--',
        restartBtn: 'Restart',
        shutdownBtn: 'Shutdown',
        hours: 'Hours',
        minutes: 'Minutes',
        seconds: 'Seconds',
        minimize: 'Minimize',
        start: 'Start',
        stop: 'Stop',
        cancelingText: 'Canceling...',
        scheduled: 'Scheduled',
        canceling: 'Canceling',
        min10s: 'Min: 10s',
        minLinux60s: 'Linux min: 60s',
        minTimeError: 'Minimum time of 10s',
        minLinuxTimeError: 'On Linux, minimum time is 60s',
        wait: 'Wait...',
        error: 'Error',
        permissionDenied: 'permission denied',
        errorCanceling: 'Error canceling',
        turningOff: 'Turning off...',
        criticalError: 'Critical error: Failed to load system API.\n\nVerify if preload.js was loaded.'
    },
    'es': {
        timer: 'TEMPORIZADOR',
        timeRemaining: 'TIEMPO RESTANTE',
        willTurnOffAt: 'Se apagará a las',
        willTurnOffAtPlaceholder: 'Se apagará a las --:--',
        restartBtn: 'Reiniciar',
        shutdownBtn: 'Apagar',
        hours: 'Horas',
        minutes: 'Minutos',
        seconds: 'Segundos',
        minimize: 'Minimizar',
        start: 'Iniciar',
        stop: 'Parar',
        cancelingText: 'Cancelando...',
        scheduled: 'Programado',
        canceling: 'Cancelando',
        min10s: 'Mín: 10s',
        minLinux60s: 'Linux mín: 60s',
        minTimeError: 'Tiempo mínimo de 10s',
        minLinuxTimeError: 'En Linux, el tiempo mínimo es 60s',
        wait: 'Espere...',
        error: 'Error',
        permissionDenied: 'permiso denegado',
        errorCanceling: 'Error al cancelar',
        turningOff: 'Apagando...',
        criticalError: 'Error crítico: No se pudo cargar la API del sistema.\n\nVerifique si preload.js fue cargado.'
    }
};

const isLinuxRuntime = navigator.userAgent.toLowerCase().includes('linux');
const minimumSeconds = isLinuxRuntime ? 60 : 10;
const minimumLabelKey = isLinuxRuntime ? 'minLinux60s' : 'min10s';
const minimumErrorKey = isLinuxRuntime ? 'minLinuxTimeError' : 'minTimeError';

const widgetWindow = window as WindowWithTimerAPI;

if (!widgetWindow.timerAPI) {
    console.error('CRITICAL: timerAPI is missing in window object.');
    const userLang = navigator.language.startsWith('es') ? 'es' : (navigator.language.startsWith('en') ? 'en' : 'pt-BR');
    alert(translations[userLang]?.criticalError || translations['pt-BR'].criticalError);
    throw new Error('timerAPI is missing in window object.');
}

const widgetAPI = widgetWindow.timerAPI;

// ── DOM Elements ──────────────────────────────────
const timerValueEl = document.getElementById('timer-value') as HTMLElement;
const timerEventEl = document.getElementById('timer-event') as HTMLElement;
const timerDisplayEl = document.querySelector('.timer-display') as HTMLElement;
const statusBadge = document.getElementById('status-badge') as HTMLElement;

const inputHours = document.getElementById('input-hours') as HTMLInputElement;
const inputMinutes = document.getElementById('input-minutes') as HTMLInputElement;
const inputSeconds = document.getElementById('input-seconds') as HTMLInputElement;

const btnStart = document.getElementById('btn-start') as HTMLElement;
const btnStartText = document.getElementById('btn-start-text') as HTMLElement;
const btnRestart = document.getElementById('btn-restart') as HTMLElement;
const btnShutdown = document.getElementById('btn-shutdown') as HTMLElement;
const btnMinimize = document.getElementById('btn-minimize') as HTMLElement;
const btnClose = document.getElementById('btn-close') as HTMLElement;
const btnMinimizeDot = document.getElementById('btn-minimize-dot') as HTMLElement;

// Static label elements for translation
const titleLabelEl = document.querySelector('.title-bar .title-label') as HTMLElement;
const timerLabelEl = document.querySelector('.timer-display .timer-label') as HTMLElement;
const labelRestart = document.getElementById('label-restart') as HTMLElement;
const labelShutdown = document.getElementById('label-shutdown') as HTMLElement;
const labelHours = document.getElementById('label-hours') as HTMLElement;
const labelMinutes = document.getElementById('label-minutes') as HTMLElement;
const labelSeconds = document.getElementById('label-seconds') as HTMLElement;
const langSelect = document.getElementById('lang-select') as HTMLSelectElement;

// ── State ─────────────────────────────────────────
let currentState = 'idle'; // idle, running, paused, canceling
let totalConfiguredSeconds = 0;
let isCanceling = false;
let currentLanguage = localStorage.getItem('language') || 'pt-BR';

// ── Translation Logic ─────────────────────────────
function applyLanguage(lang: string): void {
    if (!translations[lang]) return;
    currentLanguage = lang;
    localStorage.setItem('language', lang);

    // Update static strings
    if (titleLabelEl) titleLabelEl.textContent = translations[lang].timer;
    if (timerLabelEl) timerLabelEl.textContent = translations[lang].timeRemaining;
    if (labelRestart) labelRestart.textContent = translations[lang].restartBtn;
    if (labelShutdown) labelShutdown.textContent = translations[lang].shutdownBtn;
    if (labelHours) labelHours.textContent = translations[lang].hours;
    if (labelMinutes) labelMinutes.textContent = translations[lang].minutes;
    if (labelSeconds) labelSeconds.textContent = translations[lang].seconds;
    if (btnMinimize) btnMinimize.textContent = translations[lang].minimize;

    // Update state strings
    if (currentState === 'running') {
        btnStartText.textContent = translations[lang].stop;
        statusBadge.textContent = translations[lang].scheduled;
    } else if (currentState === 'canceling') {
        btnStartText.textContent = translations[lang].cancelingText;
        statusBadge.textContent = translations[lang].canceling;
    } else {
        btnStartText.textContent = translations[lang].start;
        if (currentState === 'idle') {
            timerEventEl.textContent = translations[lang].willTurnOffAtPlaceholder;
        }
    }

    // Inform main process of language selection
    if (widgetAPI && typeof widgetAPI.setLanguage === 'function') {
        widgetAPI.setLanguage(lang);
    }

    // Refresh dynamic timer preview if idle
    updateEventPreview();
}

// ── Helpers ───────────────────────────────────────
function formatTime(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function calculateShutdownTime(seconds: number): string {
    const shutdownDate = new Date(Date.now() + seconds * 1000);
    const hours = String(shutdownDate.getHours()).padStart(2, '0');
    const minutes = String(shutdownDate.getMinutes()).padStart(2, '0');
    return `${translations[currentLanguage].willTurnOffAt} ${hours}:${minutes}`;
}

function getInputSeconds(): number {
    const h = parseInt(inputHours.value) || 0;
    const m = parseInt(inputMinutes.value) || 0;
    const s = parseInt(inputSeconds.value) || 0;
    return h * 3600 + m * 60 + s;
}

function setInputsDisabled(disabled: boolean): void {
    inputHours.disabled = disabled;
    inputMinutes.disabled = disabled;
    inputSeconds.disabled = disabled;
}

function clampInput(input: HTMLInputElement, min: number, max: number): void {
    let val = parseInt(input.value);
    if (isNaN(val) || val < min) val = min;
    if (val > max) val = max;
    input.value = String(val).padStart(2, '0');
}

// ── UI State Updates ──────────────────────────────
function updateUIState(state: string): void {
    currentState = state;

    if (state === 'running') {
        btnStartText.textContent = translations[currentLanguage].stop;
        btnStart.classList.add('active');
        (btnStart as HTMLButtonElement).disabled = false;
        timerDisplayEl.classList.add('active');
        timerValueEl.classList.add('running');
        setInputsDisabled(true);
        
        statusBadge.textContent = translations[currentLanguage].scheduled;
        statusBadge.className = 'status-badge success';
    } else if (state === 'canceling') {
        btnStartText.textContent = translations[currentLanguage].cancelingText;
        (btnStart as HTMLButtonElement).disabled = true;
        
        statusBadge.textContent = translations[currentLanguage].canceling;
        statusBadge.className = 'status-badge loading';
    } else {
        btnStartText.textContent = translations[currentLanguage].start;
        btnStart.classList.remove('active');
        (btnStart as HTMLButtonElement).disabled = false;
        timerDisplayEl.classList.remove('active');
        timerValueEl.classList.remove('running');
        timerValueEl.classList.remove('warning');
        setInputsDisabled(false);

        if (state === 'idle') {
            timerEventEl.textContent = translations[currentLanguage].willTurnOffAtPlaceholder;
            statusBadge.className = 'status-badge hidden';
        }
    }
}

function updateTimerDisplay(seconds: number): void {
    timerValueEl.textContent = formatTime(seconds);

    // Animação de warning nos últimos 30 segundos
    if (seconds <= 30 && seconds > 0 && currentState === 'running') {
        timerValueEl.classList.add('warning');
        timerValueEl.classList.remove('running');
    }
}

// ── Event Listeners ───────────────────────────────

// Input validation
if (inputHours) inputHours.addEventListener('blur', () => clampInput(inputHours, 0, 23));
if (inputMinutes) inputMinutes.addEventListener('blur', () => clampInput(inputMinutes, 0, 59));
if (inputSeconds) inputSeconds.addEventListener('blur', () => clampInput(inputSeconds, 0, 59));

// Update "Irá desligar às" in real-time when inputs change
function updateEventPreview() {
    if (currentState === 'idle') {
        const seconds = getInputSeconds();
        if (seconds > 0) {
            timerEventEl.textContent = calculateShutdownTime(seconds);
            timerValueEl.textContent = formatTime(seconds);
            if (seconds < minimumSeconds) {
                statusBadge.textContent = translations[currentLanguage][minimumLabelKey];
                statusBadge.className = 'status-badge loading';
            } else {
                statusBadge.className = 'status-badge hidden';
            }
        } else {
            timerEventEl.textContent = translations[currentLanguage].willTurnOffAtPlaceholder;
            timerValueEl.textContent = '00:00:00';
            statusBadge.className = 'status-badge hidden';
        }
    }
}

if (inputHours) inputHours.addEventListener('input', updateEventPreview);
if (inputMinutes) inputMinutes.addEventListener('input', updateEventPreview);
if (inputSeconds) inputSeconds.addEventListener('input', updateEventPreview);

// Start / Stop button
if (btnStart) btnStart.addEventListener('click', async () => {
    if (currentState === 'idle') {
        const seconds = getInputSeconds();
        if (seconds < minimumSeconds) {
            timerEventEl.textContent = translations[currentLanguage][minimumErrorKey];
            statusBadge.textContent = translations[currentLanguage].error;
            statusBadge.className = 'status-badge error';
            setTimeout(updateEventPreview, 3000);
            return;
        }

        totalConfiguredSeconds = seconds;
        timerEventEl.textContent = calculateShutdownTime(seconds);
        
        statusBadge.textContent = translations[currentLanguage].wait;
        statusBadge.className = 'status-badge loading';
        (btnStart as HTMLButtonElement).disabled = true;

        const result = await widgetAPI.startTimer(seconds);
        if (!result.success) {
            timerEventEl.textContent = `${translations[currentLanguage].error}: ${result.error || translations[currentLanguage].permissionDenied}`;
            statusBadge.textContent = translations[currentLanguage].error;
            statusBadge.className = 'status-badge error';
            (btnStart as HTMLButtonElement).disabled = false;
            setTimeout(() => {
                updateEventPreview();
            }, 5000);
        } else {
            statusBadge.textContent = translations[currentLanguage].scheduled;
            statusBadge.className = 'status-badge success';
        }
    } else if (currentState === 'running') {
        isCanceling = true;
        updateUIState('canceling');
        
        const result = await widgetAPI.stopTimer();
        
        isCanceling = false;
        if (!result.success) {
            timerEventEl.textContent = translations[currentLanguage].errorCanceling;
            statusBadge.textContent = translations[currentLanguage].error;
            statusBadge.className = 'status-badge error';
            setTimeout(() => {
                updateUIState('running');
            }, 3000);
        } else {
            updateUIState('idle');
            updateEventPreview();
        }
    }
});

// Restart button
if (btnRestart) btnRestart.addEventListener('click', async () => {
    if (currentState === 'running' && totalConfiguredSeconds > 0) {
        timerEventEl.textContent = calculateShutdownTime(totalConfiguredSeconds);
        const result = await widgetAPI.restartTimer();
        if (!result.success) {
            timerEventEl.textContent = `${translations[currentLanguage].error}: ${result.error || ''}`;
            statusBadge.className = 'status-badge error';
        }
    }
});

// Force shutdown button
if (btnShutdown) btnShutdown.addEventListener('click', async () => {
    (btnShutdown as HTMLButtonElement).disabled = true;
    timerEventEl.textContent = translations[currentLanguage].turningOff;
    statusBadge.textContent = translations[currentLanguage].turningOff;
    statusBadge.className = 'status-badge loading';
    const result = await widgetAPI.forceShutdown();
    if (!result.success) {
        (btnShutdown as HTMLButtonElement).disabled = false;
        timerEventEl.textContent = `${translations[currentLanguage].error}: ${result.error || ''}`;
        statusBadge.className = 'status-badge error';
    }
});

widgetAPI.onForceShutdownPending(() => {
    timerEventEl.textContent = translations[currentLanguage].turningOff;
    statusBadge.textContent = translations[currentLanguage].turningOff;
    statusBadge.className = 'status-badge loading';
});

// Minimize button
if (btnMinimize) btnMinimize.addEventListener('click', () => {
    widgetAPI.minimizeWindow();
});

// Window control buttons
if (btnClose) btnClose.addEventListener('click', () => {
    void widgetAPI.tryCloseWindow();
});

if (btnMinimizeDot) btnMinimizeDot.addEventListener('click', () => {
    widgetAPI.minimizeWindow();
});

// Language Select change listener
if (langSelect) {
    langSelect.value = currentLanguage;
    langSelect.addEventListener('change', (e) => {
        const selectedLang = (e.target as HTMLSelectElement).value;
        applyLanguage(selectedLang);
    });
}

// ── IPC Listeners ─────────────────────────────────

widgetAPI.onTick((seconds: number) => {
    updateTimerDisplay(seconds);

    if (seconds > 0) {
        timerEventEl.textContent = calculateShutdownTime(seconds);
    }
});

widgetAPI.onStateChange((state: string) => {
    if (isCanceling && state === 'idle') return;
    updateUIState(state);
});

widgetAPI.onComplete(() => {
    updateUIState('idle');
    timerValueEl.textContent = '00:00:00';
    timerEventEl.textContent = translations[currentLanguage].turningOff;
    statusBadge.className = 'status-badge hidden';
});

widgetAPI.onError((message: string) => {
    timerEventEl.textContent = `${translations[currentLanguage].error}: ${message}`;
    setTimeout(() => {
        if (currentState === 'idle') {
            timerEventEl.textContent = translations[currentLanguage].willTurnOffAtPlaceholder;
        }
    }, 3000);
});

// ── Initialize ────────────────────────────────────
applyLanguage(currentLanguage);

// Sincronização inicial com o estado do timer em background
async function syncInitialState() {
    if (!widgetAPI) return;
    try {
        const state = await widgetAPI.getTimerState();
        if (state && state.state === 'running') {
            totalConfiguredSeconds = state.totalSeconds;
            updateUIState('running');
            updateTimerDisplay(state.remainingSeconds);
            timerEventEl.textContent = calculateShutdownTime(state.remainingSeconds);
        }
    } catch (e) {
        console.error('Erro ao sincronizar estado inicial:', e);
    }
}
syncInitialState();

