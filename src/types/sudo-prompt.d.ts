declare module 'sudo-prompt' {
    export interface SudoPromptOptions {
        name?: string;
        icns?: string;
    }

    export type SudoPromptCallback = (error: Error | null) => void;

    export function exec(command: string, options: SudoPromptOptions, callback: SudoPromptCallback): void;
}
