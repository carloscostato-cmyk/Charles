class CancellationToken {
  constructor() {
    this.cancelled = false;
    this.reason = null;
    this.listeners = new Set();
  }

  cancel(reason = 'USER_REQUEST') {
    this.cancelled = true;
    this.reason = reason;
    this.listeners.forEach(listener => {
      try {
        listener(reason);
      } catch (error) {
        // swallow listener errors to avoid breaking cancellation flow
      }
    });
  }

  isCancelled() {
    return this.cancelled;
  }

  getReason() {
    return this.reason;
  }

  onCancel(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  reset() {
    this.cancelled = false;
    this.reason = null;
    this.listeners.clear();
  }
}

let instance = null;

function getCancellationToken() {
  if (!instance) {
    instance = new CancellationToken();
  }
  return instance;
}

module.exports = {
  getCancellationToken,
  CancellationToken
};
