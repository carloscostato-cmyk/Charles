class VoiceStateMachine {
  constructor() {
    this.state = 'IDLE';
    this.context = {};
    this.listeners = new Map();
    this.history = [];
  }

  transition(action, payload = {}) {
    const currentState = this.state;
    const nextState = this.getNextState(currentState, action);

    if (!nextState) {
      console.warn(`[VoiceStateMachine] Invalid transition: ${currentState} + ${action}`);
      return false;
    }

    this.history.push({
      from: currentState,
      to: nextState,
      action,
      timestamp: Date.now()
    });

    this.onExit(currentState, action, payload);

    this.state = nextState;
    this.context = { ...this.context, ...payload };

    this.onEnter(nextState, action, payload);
    this.emit('state_change', { from: currentState, to: nextState, action, payload });

    return true;
  }

  getNextState(current, action) {
    const transitions = {
      IDLE: {
        USER_INPUT: 'LISTENING',
        START_SESSION: 'LISTENING'
      },
      LISTENING: {
        STT_COMPLETE: 'PROCESSING',
        STT_ERROR: 'IDLE',
        USER_STOP: 'IDLE'
      },
      PROCESSING: {
        TOOLS_COMPLETE: 'SPEAKING',
        TOOLS_TIMEOUT: 'SPEAKING',
        ERROR: 'ERROR',
        USER_STOP: 'IDLE'
      },
      SPEAKING: {
        AUDIO_COMPLETE: 'COMPLETED',
        USER_INTERRUPT: 'INTERRUPTED',
        QUEUE_NEXT: 'QUEUED'
      },
      INTERRUPTED: {
        RESUME: 'LISTENING',
        STOP: 'IDLE'
      },
      QUEUED: {
        QUEUE_EMPTY: 'IDLE',
        START_SPEAKING: 'SPEAKING',
        USER_STOP: 'IDLE'
      },
      COMPLETED: {
        NEXT_TURN: 'LISTENING',
        END_SESSION: 'IDLE'
      },
      ERROR: {
        RETRY: 'PROCESSING',
        ABORT: 'IDLE'
      }
    };

    return transitions[current]?.[action] || null;
  }

  onExit(state, action, payload) {
    const handlers = this.listeners.get(`exit_${state}`) || [];
    handlers.forEach(handler => {
      try {
        handler(action, payload);
      } catch (error) {
        console.error(`[VoiceStateMachine] Exit handler error for ${state}:`, error.message);
      }
    });
  }

  emit(event, ...args) {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(...args);
      } catch (error) {
        console.error(`[VoiceStateMachine] emit error for ${event}:`, error.message);
      }
    });
  }

  onEnter(state, action, payload) {
    const handlers = this.listeners.get(`enter_${state}`) || [];
    handlers.forEach(handler => {
      try {
        handler(action, payload);
      } catch (error) {
        console.error(`[VoiceStateMachine] Enter handler error for ${state}:`, error.message);
      }
    });
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }

  off(event, handler) {
    const handlers = this.listeners.get(event) || [];
    this.listeners.set(event, handlers.filter(h => h !== handler));
  }

  getState() {
    return this.state;
  }

  getContext() {
    return { ...this.context };
  }

  getHistory() {
    return [...this.history];
  }

  reset() {
    this.state = 'IDLE';
    this.context = {};
    this.history = [];
    this.listeners.clear();
  }
}

let instance = null;

function getVoiceStateMachine() {
  if (!instance) {
    instance = new VoiceStateMachine();
  }
  return instance;
}

module.exports = {
  getVoiceStateMachine,
  VoiceStateMachine
};
