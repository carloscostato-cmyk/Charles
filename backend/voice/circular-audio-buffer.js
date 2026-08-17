class CircularAudioBuffer {
  constructor(size = 65536) {
    this.size = size;
    this.buffer = new Array(size).fill(null);
    this.writePos = 0;
    this.readPos = 0;
    this.available = 0;
  }

  write(chunk) {
    if (!chunk) return 0;

    while (this.available >= this.size) {
      this.readPos = (this.readPos + 1) % this.size;
      this.available--;
    }

    this.buffer[this.writePos] = chunk;
    this.writePos = (this.writePos + 1) % this.size;
    this.available++;

    return this.available;
  }

  read(requestSize = 4096) {
    if (this.available === 0) return null;

    const chunk = this.buffer[this.readPos];
    this.readPos = (this.readPos + 1) % this.size;
    this.available--;

    return chunk;
  }

  peek() {
    if (this.available === 0) return null;
    return this.buffer[this.readPos];
  }

  clear() {
    this.buffer.fill(null);
    this.writePos = 0;
    this.readPos = 0;
    this.available = 0;
  }

  getAvailable() {
    return this.available;
  }

  getFreeSpace() {
    return this.size - this.available;
  }
}

module.exports = { CircularAudioBuffer };
