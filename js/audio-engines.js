// Shared speech and sound effect engines used by the main game and topic activities.

// ============================================
// MOTOR COMPARTILHADO DE VOZ (AMERICAN ENGLISH)
// ============================================
// A pronúncia falada deve usar um único caminho baseado na Web Speech API.
// NUMBERS e WORDS usam este mesmo motor. TOPICS permanece congelado
// durante a estabilização, embora também use a Web Speech API.
const EnglishSpeechEngine = (() => {
    const DEFAULT_LANG = 'en-US';
    const DEFAULT_RATE = 0.9;
    let activeUtterance = null;
    let primed = false;

    function supported() {
        return 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
    }

    function getAmericanVoice(lang = DEFAULT_LANG) {
        if (!supported()) return null;
        const voices = window.speechSynthesis.getVoices?.() || [];
        const target = String(lang || DEFAULT_LANG).toLowerCase();

        return voices.find((voice) => voice.lang?.toLowerCase() === target) ||
            voices.find((voice) => voice.lang?.toLowerCase().startsWith('en-us')) ||
            voices.find((voice) => voice.lang?.toLowerCase().startsWith('en')) ||
            null;
    }

    function stop() {
        if (!supported()) return;
        try {
            window.speechSynthesis.cancel();
        } catch (error) {
            console.warn('Speech engine: could not stop the current utterance.', error);
        }
        activeUtterance = null;
    }

    function prime(lang = DEFAULT_LANG) {
        if (primed || !supported()) return supported();

        try {
            const utterance = new SpeechSynthesisUtterance(' ');
            utterance.lang = lang;
            utterance.volume = 0;
            utterance.rate = 1;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
            window.speechSynthesis.resume?.();
            primed = true;
            return true;
        } catch (error) {
            console.warn('Speech engine: could not prime speech output.', error);
            return false;
        }
    }

    function speak(text, options = {}) {
        const cleanText = String(text || '').trim();
        if (!cleanText || !supported()) return false;

        const lang = options.lang || DEFAULT_LANG;
        const configuredRate = window.EnglishNextLevelAudio?.getVoiceRate?.() ?? DEFAULT_RATE;
        const requestedRate = options.rate ?? configuredRate;
        const rate = Number.isFinite(Number(requestedRate)) ? Number(requestedRate) : DEFAULT_RATE;
        const volume = Math.max(0, Math.min(1, Number.isFinite(Number(options.volume)) ? Number(options.volume) : 1));
        if (volume <= 0) {
            stop();
            return true;
        }

        stop();

        try {
            const utterance = new SpeechSynthesisUtterance(cleanText);
            const voice = getAmericanVoice(lang);
            utterance.lang = lang;
            utterance.rate = Math.max(0.5, Math.min(1.5, rate));
            utterance.volume = volume;
            if (voice) utterance.voice = voice;

            activeUtterance = utterance;
            const cleanup = () => {
                if (activeUtterance === utterance) activeUtterance = null;
                options.onEnd?.();
            };
            utterance.onend = cleanup;
            utterance.onerror = (event) => {
                if (activeUtterance === utterance) activeUtterance = null;
                console.warn('Speech engine: utterance failed.', event?.error || event);
                options.onError?.(event);
            };

            // Alguns navegadores móveis deixam o sintetizador em pausa após
            // troca de aba, microfone ou suspensão do sistema.
            window.speechSynthesis.resume?.();
            window.speechSynthesis.speak(utterance);
            window.speechSynthesis.resume?.();
            return true;
        } catch (error) {
            activeUtterance = null;
            console.warn('Speech engine: playback failed.', error);
            options.onError?.(error);
            return false;
        }
    }

    return { supported, getAmericanVoice, prime, speak, stop };
})();

// Exposto para os módulos que precisarem compartilhar a mesma voz/configuração.
window.EnglishNextLevelSpeech = EnglishSpeechEngine;

