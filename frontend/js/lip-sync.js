// lip-sync.js
class LipSync {
  constructor() {
    this.visemeMap = this._buildVisemeMap();
    this.timers = [];
    this.currentId = null;
    // Listen to TTS events
    window.addEventListener('tts:start', (e) => this.start(e.detail.id, e.detail.text));
    window.addEventListener('tts:end', () => this.stop());
    window.addEventListener('tts:error', () => this.stop());
  }

  _buildVisemeMap() {
    // Simple mapping of phoneme categories to viseme element IDs.
    return {
      a: 'mouth-viseme-a', e: 'mouth-viseme-e', i: 'mouth-viseme-i', o: 'mouth-viseme-o', u: 'mouth-viseme-u',
      m: 'mouth-viseme-m', n: 'mouth-viseme-n', l: 'mouth-viseme-l', s: 'mouth-viseme-s', r: 'mouth-viseme-r',
      ch: 'mouth-viseme-ch', g: 'mouth-viseme-g', k: 'mouth-viseme-k', f: 'mouth-viseme-f', v: 'mouth-viseme-v',
      sh: 'mouth-viseme-sh', z: 'mouth-viseme-z', j: 'mouth-viseme-j', lh: 'mouth-viseme-lh'
    };
  }

  // Start animation – we receive the utterance text (optional) for fallback timing.
  start(id, text = '') {
    this.stop();
    this.currentId = id;
    // Estimate duration if we cannot rely on onboundary.
    const estimatedMs = Math.max(1500, text.length * 80);
    const stepMs = 120; // change viseme roughly every 120 ms
    const steps = Math.floor(estimatedMs / stepMs);
    for (let i = 0; i < steps; i++) {
      const t = setTimeout(() => this._showRandomViseme(), i * stepMs);
      this.timers.push(t);
    }
    // Notify monitor subagent
    const ev = new CustomEvent('lip:viseme', { detail: { id, state: 'started' } });
    window.dispatchEvent(ev);
  }

  _showRandomViseme() {
    const keys = Object.keys(this.visemeMap);
    const key = keys[Math.floor(Math.random() * keys.length)];
    const elId = this.visemeMap[key];
    const el = document.getElementById(elId);
    if (el) el.classList.add('active');
    // hide after a short moment
    setTimeout(() => { if (el) el.classList.remove('active'); }, 100);
    const ev = new CustomEvent('lip:viseme', { detail: { id: this.currentId, viseme: key } });
    window.dispatchEvent(ev);
  }

  stop() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    // clear any active viseme classes
    Object.values(this.visemeMap).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
    const ev = new CustomEvent('lip:viseme', { detail: { id: this.currentId, state: 'stopped' } });
    window.dispatchEvent(ev);
    this.currentId = null;
  }
}

// expose globally
window.LipSync = LipSync;
