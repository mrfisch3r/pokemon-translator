import pokemonNames from './pokemonNames.js';

const normalize = (text) => text.toLowerCase().replace(/[^a-z]/g, '');

const rhymeKey = (word) => {
  const normalized = normalize(word);
  if (!normalized) {
    return '';
  }

  const match = normalized.match(/[aeiouy]+[^aeiouy]*$/);
  if (match) {
    return match[0];
  }

  return normalized.slice(-3);
};

const randomInt = (max) => Math.floor(Math.random() * max);

const randomName = () => pokemonNames[randomInt(pokemonNames.length)];

const findRhymeName = (word) => {
  const normalizedWord = normalize(word);
  if (!normalizedWord) {
    return randomName();
  }

  const key = rhymeKey(word);
  if (key) {
    const exactMatches = pokemonNames.filter((name) => normalize(name).endsWith(key));
    if (exactMatches.length) {
      return exactMatches[randomInt(exactMatches.length)];
    }
  }

  for (let length = 4; length >= 2; length--) {
    const suffix = normalizedWord.slice(-length);
    if (!suffix) {
      continue;
    }

    const fallback = pokemonNames.filter((name) => normalize(name).endsWith(suffix));
    if (fallback.length) {
      return fallback[randomInt(fallback.length)];
    }
  }

  const firstLetter = normalizedWord.charAt(0);
  const sameInitial = pokemonNames.filter((name) => normalize(name).charAt(0) === firstLetter);
  if (sameInitial.length) {
    return sameInitial[randomInt(sameInitial.length)];
  }

  return randomName();
};

export function translateToPokemonRhyme(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return '';
  }

  return words.map((word) => findRhymeName(word)).join(' ');
}
