import { translateToPokemonRhyme } from './translator.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('translateForm');
  const inputText = document.getElementById('inputText');
  const result = document.getElementById('result');
  const backgroundMusic = document.getElementById('backgroundMusic');
  const escapeSprite = document.getElementById('escapeSprite');

  const SPRITE_WIDTH = 72;
  const SPRITE_HEIGHT = 75;
  const SPRITE_SPEED = 260;
  const WALK_FRAME_DURATION = 180;
  const MUSIC_INITIAL_VOLUME = 0.35;
  const MUSIC_VOLUME_STEP = 0.08;
  const MUSIC_MAX_VOLUME = 1;
  const ESCAPE_START_X = 24;
  const ESCAPE_START_Y = 120;
  const KEY_DIRECTIONS = {
    arrowdown: 'down',
    arrowleft: 'left',
    arrowright: 'right',
    arrowup: 'up',
    s: 'down',
    a: 'left',
    d: 'right',
    w: 'up'
  };
  const DIRECTIONS = {
    down: { x: 0, y: 1, idleFrame: 0, walkFrames: [1, 2] },
    up: { x: 0, y: -1, idleFrame: 3, walkFrames: [4, 5] },
    right: { x: 1, y: 0, idleFrame: 6, walkFrames: [7, 8] },
    left: { x: -1, y: 0, idleFrame: 9, walkFrames: [10, 11] }
  };
  const DIRECTION_PRIORITY = ['down', 'up', 'right', 'left'];
  const movementKeys = new Set();
  let escapeQuestActive = false;
  let animationFrameId = null;
  let lastMoveTime = 0;
  let facingDirection = 'down';
  let walkAnimationStartedAt = 0;
  let wasMoving = false;
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

    escapeSprite.style.transform = `translate(${Math.round(spritePosition.x)}px, ${Math.round(spritePosition.y)}px)`;
  };

  const setSpriteFrame = (frameIndex) => {
    if (!escapeSprite) return;

    escapeSprite.style.backgroundPosition = `-${frameIndex * SPRITE_WIDTH}px 0`;
  };

  const getHeldDirections = () => {
    const heldDirections = new Set();
    for (const key of movementKeys) {
      heldDirections.add(KEY_DIRECTIONS[key]);
    }

    return DIRECTION_PRIORITY.filter((direction) => heldDirections.has(direction));
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

  const increaseMusicVolume = () => {
    if (!backgroundMusic) return;

    backgroundMusic.volume = Math.min(MUSIC_MAX_VOLUME, backgroundMusic.volume + MUSIC_VOLUME_STEP);
    backgroundMusic.play().catch(() => {});
  };

  const startEscapeQuest = () => {
    if (!escapeSprite) return;

    escapeQuestActive = true;
    movementKeys.clear();
    stopMovementLoop();
    facingDirection = 'down';
    walkAnimationStartedAt = 0;
    wasMoving = false;
    spritePosition = {
      x: ESCAPE_START_X,
      y: ESCAPE_START_Y
    };
    escapeSprite.classList.remove('hidden');
    updateSpritePosition();
    setSpriteFrame(DIRECTIONS[facingDirection].idleFrame);
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

    const activeDirections = getHeldDirections();
    const primaryDirection = activeDirections[activeDirections.length - 1];
    if (primaryDirection && !wasMoving) {
      walkAnimationStartedAt = timestamp;
    }
    if (primaryDirection && primaryDirection !== facingDirection) {
      facingDirection = primaryDirection;
      walkAnimationStartedAt = timestamp;
    }

    let deltaX = 0;
    let deltaY = 0;
    for (const direction of activeDirections) {
      deltaX += DIRECTIONS[direction].x;
      deltaY += DIRECTIONS[direction].y;
    }

    if (deltaX || deltaY) {
      const length = Math.hypot(deltaX, deltaY);
      const frames = DIRECTIONS[facingDirection].walkFrames;
      const frameOffset = Math.floor((timestamp - walkAnimationStartedAt) / WALK_FRAME_DURATION) % frames.length;
      setSpriteFrame(frames[frameOffset]);
      moveSprite(
        (deltaX / length) * SPRITE_SPEED * elapsedSeconds,
        (deltaY / length) * SPRITE_SPEED * elapsedSeconds
      );
      wasMoving = true;
    } else {
      setSpriteFrame(DIRECTIONS[facingDirection].idleFrame);
      wasMoving = false;
    }

    animationFrameId = window.requestAnimationFrame(moveSpriteWithKeys);
  };

  const startMovementLoop = () => {
    if (animationFrameId) return;

    lastMoveTime = 0;
    animationFrameId = window.requestAnimationFrame(moveSpriteWithKeys);
  };

  if (backgroundMusic) {
    backgroundMusic.volume = MUSIC_INITIAL_VOLUME;
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

  if (exitButton) {
    exitButton.addEventListener('click', increaseMusicVolume);
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
    const direction = KEY_DIRECTIONS[key];
    if (!direction) return;

    event.preventDefault();
    movementKeys.add(key);
    startMovementLoop();
  });

  document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    const direction = KEY_DIRECTIONS[key];
    if (!direction) return;

    movementKeys.delete(key);
    if (!movementKeys.size) {
      wasMoving = false;
      setSpriteFrame(DIRECTIONS[direction].idleFrame);
    }
  });
});
