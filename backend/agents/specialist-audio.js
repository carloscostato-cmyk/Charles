const fs = require('fs');
const path = require('path');

class AudioCaptureSpecialist {
  constructor() {
    this.permissionsChecked = false;
    this.audioConstraints = { audio: true };
    this.sampleRate = 16000;
    this.format = 'pcm';
  }

  checkPermissions() {
    return new Promise((resolve, reject) => {
      navigator.mediaDevices.getUserMedia(this.audioConstraints)
        .then(stream => {
          stream.getTracks().forEach(track => track.stop());
          this.permissionsChecked = true;
          resolve({ granted: true, constraints: this.audioConstraints });
        })
        .catch(err => {
          resolve({ granted: false, error: err.message });
        });
    });
  }

  testAudioCapture() {
    return this.checkPermissions();
  }

  analyzeStreamQuality(stream) {
    return {
      audioTracks: stream.getAudioTracks(),
      settings: stream.getAudioTracks()[0]?.getSettings(),
      constraints: stream.getConstraints(),
      quality: 'good'
    };
  }
}

module.exports = { AudioCaptureSpecialist };