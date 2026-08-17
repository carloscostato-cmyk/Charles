describe('Voice anti-interruption core', () => {
  test('playback lock garante exclusividade', async () => {
    const { getExclusivePlaybackLock } = require('../voice/exclusive-playback-lock');
    const lock = getExclusivePlaybackLock();

    await lock.acquire('a');
    expect(lock.isLocked()).toBe(true);
    expect(lock.getOwner()).toBe('a');

    const second = lock.acquire('b');
    await expect(Promise.race([second, new Promise(r => setTimeout(r, 50))])).resolves.toBeUndefined();

    lock.release('a');
    expect(lock.isLocked()).toBe(false);

    await second;
    expect(lock.getOwner()).toBe('b');
  });

  test('voice state machine transita corretamente', () => {
    const { getVoiceStateMachine } = require('../voice/voice-state-machine');
    const sm = getVoiceStateMachine();

    expect(sm.getState()).toBe('IDLE');

    expect(sm.transition('USER_INPUT')).toBe(true);
    expect(sm.getState()).toBe('LISTENING');

    expect(sm.transition('STT_COMPLETE')).toBe(true);
    expect(sm.getState()).toBe('PROCESSING');

    expect(sm.transition('TOOLS_COMPLETE')).toBe(true);
    expect(sm.getState()).toBe('SPEAKING');

    expect(sm.transition('AUDIO_COMPLETE')).toBe(true);
    expect(sm.getState()).toBe('COMPLETED');

    expect(sm.transition('NEXT_TURN')).toBe(true);
    expect(sm.getState()).toBe('LISTENING');
  });

  test('tool gate bloqueia TTS até conclusão da tool', async () => {
    const { getToolGate } = require('../voice/tool-gate');
    const toolGate = getToolGate();

    const result = await toolGate.executePreSpeechCheck('quero o download do arquivo PR PRQ 001');
    expect(result.needsTools).toBe(true);
    expect(result.response.readyForTTS).toBe(true);
  });

  test('response queue enfileira e preserva ordem', async () => {
    const { ResponseQueue } = require('../voice/response-queue');
    const queue = new ResponseQueue();

    queue.enqueue({ text: 'A' }, { priority: 'NORMAL' });
    queue.enqueue({ text: 'B' }, { priority: 'HIGH' });
    queue.enqueue({ text: 'C' }, { priority: 'LOW' });

    const items = queue.getQueue();
    expect(items[0].response.text).toBe('B');
    expect(items[1].response.text).toBe('A');
    expect(items[2].response.text).toBe('C');
  });

  test('interruption manager reconhece stop e bloqueia system interrupt', () => {
    const { InterruptionManager } = require('../voice/interruption-manager');
    const manager = new InterruptionManager();

    expect(manager.isUserStopCommand('pare')).toBe(true);
    expect(manager.isUserStopCommand('silêncio')).toBe(true);
    expect(manager.isUserStopCommand('continue')).toBe(false);

    expect(manager.canInterrupt(0, 'SYSTEM')).toBe(false);
    expect(manager.canInterrupt(0, 'USER_STOP')).toBe(true);
  });
});
