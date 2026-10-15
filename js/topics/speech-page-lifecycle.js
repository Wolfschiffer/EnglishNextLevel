// Owns the page focus and visibility rules for the Topics Speak microphone.
(function () {
  function create({
    state,
    window,
    document,
    suspendMicrophoneForPageLifecycle,
    resumeMicrophoneControlsAfterFocus
  }) {
    function clearBlurLifecycleTimer() {
      if (state.blurLifecycleTimer) {
        window.clearTimeout(state.blurLifecycleTimer);
        state.blurLifecycleTimer = null;
      }
    }

    function scheduleBlurLifecycleCheck(delay = 350) {
      clearBlurLifecycleTimer();
      state.blurLifecycleTimer = window.setTimeout(() => {
        state.blurLifecycleTimer = null;

        if (document.visibilityState === 'hidden') {
          state.pageFocused = false;
          suspendMicrophoneForPageLifecycle();
          return;
        }

        if (typeof document.hasFocus === 'function' && document.hasFocus()) {
          state.pageFocused = true;
          return;
        }

        // Permission prompts can temporarily blur the page while start() is pending.
        if (state.recognitionStarting && !state.listening) {
          scheduleBlurLifecycleCheck(350);
          return;
        }

        // Allow the native permission prompt to close before treating blur as final.
        if (state.listening && state.recognitionStartedAt && Date.now() - state.recognitionStartedAt < 900) {
          scheduleBlurLifecycleCheck(350);
          return;
        }

        state.pageFocused = false;
        suspendMicrophoneForPageLifecycle();
      }, delay);
    }

    function attach() {
      window.addEventListener('blur', () => scheduleBlurLifecycleCheck());

      window.addEventListener('focus', () => {
        clearBlurLifecycleTimer();
        state.pageFocused = true;
        resumeMicrophoneControlsAfterFocus();
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          clearBlurLifecycleTimer();
          state.pageFocused = false;
          suspendMicrophoneForPageLifecycle();
        } else {
          state.pageFocused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
          if (state.pageFocused) resumeMicrophoneControlsAfterFocus();
        }
      });

      window.addEventListener('pagehide', () => {
        clearBlurLifecycleTimer();
        state.pageFocused = false;
        suspendMicrophoneForPageLifecycle();
      });

      window.addEventListener('beforeunload', () => {
        clearBlurLifecycleTimer();
        state.pageFocused = false;
        suspendMicrophoneForPageLifecycle();
      });

      document.addEventListener('freeze', () => {
        clearBlurLifecycleTimer();
        state.pageFocused = false;
        suspendMicrophoneForPageLifecycle();
      });
    }

    return { attach, clearBlurLifecycleTimer, scheduleBlurLifecycleCheck };
  }

  window.TopicSpeakPageLifecycle = { create };
})();
