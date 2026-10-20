// ============================================
// CONFIGURAÇÕES GLOBAIS DE ÁUDIO
// ============================================
// NUMBERS, WORDS e TOPICS compartilham os mesmos níveis de voz e efeitos.
// Mantemos os IDs existentes do modal para preservar a interface atual.
const GLOBAL_SFX_STORAGE_KEY = 'englishNextLevel.sfxVolume';
const LEGACY_WORDS_SFX_STORAGE_KEY = 'englishNextLevel.wordsSfxVolume';
const VOICE_VOLUME_STORAGE_KEY = 'englishNextLevel.voiceVolume';
const VOICE_RATE_STORAGE_KEY = 'englishNextLevel.voiceRate';

let globalSfxVolume = 100;
let globalVoiceVolume = 100;
let globalVoiceRate = 90;
let wordsSettingsReturnFocus = null;
let releaseWordsSettingsFocusTrap = null;

function clampAudioVolume(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 100;
    return Math.max(0, Math.min(100, Math.round(numeric)));
}

function clampVoiceRate(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 90;
    return Math.max(50, Math.min(150, Math.round(numeric / 5) * 5));
}

function readSessionVolume(key, fallback = 100) {
    try {
        const saved = window.sessionStorage.getItem(key);
        return saved === null ? fallback : clampAudioVolume(saved);
    } catch (error) {
        return fallback;
    }
}

function readSessionVoiceRate(fallback = 90) {
    try {
        const saved = window.sessionStorage.getItem(VOICE_RATE_STORAGE_KEY);
        return saved === null ? fallback : clampVoiceRate(saved);
    } catch (error) {
        return fallback;
    }
}

function writeSessionVolume(key, value) {
    try {
        window.sessionStorage.setItem(key, String(clampAudioVolume(value)));
    } catch (error) {
        // Mantém o valor em memória quando sessionStorage não estiver disponível.
    }
}

function writeSessionVoiceRate(value) {
    try {
        window.sessionStorage.setItem(VOICE_RATE_STORAGE_KEY, String(clampVoiceRate(value)));
    } catch (error) {
        // Mantém o valor em memória quando sessionStorage não estiver disponível.
    }
}

function loadGlobalAudioVolumes() {
    globalVoiceVolume = readSessionVolume(VOICE_VOLUME_STORAGE_KEY, 100);
    globalVoiceRate = readSessionVoiceRate(90);

    try {
        const globalSaved = window.sessionStorage.getItem(GLOBAL_SFX_STORAGE_KEY);
        if (globalSaved !== null) {
            globalSfxVolume = clampAudioVolume(globalSaved);
        } else {
            // Migra automaticamente o volume antigo do WORDS, se existir.
            const legacySaved = window.sessionStorage.getItem(LEGACY_WORDS_SFX_STORAGE_KEY);
            globalSfxVolume = legacySaved === null ? 100 : clampAudioVolume(legacySaved);
            window.sessionStorage.setItem(GLOBAL_SFX_STORAGE_KEY, String(globalSfxVolume));
        }
    } catch (error) {
        globalSfxVolume = 100;
    }
}

function getGlobalVoiceVolume() {
    globalVoiceVolume = readSessionVolume(VOICE_VOLUME_STORAGE_KEY, globalVoiceVolume);
    return globalVoiceVolume;
}

function getGlobalVoiceRate() {
    globalVoiceRate = readSessionVoiceRate(globalVoiceRate);
    return globalVoiceRate / 100;
}

function getGlobalSfxVolume() {
    globalSfxVolume = readSessionVolume(GLOBAL_SFX_STORAGE_KEY, globalSfxVolume);
    return globalSfxVolume;
}

function getAudioVolumeIcon(volume) {
    const level = clampAudioVolume(volume);
    if (level === 0) return '🔇';
    if (level <= 33) return '🔈';
    if (level <= 66) return '🔉';
    return '🔊';
}

