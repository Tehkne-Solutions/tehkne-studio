export interface StudioCommand<TPayload = unknown> {
  readonly id: string;
  readonly type: string;
  readonly targetId?: string;
  readonly payload: TPayload;
  readonly source: "ui" | "voice" | "automation" | "simulation" | "system";
  readonly issuedAt: string;
}

export interface CommandResult<TResult = unknown> {
  readonly commandId: string;
  readonly ok: boolean;
  readonly result?: TResult;
  readonly error?: string;
}

export type CommandHandler<TPayload = unknown, TResult = unknown> = (
  command: StudioCommand<TPayload>
) => Promise<TResult> | TResult;

export class CommandBus {
  readonly #handlers = new Map<string, CommandHandler>();

  register(type: string, handler: CommandHandler): void {
    if (this.#handlers.has(type)) throw new Error(`Handler already registered: ${type}`);
    this.#handlers.set(type, handler);
  }

  async dispatch<TResult>(command: StudioCommand): Promise<CommandResult<TResult>> {
    const handler = this.#handlers.get(command.type);
    if (!handler) return { commandId: command.id, ok: false, error: `No handler for ${command.type}` };

    try {
      const result = (await handler(command)) as TResult;
      return { commandId: command.id, ok: true, result };
    } catch (error) {
      return {
        commandId: command.id,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown command failure"
      };
    }
  }
}
