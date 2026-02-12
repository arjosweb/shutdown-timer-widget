// Helper to access window.timerAPI safely without global augmentation

interface TimerAPI {
    startTimer: (seconds: number) => Promise<{ success: boolean; error?: string }>;
    stopTimer: () => Promise<{ success: boolean; error?: string }>;
    restartTimer: () => Promise<{ success: boolean; error?: string }>;
    forceShutdown: () => Promise<{ success: boolean; error?: string }>;
    minimizeWindow: () => void;
    closeWindow: () => void;
    onTick: (callback: (seconds: number) => void) => void;
    onStateChange: (callback: (state: string) => void) => void;
    onComplete: (callback: () => void) => void;
    onError: (callback: (message: string) => void) => void;
    removeAllListeners: () => void;
}

// Helper to access window.timerAPI safely without global augmentation
const widgetAPI = (window as any).timerAPI as TimerAPI;

if (!widgetAPI) {
    console.error('CRITICAL: timerAPI is missing in window object.');
    alert('Erro crítico: Falha ao carregar API do sistema.\n\nVerifique se o arquivo preload.js foi carregado.');
}

// ── DOM Elements ──────────────────────────────────
const timerValueEl = document.getElementById('timer-value') as HTMLElement;
const timerEventEl = document.getElementById('timer-event') as HTMLElement;
const timerDisplayEl = document.querySelector('.timer-display') as HTMLElement;

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

// ── State ─────────────────────────────────────────
let currentState = 'idle'; // idle, running, paused
let totalConfiguredSeconds = 0;

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
    return `Irá desligar às ${hours}:${minutes}`;
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
        btnStartText.textContent = 'Parar';
        btnStart.classList.add('active');
        timerDisplayEl.classList.add('active');
        timerValueEl.classList.add('running');
        setInputsDisabled(true);
    } else {
        btnStartText.textContent = 'Iniciar';
        btnStart.classList.remove('active');
        timerDisplayEl.classList.remove('active');
        timerValueEl.classList.remove('running');
        timerValueEl.classList.remove('warning');
        setInputsDisabled(false);

        if (state === 'idle') {
            timerEventEl.textContent = 'Irá desligar às --:--';
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
        } else {
            timerEventEl.textContent = 'Irá desligar às --:--';
            timerValueEl.textContent = '00:00:00';
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
        if (seconds <= 0) return;

        totalConfiguredSeconds = seconds;
        timerEventEl.textContent = calculateShutdownTime(seconds);

        const result = await widgetAPI.startTimer(seconds);
        if (!result.success) {
            timerEventEl.textContent = `Erro: ${result.error || 'permissão negada'}`;
            setTimeout(() => {
                timerEventEl.textContent = 'Irá desligar às --:--';
            }, 5000);
        }
    } else if (currentState === 'running') {
        const result = await widgetAPI.stopTimer();
        if (!result.success) {
            timerEventEl.textContent = 'Erro ao cancelar';
            setTimeout(() => {
                timerEventEl.textContent = 'Irá desligar às --:--';
            }, 3000);
        }
    }
});

// Restart button
if (btnRestart) btnRestart.addEventListener('click', async () => {
    if (currentState === 'running' && totalConfiguredSeconds > 0) {
        timerEventEl.textContent = calculateShutdownTime(totalConfiguredSeconds);
        await widgetAPI.restartTimer();
    }
});

// Force shutdown button
if (btnShutdown) btnShutdown.addEventListener('click', async () => {
    await widgetAPI.forceShutdown();
});

// Minimize button
if (btnMinimize) btnMinimize.addEventListener('click', () => {
    widgetAPI.minimizeWindow();
});

// Window control buttons
if (btnClose) btnClose.addEventListener('click', () => {
    widgetAPI.closeWindow();
});

if (btnMinimizeDot) btnMinimizeDot.addEventListener('click', () => {
    widgetAPI.minimizeWindow();
});

// ── IPC Listeners ─────────────────────────────────

widgetAPI.onTick((seconds: number) => {
    updateTimerDisplay(seconds);

    if (seconds > 0) {
        timerEventEl.textContent = calculateShutdownTime(seconds);
    }
});

widgetAPI.onStateChange((state: string) => {
    updateUIState(state);
});

widgetAPI.onComplete(() => {
    updateUIState('idle');
    timerValueEl.textContent = '00:00:00';
    timerEventEl.textContent = 'Desligando...';
});

widgetAPI.onError((message: string) => {
    timerEventEl.textContent = `Erro: ${message}`;
    setTimeout(() => {
        if (currentState === 'idle') {
            timerEventEl.textContent = 'Irá desligar às --:--';
        }
    }, 3000);
});

// ── Initialize ────────────────────────────────────
updateEventPreview();
