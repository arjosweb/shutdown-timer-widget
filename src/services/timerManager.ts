import { EventEmitter } from 'events';

export type TimerState = 'idle' | 'running' | 'paused';

export class TimerManager extends EventEmitter {
    public state: TimerState;
    public remainingSeconds: number;
    public totalSeconds: number;
    private intervalId: NodeJS.Timeout | null;

    constructor() {
        super();
        this.state = 'idle';
        this.remainingSeconds = 0;
        this.totalSeconds = 0;
        this.intervalId = null;
    }

    start(seconds: number): void {
        this.stop();
        this.totalSeconds = seconds;
        this.remainingSeconds = seconds;
        this.state = 'running';
        this.emit('state-change', this.state);
        this.emit('tick', this.remainingSeconds);

        this.intervalId = setInterval(() => {
            this.remainingSeconds--;
            this.emit('tick', this.remainingSeconds);

            if (this.remainingSeconds <= 0) {
                this.clearInterval();
                this.state = 'idle';
                this.emit('state-change', this.state);
                this.emit('complete');
            }
        }, 1000);
    }

    stop(): void {
        this.clearInterval();
        this.remainingSeconds = 0;
        this.totalSeconds = 0;
        this.state = 'idle';
        this.emit('state-change', this.state);
        this.emit('tick', 0);
    }

    restart(): void {
        if (this.totalSeconds > 0) {
            this.start(this.totalSeconds);
        }
    }

    pause(): void {
        if (this.state === 'running') {
            this.clearInterval();
            this.state = 'paused';
            this.emit('state-change', this.state);
        }
    }

    resume(): void {
        if (this.state === 'paused' && this.remainingSeconds > 0) {
            this.state = 'running';
            this.emit('state-change', this.state);

            this.intervalId = setInterval(() => {
                this.remainingSeconds--;
                this.emit('tick', this.remainingSeconds);

                if (this.remainingSeconds <= 0) {
                    this.clearInterval();
                    this.state = 'idle';
                    this.emit('state-change', this.state);
                    this.emit('complete');
                }
            }, 1000);
        }
    }

    private clearInterval(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    getState() {
        return {
            state: this.state,
            remainingSeconds: this.remainingSeconds,
            totalSeconds: this.totalSeconds,
        };
    }
}