function updateGlobalAudioSettingsUI() {
    const sfxVolume = getGlobalSfxVolume();
    const voiceVolume = getGlobalVoiceVolume();

    const sfxSlider = document.getElementById('words-sfx-volume');
    const sfxValue = document.getElementById('words-sfx-volume-value');
    const sfxIcon = document.getElementById('words-sfx-volume-icon');

    if (sfxSlider) {
        sfxSlider.value = String(sfxVolume);
        sfxSlider.setAttribute('aria-valuenow', String(sfxVolume));
        sfxSlider.style.setProperty('--words-volume-percent', `${sfxVolume}%`);
    }
    if (sfxValue) sfxValue.textContent = `${sfxVolume}%`;
    if (sfxIcon) sfxIcon.textContent = getAudioVolumeIcon(sfxVolume);

    const voiceSlider = document.getElementById('words-voice-volume');
    const voiceValue = document.getElementById('words-voice-volume-value');
    const voiceIcon = document.getElementById('words-voice-volume-icon');

    if (voiceSlider) {
        voiceSlider.value = String(voiceVolume);
        voiceSlider.setAttribute('aria-valuenow', String(voiceVolume));
        voiceSlider.style.setProperty('--words-volume-percent', `${voiceVolume}%`);
    }
    if (voiceValue) voiceValue.textContent = `${voiceVolume}%`;
    if (voiceIcon) voiceIcon.textContent = getAudioVolumeIcon(voiceVolume);

    const voiceRate = Math.round(getGlobalVoiceRate() * 100);
    const voiceRateSlider = document.getElementById('words-voice-rate');
    const voiceRateValue = document.getElementById('words-voice-rate-value');
    if (voiceRateSlider) {
        voiceRateSlider.value = String(voiceRate);
        voiceRateSlider.setAttribute('aria-valuenow', String(voiceRate));
        voiceRateSlider.style.setProperty('--words-volume-percent', `${voiceRate - 50}%`);
    }
    if (voiceRateValue) voiceRateValue.textContent = `${voiceRate}%`;

    window.dispatchEvent(new CustomEvent('english-next-level-audio-volume-change', {
        detail: { voiceVolume, voiceRate: voiceRate / 100, sfxVolume }
    }));
}

function setGlobalSfxVolume(value) {
    globalSfxVolume = clampAudioVolume(value);
    writeSessionVolume(GLOBAL_SFX_STORAGE_KEY, globalSfxVolume);
    updateGlobalAudioSettingsUI();
}

function setGlobalVoiceVolume(value) {
    globalVoiceVolume = clampAudioVolume(value);
    writeSessionVolume(VOICE_VOLUME_STORAGE_KEY, globalVoiceVolume);

    if (globalVoiceVolume === 0) {
        EnglishSpeechEngine?.stop?.();
        stopWordsPronunciation?.();
    }

    updateGlobalAudioSettingsUI();
}

function setGlobalVoiceRate(value) {
    globalVoiceRate = clampVoiceRate(value);
    writeSessionVoiceRate(globalVoiceRate);
    updateGlobalAudioSettingsUI();
}

function getAudioSettingsLabel() {
    if (currentScreen === SCREENS.NUMBERS_GAME || currentScreen === SCREENS.NUMBERS_MENU) return 'NUMBERS';
    if (currentScreen === SCREENS.WORDS_GAME || currentScreen === SCREENS.WORDS_MENU ||
        currentScreen === SCREENS.WORDS_SUBMENU || currentScreen === SCREENS.WORDS_SUBMENU_PAST) return 'WORDS';
    if (currentScreen === SCREENS.TOPIC_MATCH) return 'MATCH PAIRS';
    if (currentScreen === SCREENS.TOPICS_MENU || currentScreen === SCREENS.TOPIC_LEVEL ||
        currentScreen === SCREENS.TOPIC_GAME_MENU) return 'TOPICS';
    return 'AUDIO';
}

