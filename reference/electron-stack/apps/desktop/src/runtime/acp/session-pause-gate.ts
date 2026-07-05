export class SessionPauseGate {
  private paused = false;
  private releaseWaiters: Array<() => void> = [];

  isPaused(): boolean {
    return this.paused;
  }

  async waitIfPaused(): Promise<void> {
    while (this.paused) {
      await new Promise<void>((resolve) => {
        this.releaseWaiters.push(resolve);
      });
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    if (!this.paused) {
      return;
    }

    this.paused = false;
    const waiters = this.releaseWaiters.splice(0);
    for (const release of waiters) {
      release();
    }
  }
}
