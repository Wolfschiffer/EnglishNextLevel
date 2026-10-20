// Owns persisted preferences and audio controls for the Topics Speak activity.
(function () {
  const SETTINGS_STORAGE_KEY = 'englishNextLevel.topicSpeak.showPreAnswerAudio';

  function create({ state, window, document, stopSpeech, updatePreviewAudioVisibility }) {
    function $(id) {
      return document.getElementById(id);
    }

    function clampVolume(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return 100;
      return Math.max(0, Math.min(100, Math.round(numeric)));
    }

    function getVolumeIcon(volume) {
      const level = clampVolume(volume);
      if (level === 0) return '🔇';
      if (level <= 33) return '🔈';
      if (level <= 66) return '🔉';
      return '🔊';
    }

    function loadVoiceVolume() {
      state.voiceVolume = window.EnglishNextLevelAudio?.getVoiceVolume?.() ?? 100;
    }

    function loadSfxVolume() {
      state.sfxVolume = window.EnglishNextLevelAudio?.getSfxVolume?.() ?? 100;
    }

    function loadAudioVolumes() {
      loadVoiceVolume();
      loadSfxVolume();
    }

    function getVoiceVolume() {
      state.voiceVolume = window.EnglishNextLevelAudio?.getVoiceVolume?.() ?? state.voiceVolume;
      return state.voiceVolume;
    }

    function getSfxVolume() {
      state.sfxVolume = window.EnglishNextLevelAudio?.getSfxVolume?.() ?? state.sfxVolume;
      return state.sfxVolume;
    }

    function syncVoiceVolumeUI() {
      state.voiceVolume = getVoiceVolume();
      const slider = $('topic-speak-voice-volume');
      const value = $('topic-speak-voice-volume-value');
      const icon = $('topic-speak-voice-volume-icon');

      if (slider) {
        slider.value = String(state.voiceVolume);
        slider.setAttribute('aria-valuenow', String(state.voiceVolume));
        slider.style.setProperty('--topic-speak-volume-percent', `${state.voiceVolume}%`);
      }
      if (value) value.textContent = `${state.voiceVolume}%`;
      if (icon) icon.textContent = getVolumeIcon(state.voiceVolume);
    }

    function syncSfxVolumeUI() {
      const slider = $('topic-speak-sfx-volume');
      const value = $('topic-speak-sfx-volume-value');
      const icon = $('topic-speak-sfx-volume-icon');

      state.sfxVolume = getSfxVolume();

      if (slider) {
        slider.value = String(state.sfxVolume);
        slider.setAttribute('aria-valuenow', String(state.sfxVolume));
        slider.style.setProperty('--topic-speak-volume-percent', `${state.sfxVolume}%`);
      }
      if (value) value.textContent = `${state.sfxVolume}%`;
      if (icon) icon.textContent = getVolumeIcon(state.sfxVolume);
    }

    function syncSettingsUI() {
      const toggle = $('topic-speak-preaudio-toggle');
      if (toggle) toggle.checked = state.showPreAnswerAudio;
      syncVoiceVolumeUI();
      syncSfxVolumeUI();
      updatePreviewAudioVisibility();
    }

    function loadSettings() {
      try {
        state.showPreAnswerAudio = window.sessionStorage.getItem(SETTINGS_STORAGE_KEY) === 'true';
      } catch (error) {
        state.showPreAnswerAudio = false;
      }
      loadAudioVolumes();
    }

    function saveSettings() {
      try {
        window.sessionStorage.setItem(SETTINGS_STORAGE_KEY, state.showPreAnswerAudio ? 'true' : 'false');
      } catch (error) {
        // Storage can be unavailable in private/restricted browser contexts.
      }
    }

    function setVoiceVolume(value) {
      state.voiceVolume = clampVolume(value);
      window.EnglishNextLevelAudio?.setVoiceVolume?.(state.voiceVolume);
      stopSpeech();
      syncVoiceVolumeUI();
    }

    function setSfxVolume(value) {
      state.sfxVolume = clampVolume(value);
      window.EnglishNextLevelAudio?.setSfxVolume?.(state.sfxVolume);
      syncSfxVolumeUI();
    }

    function playSfx(type) {
      window.EnglishNextLevelAudio?.playSfx?.(type);
    }

    function unlockSfx() {
      window.EnglishNextLevelAudio?.unlockSfx?.();
    }

    function bindControls() {
      $('topic-speak-preaudio-toggle')?.addEventListener('change', (event) => {
        state.showPreAnswerAudio = Boolean(event.target.checked);
        saveSettings();
        updatePreviewAudioVisibility();
      });
      $('topic-speak-voice-volume')?.addEventListener('input', (event) => {
        setVoiceVolume(event.target.value);
      });
      $('topic-speak-sfx-volume')?.addEventListener('input', (event) => {
        setSfxVolume(event.target.value);
      });

      window.addEventListener('english-next-level-audio-volume-change', () => {
        loadAudioVolumes();
        syncVoiceVolumeUI();
        syncSfxVolumeUI();
      });
    }

    return {
      bindControls,
      getSfxVolume,
      getVoiceVolume,
      loadAudioVolumes,
      loadSfxVolume,
      loadSettings,
      loadVoiceVolume,
      playSfx,
      saveSettings,
      setSfxVolume,
      setVoiceVolume,
      syncSettingsUI,
      syncSfxVolumeUI,
      syncVoiceVolumeUI,
      unlockSfx
    };
  }

  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.TopicSpeakSettings = api;
})();
