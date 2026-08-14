export interface StudioDomainEvent<TPayload = unknown> {
  readonly id: string;
  readonly type: string;
  readonly occurredAt: string;
  readonly source: string;
  readonly payload: TPayload;
}

export interface EventSink {
  record(event: StudioDomainEvent): void;
}

export class InMemoryEventSink implements EventSink {
  readonly #events: StudioDomainEvent[] = [];

  record(event: StudioDomainEvent): void {
    this.#events.push(event);
  }

  list(type?: string): readonly StudioDomainEvent[] {
    return type ? this.#events.filter((event) => event.type === type) : [...this.#events];
  }
}
