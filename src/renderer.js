import { translateToPokemonRhyme } from './translator.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('translateForm');
  const inputText = document.getElementById('inputText');
  const result = document.getElementById('result');
  const backgroundMusic = document.getElementById('backgroundMusic');
  const escapeSprite = document.getElementById('escapeSprite');

  const SPRITE_WIDTH = 48;
  const SPRITE_HEIGHT = 72;
  const SPRITE_SPEED = 260;
  const ESCAPE_START_X = 24;
  const ESCAPE_START_Y = 120;
  const movementKeys = new Set();
  let escapeQuestActive = false;
  let animationFrameId = null;
  let lastMoveTime = 0;
  let spritePosition = {
    x: ESCAPE_START_X,
    y: ESCAPE_START_Y
  };

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
  const updateSpritePosition = () => {
    if (!escapeSprite) return;

    escapeSprite.style.transform = `translate(${spritePosition.x}px, ${spritePosition.y}px)`;
  };

  const rectanglesOverlap = (first, second) => (
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top
  );

  const checkForExitReached = () => {
    if (!escapeQuestActive || !escapeSprite || !exitButton) return;

    if (rectanglesOverlap(escapeSprite.getBoundingClientRect(), exitButton.getBoundingClientRect())) {
      closeWindow();
    }
  };

  const startEscapeQuest = () => {
    if (!escapeSprite) return;

    escapeQuestActive = true;
    movementKeys.clear();
    stopMovementLoop();
    spritePosition = {
      x: ESCAPE_START_X,
      y: ESCAPE_START_Y
    };
    escapeSprite.classList.remove('hidden');
    updateSpritePosition();
    inputText.blur();
  };

  const moveSprite = (deltaX, deltaY) => {
    if (!escapeQuestActive || !escapeSprite) return;

    const maxX = window.innerWidth - SPRITE_WIDTH;
    const maxY = window.innerHeight - SPRITE_HEIGHT;
    spritePosition = {
      x: Math.max(0, Math.min(maxX, spritePosition.x + deltaX)),
      y: Math.max(0, Math.min(maxY, spritePosition.y + deltaY))
    };

    updateSpritePosition();
    checkForExitReached();
  };

  const stopMovementLoop = () => {
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  };

  const moveSpriteWithKeys = (timestamp) => {
    if (!escapeQuestActive) {
      stopMovementLoop();
      return;
    }

    if (!lastMoveTime) {
      lastMoveTime = timestamp;
    }

    const elapsedSeconds = Math.min((timestamp - lastMoveTime) / 1000, 0.05);
    lastMoveTime = timestamp;

    let deltaX = 0;
    let deltaY = 0;
    if (movementKeys.has('w')) deltaY -= 1;
    if (movementKeys.has('a')) deltaX -= 1;
    if (movementKeys.has('s')) deltaY += 1;
    if (movementKeys.has('d')) deltaX += 1;

    if (deltaX || deltaY) {
      const length = Math.hypot(deltaX, deltaY);
      moveSprite(
        (deltaX / length) * SPRITE_SPEED * elapsedSeconds,
        (deltaY / length) * SPRITE_SPEED * elapsedSeconds
      );
    }

    animationFrameId = window.requestAnimationFrame(moveSpriteWithKeys);
  };

  const startMovementLoop = () => {
    if (animationFrameId) return;

    lastMoveTime = 0;
    animationFrameId = window.requestAnimationFrame(moveSpriteWithKeys);
  };

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
    startEscapeQuest();
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

  document.addEventListener('keydown', (event) => {
    if (!escapeQuestActive) return;

    const key = event.key.toLowerCase();
    if (!['w', 'a', 's', 'd'].includes(key)) return;

    event.preventDefault();
    movementKeys.add(key);
    startMovementLoop();
  });

  document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (!['w', 'a', 's', 'd'].includes(key)) return;

    movementKeys.delete(key);
  });
});
