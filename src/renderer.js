import { translateToPokemonRhyme } from './translator.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('translateForm');
  const inputText = document.getElementById('inputText');
  const result = document.getElementById('result');
  const backgroundMusic = document.getElementById('backgroundMusic');
  const escapeSprite = document.getElementById('escapeSprite');
  const localeWarning = document.getElementById('localeWarning');

  const SPRITE_WIDTH = 72;
  const SPRITE_HEIGHT = 75;
  const SPRITE_SPEED = 260;
  const WALK_FRAME_DURATION = 180;
  const MUSIC_INITIAL_VOLUME = 0.35;
  const MUSIC_VOLUME_STEP = 0.08;
  const MUSIC_MAX_VOLUME = 1;
  const LOCALE_WARNING_DURATION = 4200;
  const EXIT_BUTTON_FLEE_DISTANCE = 190;
  const EXIT_BUTTON_SPEED = 430;
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
  let visibleAreas = [];
  let escapeQuestActive = false;
  let localeWarningActive = false;
  let animationFrameId = null;
  let lastMoveTime = 0;
  let facingDirection = 'down';
  let walkAnimationStartedAt = 0;
  let wasMoving = false;
  let warningAudioContext = null;
  let warningNoiseTimer = null;
  let exitButtonPosition = null;
  let spritePosition = {
    x: ESCAPE_START_X,
    y: ESCAPE_START_Y
  };

  const getFallbackVisibleAreas = () => [{
    x: 0,
    y: 0,
    width: window.innerWidth,
    height: window.innerHeight
  }];

  const refreshVisibleAreas = async () => {
    if (!electron?.getDisplayBounds) {
      visibleAreas = getFallbackVisibleAreas();
      return;
    }

    try {
      const areas = await electron.getDisplayBounds();
      visibleAreas = areas?.length ? areas : getFallbackVisibleAreas();
    } catch {
      visibleAreas = getFallbackVisibleAreas();
    }
  };

  const clampToArea = (box, area) => ({
    x: Math.max(area.x, Math.min(area.x + area.width - box.width, box.x)),
    y: Math.max(area.y, Math.min(area.y + area.height - box.height, box.y)),
    width: box.width,
    height: box.height
  });

  const getVirtualArea = (areas) => {
    const left = Math.min(...areas.map((area) => area.x));
    const top = Math.min(...areas.map((area) => area.y));
    const right = Math.max(...areas.map((area) => area.x + area.width));
    const bottom = Math.max(...areas.map((area) => area.y + area.height));

    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top
    };
  };

  const getIntersectionArea = (box, area) => {
    const left = Math.max(box.x, area.x);
    const top = Math.max(box.y, area.y);
    const right = Math.min(box.x + box.width, area.x + area.width);
    const bottom = Math.min(box.y + box.height, area.y + area.height);

    return Math.max(0, right - left) * Math.max(0, bottom - top);
  };

  const getDistanceSquared = (left, right) => {
    const deltaX = left.x - right.x;
    const deltaY = left.y - right.y;
    return deltaX * deltaX + deltaY * deltaY;
  };

  const clampToVisibleArea = (box) => {
    const areas = visibleAreas.length ? visibleAreas : getFallbackVisibleAreas();
    const intersectingAreas = areas.filter((area) => getIntersectionArea(box, area) > 0);

    if (intersectingAreas.length > 1) {
      return clampToArea(box, getVirtualArea(intersectingAreas));
    }

    const center = {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2
    };
    const containingArea = areas.find((area) => (
      center.x >= area.x &&
      center.x <= area.x + area.width &&
      center.y >= area.y &&
      center.y <= area.y + area.height
    ));

    if (containingArea) {
      return clampToArea(box, containingArea);
    }

    const nearestArea = areas
      .map((area) => {
        const clamped = clampToArea(box, area);
        return {
          area,
          distance: getDistanceSquared(center, {
            x: clamped.x + clamped.width / 2,
            y: clamped.y + clamped.height / 2
          })
        };
      })
      .sort((left, right) => left.distance - right.distance)[0].area;

    return clampToArea(box, nearestArea);
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
      showLocaleWarningThenClose();
    }
  };

  const playWarningBeep = () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    warningAudioContext ??= new AudioContextClass();
    warningAudioContext.resume().catch(() => {});

    const start = warningAudioContext.currentTime;
    const oscillator = warningAudioContext.createOscillator();
    const gain = warningAudioContext.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, start);
    oscillator.frequency.setValueAtTime(660, start + 0.12);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
    gain.gain.setValueAtTime(0.18, start + 0.16);
    gain.gain.linearRampToValueAtTime(0, start + 0.22);

    oscillator.connect(gain);
    gain.connect(warningAudioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.24);
  };

  const startWarningNoise = () => {
    playWarningBeep();
    warningNoiseTimer = window.setInterval(playWarningBeep, 620);
    window.setTimeout(() => {
      window.clearInterval(warningNoiseTimer);
      warningNoiseTimer = null;
    }, LOCALE_WARNING_DURATION - 250);
  };

  const captureExitButtonPosition = () => {
    if (!exitButton) return;

    const bounds = exitButton.getBoundingClientRect();
    exitButtonPosition = {
      x: bounds.left,
      y: bounds.top,
      width: bounds.width,
      height: bounds.height
    };
    exitButtonPosition = clampToVisibleArea(exitButtonPosition);
    exitButton.classList.add('escaping');
    exitButton.style.left = `${Math.round(exitButtonPosition.x)}px`;
    exitButton.style.top = `${Math.round(exitButtonPosition.y)}px`;
  };

  const updateExitButtonPosition = () => {
    if (!exitButton || !exitButtonPosition) return;

    exitButton.style.left = `${Math.round(exitButtonPosition.x)}px`;
    exitButton.style.top = `${Math.round(exitButtonPosition.y)}px`;
  };

  const moveExitButtonAwayFromSprite = (elapsedSeconds) => {
    if (!escapeQuestActive || !escapeSprite || !exitButton || !exitButtonPosition) return;

    const spriteCenter = {
      x: spritePosition.x + SPRITE_WIDTH / 2,
      y: spritePosition.y + SPRITE_HEIGHT / 2
    };
    const exitCenter = {
      x: exitButtonPosition.x + exitButtonPosition.width / 2,
      y: exitButtonPosition.y + exitButtonPosition.height / 2
    };
    const deltaX = exitCenter.x - spriteCenter.x;
    const deltaY = exitCenter.y - spriteCenter.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance > EXIT_BUTTON_FLEE_DISTANCE || distance < 1) {
      exitButton.classList.remove('panicking');
      return;
    }

    exitButton.classList.add('panicking');
    const fleeStrength = 1 - distance / EXIT_BUTTON_FLEE_DISTANCE;
    const moveDistance = EXIT_BUTTON_SPEED * (0.35 + fleeStrength) * elapsedSeconds;
    exitButtonPosition = clampToVisibleArea({
      ...exitButtonPosition,
      x: exitButtonPosition.x + (deltaX / distance) * moveDistance,
      y: exitButtonPosition.y + (deltaY / distance) * moveDistance
    });
    updateExitButtonPosition();
  };

  const showLocaleWarningThenClose = () => {
    if (localeWarningActive) return;

    localeWarningActive = true;
    escapeQuestActive = false;
    movementKeys.clear();
    stopMovementLoop();
    if (exitButton) {
      exitButton.classList.add('frozen');
    }

    if (localeWarning) {
      localeWarning.classList.remove('hidden');
    }
    startWarningNoise();

    window.setTimeout(() => {
      closeWindow();
    }, LOCALE_WARNING_DURATION);
  };

  const increaseMusicVolume = () => {
    if (!backgroundMusic) return;

    backgroundMusic.volume = Math.min(MUSIC_MAX_VOLUME, backgroundMusic.volume + MUSIC_VOLUME_STEP);
    backgroundMusic.play().catch(() => {});
  };

  const startEscapeQuest = async () => {
    if (!escapeSprite || localeWarningActive) return;

    await refreshVisibleAreas();
    escapeQuestActive = true;
    movementKeys.clear();
    stopMovementLoop();
    captureExitButtonPosition();
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
    checkForExitReached();
    moveExitButtonAwayFromSprite(elapsedSeconds);

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

  refreshVisibleAreas();
  window.addEventListener('resize', refreshVisibleAreas);

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
    if (localeWarningActive) {
      event.preventDefault();
      return;
    }

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
