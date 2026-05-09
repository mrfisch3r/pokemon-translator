import { translateToPokemonRhyme } from './translator.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('translateForm');
  const inputText = document.getElementById('inputText');
  const result = document.getElementById('result');
  const backgroundMusic = document.getElementById('backgroundMusic');

  const translateInput = () => {
    const text = inputText.value.trim();
    if (!text) {
      result.textContent = '';
      return;
    }

    result.textContent = translateToPokemonRhyme(text);
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    translateInput();
  });

  inputText.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      translateInput();
    }
  });

  const electron = window.electron || null;
  const closeWindow = () => {
    if (electron?.requestClose) {
      electron.requestClose();
    } else {
      window.close();
    }
  };

  const exitButton = document.getElementById('exitButton');
  if (exitButton) {
    exitButton.addEventListener('click', closeWindow);
  }

  if (backgroundMusic) {
    backgroundMusic.volume = 0.35;
    backgroundMusic.play().catch(() => {
      const startMusic = () => {
        backgroundMusic.play().catch(() => {});
        document.removeEventListener('pointerdown', startMusic);
        document.removeEventListener('keydown', startMusic);
      };

      document.addEventListener('pointerdown', startMusic);
      document.addEventListener('keydown', startMusic);
    });
  }

  const secretExit = document.getElementById('secretExit');
  if (secretExit) {
    secretExit.addEventListener('click', closeWindow);
  }

  const altF4Overlay = document.getElementById('altF4Overlay');
  const overlayClose = document.getElementById('overlayClose');

  const showAltF4Overlay = () => {
    if (altF4Overlay) {
      altF4Overlay.classList.remove('hidden');
    }
  };

  const hideAltF4Overlay = () => {
    if (altF4Overlay) {
      altF4Overlay.classList.add('hidden');
    }
  };

  if (electron?.onAppCloseAttempt) {
    electron.onAppCloseAttempt(() => {
      showAltF4Overlay();
    });
  }

  if (overlayClose) {
    overlayClose.addEventListener('click', hideAltF4Overlay);
  }
});
