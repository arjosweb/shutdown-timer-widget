import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_MIN_TIMER_SECONDS,
    LINUX_MIN_TIMER_SECONDS,
    MAX_TIMER_SECONDS,
    validateTimerSeconds,
} from '../services/timerValidation';

test('rejects non-integer or non-finite values', () => {
    assert.equal(validateTimerSeconds(NaN, 'darwin').ok, false);
    assert.equal(validateTimerSeconds(Infinity, 'darwin').ok, false);
    assert.equal(validateTimerSeconds(10.5, 'darwin').ok, false);
    assert.equal(validateTimerSeconds(0, 'darwin').ok, false);
});

test('enforces generic minimum on non-linux platforms', () => {
    assert.equal(validateTimerSeconds(DEFAULT_MIN_TIMER_SECONDS - 1, 'darwin').errorKey, 'errorMinTime');
    assert.equal(validateTimerSeconds(DEFAULT_MIN_TIMER_SECONDS, 'darwin').ok, true);
});

test('enforces Linux minimum', () => {
    assert.equal(validateTimerSeconds(LINUX_MIN_TIMER_SECONDS - 1, 'linux').errorKey, 'errorLinuxMinTime');
    assert.equal(validateTimerSeconds(LINUX_MIN_TIMER_SECONDS, 'linux').ok, true);
});

test('enforces max limit', () => {
    assert.equal(validateTimerSeconds(MAX_TIMER_SECONDS + 1, 'win32').errorKey, 'errorMaxTime');
    assert.equal(validateTimerSeconds(MAX_TIMER_SECONDS, 'win32').ok, true);
});