function openWordsSettings() {
    const overlay = document.getElementById('words-settings-overlay');
    if (!overlay) return;
    if (overlay.classList.contains('visible')) return;

    wordsSettingsReturnFocus = document.activeElement;

    loadGlobalAudioVolumes();
    updateGlobalAudioSettingsUI();

    const kicker = document.getElementById('audio-settings-kicker');
    if (kicker) kicker.textContent = getAudioSettingsLabel();

    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('words-settings-open');

    const dialog = overlay.querySelector?.('[role="dialog"]');
    const initialFocus = document.getElementById('words-sfx-volume');
    releaseWordsSettingsFocusTrap = dialog
        ? window.EnlKeyboardAccessibility?.trapDialogFocus?.(dialog, {
            initialFocus,
            onEscape: closeWordsSettings
        }) || null
        : null;

    if (!releaseWordsSettingsFocusTrap) {
        requestAnimationFrame(() => initialFocus?.focus({ preventScroll: true }));
    }
}

function closeWordsSettings(options = {}) {
    const overlay = document.getElementById('words-settings-overlay');
    if (!overlay) return;
    const wasVisible = overlay.classList.contains('visible');
    const dialog = overlay.querySelector?.('[role="dialog"]');

    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('words-settings-open');

    releaseWordsSettingsFocusTrap?.();
    releaseWordsSettingsFocusTrap = null;

    const returnFocus = wordsSettingsReturnFocus;
    wordsSettingsReturnFocus = null;
    const canRestoreFocus = options.restoreFocus !== false && wasVisible && returnFocus &&
        returnFocus.isConnected !== false && !returnFocus.disabled &&
        !(typeof returnFocus.getClientRects === 'function' && returnFocus.getClientRects().length === 0);

    if (!canRestoreFocus) {
        if (dialog?.contains(document.activeElement)) document.activeElement.blur?.();
        return;
    }

    returnFocus.focus?.({ preventScroll: true });
}

function initWordsSettings() {
    loadGlobalAudioVolumes();
    updateGlobalAudioSettingsUI();

    [
        'category-settings-btn',
        'words-menu-settings-btn',
        'words-game-settings-btn',
        'numbers-menu-settings-btn',
        'numbers-game-settings-btn',
        'topics-menu-settings-btn',
        'topic-level-settings-btn',
        'topic-game-menu-settings-btn',
        'topic-match-settings-btn'
    ].forEach((id) => {
        document.getElementById(id)?.addEventListener('click', openWordsSettings);
    });

    document.getElementById('words-settings-close')?.addEventListener('click', closeWordsSettings);
    document.getElementById('words-settings-overlay')?.addEventListener('click', (event) => {
        if (event.target === event.currentTarget) closeWordsSettings();
    });
    document.getElementById('words-sfx-volume')?.addEventListener('input', (event) => {
        setGlobalSfxVolume(event.target.value);
    });
    document.getElementById('words-sfx-volume')?.addEventListener('change', () => {
        ProgrammaticSfxEngine.primeFromUserGesture();
        if (getGlobalSfxVolume() > 0) playSound('correct');
    });
    document.getElementById('words-voice-volume')?.addEventListener('input', (event) => {
        setGlobalVoiceVolume(event.target.value);
    });
    document.getElementById('words-voice-rate')?.addEventListener('input', (event) => {
        setGlobalVoiceRate(event.target.value);
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.getElementById('words-settings-overlay')?.classList.contains('visible')) {
            closeWordsSettings();
        }
    });
}

// Aliases temporários para código legado que ainda use os nomes antigos.
function getWordsVoiceVolume() { return getGlobalVoiceVolume(); }
function setWordsVoiceVolume(value) { setGlobalVoiceVolume(value); }
function setWordsSfxVolume(value) { setGlobalSfxVolume(value); }
function getWordsVoiceRate() { return getGlobalVoiceRate(); }
function getWordsVolumeIcon(volume) { return getAudioVolumeIcon(volume); }
