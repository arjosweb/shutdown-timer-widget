export const DEFAULT_MIN_TIMER_SECONDS = 10;
export const LINUX_MIN_TIMER_SECONDS = 60;
export const MAX_TIMER_SECONDS = 7 * 24 * 60 * 60;

export interface TimerValidationResult {
    ok: boolean;
    errorKey?: 'errorInvalidTime' | 'errorMinTime' | 'errorLinuxMinTime' | 'errorMaxTime';
}

export function validateTimerSeconds(seconds: number, platform: NodeJS.Platform): TimerValidationResult {
    if (!Number.isFinite(seconds) || !Number.isInteger(seconds) || seconds <= 0) {
        return { ok: false, errorKey: 'errorInvalidTime' };
    }

    if (seconds > MAX_TIMER_SECONDS) {
        return { ok: false, errorKey: 'errorMaxTime' };
    }

    if (platform === 'linux' && seconds < LINUX_MIN_TIMER_SECONDS) {
        return { ok: false, errorKey: 'errorLinuxMinTime' };
    }

    if (seconds < DEFAULT_MIN_TIMER_SECONDS) {
        return { ok: false, errorKey: 'errorMinTime' };
    }

    return { ok: true };
}
