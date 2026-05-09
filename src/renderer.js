import { translateToPokemonRhyme } from './translator.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('translateForm');
  const inputText = document.getElementById('inputText');
  const message = document.getElementById('message');
  const result = document.getElementById('result');

  const translateInput = () => {
    const text = inputText.value.trim();
    if (!text) {
      message.textContent = 'Enter some text to translate.';
      result.textContent = '';
      return;
    }

    const translated = translateToPokemonRhyme(text);
    if (translated === text) {
      message.textContent = 'No rhyme-based Pokemon translation was found for this phrase.';
    } else {
      message.textContent = 'Translated phrase created from Pokemon names that rhyme with your input.';
    }

    result.textContent = translated;
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    translateInput();
  });

  inputText.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      translateInput();
    }
  });
});
