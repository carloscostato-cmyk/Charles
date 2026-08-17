class ExclusivePlaybackLock {
  constructor() {
    this.locked = false;
    this.owner = null;
    this.queue = [];
    this.maxWaitTime = 30000;
  }

  async acquire(requestorId) {
    const startTime = Date.now();

    while (this.locked && this.owner !== requestorId) {
      if (Date.now() - startTime > this.maxWaitTime) {
        throw new Error('PLAYBACK_LOCK_TIMEOUT');
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.locked = true;
    this.owner = requestorId;
    return true;
  }

  release(requestorId) {
    if (this.owner !== requestorId) {
      return false;
    }

    this.locked = false;
    this.owner = null;

    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.acquire(next.requestorId).then(() => {
        next.resolve();
      });
    }

    return true;
  }

  isLocked() {
    return this.locked;
  }

  getOwner() {
    return this.owner;
  }

  enqueue(requestorId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.queue = this.queue.filter(item => item !== { requestorId, resolve, reject });
        reject(new Error('PLAYBACK_LOCK_ENQUEUE_TIMEOUT'));
      }, this.maxWaitTime);

      this.queue.push({
        requestorId,
        resolve: () => {
          clearTimeout(timeout);
          resolve();
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });
    });
  }
}

let instance = null;

function getExclusivePlaybackLock() {
  if (!instance) {
    instance = new ExclusivePlaybackLock();
  }
  return instance;
}

module.exports = {
  getExclusivePlaybackLock,
  ExclusivePlaybackLock
};
