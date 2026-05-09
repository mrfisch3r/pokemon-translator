import pokemonNames from './pokemonNames.js';

const PHONETIC_RULES = [
  [/qu/g, 'kw'],
  [/ph/g, 'f'],
  [/kn/g, 'n'],
  [/gn/g, 'n'],
  [/wr/g, 'r'],
  [/wh/g, 'w'],
  [/x/g, 'ks'],
  [/c(?=[iey])/g, 's'],
  [/c/g, 'k'],
  [/q/g, 'k'],
];

const normalize = (text) => text.toLowerCase().replace(/[^a-z]/g, '');

const phonetic = (text) => {
  let value = normalize(text);
  for (const [pattern, replacement] of PHONETIC_RULES) {
    value = value.replace(pattern, replacement);
  }
  return value.replace(/e$/, '');
};

const countSyllables = (text) => {
  const phon = phonetic(text);
  return (phon.match(/[aeiouy]+/g) || []).length || 1;
};

const rhymeChunk = (text) => {
  const normalized = phonetic(text);
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
const chooseRandom = (list) => list[randomInt(list.length)];

const pokemonEntries = pokemonNames.map((name) => ({
  name,
  phoneticName: phonetic(name),
  rhyme: rhymeChunk(name),
  syllables: countSyllables(name),
}));

const namesByRhyme = new Map();
const namesBySuffix = new Map();

for (const entry of pokemonEntries) {
  if (entry.rhyme) {
    const bucket = namesByRhyme.get(entry.rhyme) ?? [];
    bucket.push(entry);
    namesByRhyme.set(entry.rhyme, bucket);
  }

  const phon = entry.phoneticName;
  for (let len = 4; len >= 2; len -= 1) {
    if (phon.length < len) continue;
    const suffix = phon.slice(-len);
    const bucket = namesBySuffix.get(suffix) ?? [];
    bucket.push(entry);
    namesBySuffix.set(suffix, bucket);
  }
}

const chooseBest = (bucket, targetSyllables) => {
  const exact = bucket.filter((entry) => entry.syllables === targetSyllables);
  if (exact.length) return chooseRandom(exact).name;

  const close = bucket.filter((entry) => Math.abs(entry.syllables - targetSyllables) <= 1);
  if (close.length) return chooseRandom(close).name;

  return chooseRandom(bucket).name;
};

const findRhymeForWord = (word) => {
  const cleaned = normalize(word);
  if (!cleaned || cleaned.length < 3) {
    return null;
  }

  const targetRhyme = rhymeChunk(word);
  const targetSyllables = countSyllables(word);
  let bucket = targetRhyme ? namesByRhyme.get(targetRhyme) : null;

  if (bucket && bucket.length) {
    return chooseBest(bucket, targetSyllables);
  }

  const phon = phonetic(word);
  for (let len = Math.min(phon.length, 4); len >= 3; len -= 1) {
    const suffix = phon.slice(-len);
    bucket = namesBySuffix.get(suffix);
    if (bucket && bucket.length) {
      return chooseBest(bucket, targetSyllables);
    }
  }

  return null;
};

const isWord = (token) => /^[A-Za-z]+$/.test(token);

export function translateToPokemonRhyme(text) {
  const tokens = text.match(/[A-Za-z]+|[^A-Za-z]+/g) || [];
  return tokens
    .map((token) => {
      if (!isWord(token)) {
        return token;
      }
      const rhymeName = findRhymeForWord(token);
      return rhymeName ?? token;
    })
    .join('');
}
