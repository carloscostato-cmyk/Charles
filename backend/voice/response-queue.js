class ResponseQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxQueueSize = 5;
  }

  enqueue(response, options = {}) {
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
    }

    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      response,
      priority: options.priority || 'NORMAL',
      timestamp: Date.now(),
      attempts: 0,
      maxAttempts: 3,
      status: 'PENDING'
    };

    this.queue.push(item);
    this.sortByPriority();

    return item.id;
  }

  sortByPriority() {
    const priorityWeight = { HIGH: 3, NORMAL: 2, LOW: 1 };
    this.queue.sort((a, b) => {
      const weightDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (weightDiff !== 0) return weightDiff;
      return a.timestamp - b.timestamp;
    });
  }

  async processNext(playbackLock, ttsStreamer) {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const item = this.queue.shift();

    try {
      if (playbackLock && playbackLock.isLocked()) {
        await playbackLock.enqueue('response-queue');
      }

      item.status = 'SPEAKING';

      if (ttsStreamer && typeof ttsStreamer.speak === 'function') {
        await ttsStreamer.speak(item.response);
      }

      item.status = 'COMPLETED';
    } catch (error) {
      item.attempts++;

      if (item.attempts < item.maxAttempts) {
        item.status = 'RETRY';
        await new Promise(resolve => setTimeout(resolve, 1000 * item.attempts));
        this.queue.push(item);
      } else {
        item.status = 'FAILED';
        console.error(`[ResponseQueue] Response ${item.id} failed after ${item.maxAttempts} attempts:`, error.message);
      }
    } finally {
      if (playbackLock && playbackLock.getOwner() === 'response-queue') {
        playbackLock.release('response-queue');
      }
      this.processNext(playbackLock, ttsStreamer);
    }
  }

  clear() {
    this.queue = [];
    this.processing = false;
  }

  getQueue() {
    return [...this.queue];
  }

  getSize() {
    return this.queue.length;
  }
}

let instance = null;

function getResponseQueue() {
  if (!instance) {
    instance = new ResponseQueue();
  }
  return instance;
}

module.exports = {
  getResponseQueue,
  ResponseQueue
};
