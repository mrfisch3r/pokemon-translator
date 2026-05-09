import { translateToPokemonRhyme } from './translator.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('translateForm');
  const inputText = document.getElementById('inputText');
  const message = document.getElementById('message');
  const result = document.getElementById('result');

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const text = inputText.value.trim();
    if (!text) {
      message.textContent = 'Enter some text to translate.';
      result.textContent = '';
      return;
    }

    message.textContent = '';
    result.textContent = translateToPokemonRhyme(text);
  });
});