// ============================================
// MOTOR COMPARTILHADO DE SFX — SEM ARQUIVOS MP3
// ============================================
// Gera efeitos curtos diretamente com Web Audio API. Isso elimina a dependência
// dos MP3 de SFX e evita o problema de HTMLAudio silencioso observado no mobile.
const ProgrammaticSfxEngine = (() => {
    let context = null;

    function supported() {
        return Boolean(window.AudioContext || window.webkitAudioContext);
    }

    function getContext() {
        if (!supported()) return null;
        if (!context || context.state === 'closed') {
            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            try {
                context = new AudioContextCtor({ latencyHint: 'interactive' });
            } catch (error) {
                // Alguns navegadores antigos não aceitam options no construtor.
                context = new AudioContextCtor();
            }
        }
        return context;
    }

    function tone(ctx, { frequency, start, duration, gain, type = 'sine' }) {
        const oscillator = ctx.createOscillator();
        const envelope = ctx.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, start);

        envelope.gain.setValueAtTime(0.0001, start);
        envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), start + 0.012);
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        oscillator.connect(envelope);
        envelope.connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
    }

    // Chrome mobile é mais confiável quando o AudioContext e um source node são
    // efetivamente usados dentro de um CLICK/TOQUE real. Apenas chamar resume()
    // em um evento anterior não garante que o contexto saia de "suspended".
    function primeFromUserGesture() {
        const ctx = getContext();
        if (!ctx) return false;

        try {
            // Source node quase inaudível: start() ocorre SINCRONAMENTE dentro
            // do gesto do usuário e serve apenas para liberar o output do Web Audio.
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            const now = ctx.currentTime;

            oscillator.frequency.setValueAtTime(440, now);
            gain.gain.setValueAtTime(0.00001, now);
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start(now);
            oscillator.stop(now + 0.025);

            if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
                const resumePromise = ctx.resume();
                if (resumePromise && typeof resumePromise.catch === 'function') {
                    resumePromise.catch((error) => {
                        console.warn('SFX engine: resume after user gesture failed.', error);
                    });
                }
            }

            return true;
        } catch (error) {
            console.warn('SFX engine: could not prime audio from user gesture.', error);
            return false;
        }
    }

    async function unlock() {
        const ctx = getContext();
        if (!ctx) return false;
        try {
            if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
                await ctx.resume();
            }
            return ctx.state === 'running';
        } catch (error) {
            console.warn('SFX engine: could not unlock audio context.', error);
            return false;
        }
    }

    function scheduleEffect(ctx, effectType, level) {
        const now = ctx.currentTime + 0.008;
        // Um pouco mais forte que a primeira versão; ainda deixa headroom.
        const master = 0.28 * level;

        switch (effectType) {
            case 'correct':
                tone(ctx, { frequency: 660, start: now, duration: 0.12, gain: master, type: 'sine' });
                tone(ctx, { frequency: 880, start: now + 0.095, duration: 0.16, gain: master, type: 'sine' });
                break;

            case 'wrong':
                tone(ctx, { frequency: 220, start: now, duration: 0.19, gain: master * 0.9, type: 'square' });
                tone(ctx, { frequency: 165, start: now + 0.105, duration: 0.20, gain: master * 0.78, type: 'square' });
                break;

            case 'win':
                [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
                    tone(ctx, {
                        frequency,
                        start: now + index * 0.085,
                        duration: 0.21,
                        gain: master,
                        type: 'triangle'
                    });
                });
                break;

            case 'gameOver':
                [392, 293.66, 220].forEach((frequency, index) => {
                    tone(ctx, {
                        frequency,
                        start: now + index * 0.11,
                        duration: 0.21,
                        gain: master * 0.92,
                        type: 'triangle'
                    });
                });
                break;

            default:
                return false;
        }

        return true;
    }

    async function play(type, volume = getGlobalSfxVolume() / 100) {
        const level = Math.max(0, Math.min(1, Number(volume) || 0));
        if (level <= 0) return false;

        const ctx = getContext();
        if (!ctx) return false;

        try {
            if (ctx.state !== 'running') {
                await ctx.resume();
            }
            if (ctx.state !== 'running') {
                console.warn(`SFX engine: AudioContext is ${ctx.state}; sound was not scheduled.`);
                return false;
            }

            return scheduleEffect(ctx, type, level);
        } catch (error) {
            console.warn('SFX engine: playback failed.', error);
            return false;
        }
    }

    function getState() {
        return context?.state || 'not-created';
    }

    return { supported, unlock, primeFromUserGesture, play, getState };
})();
