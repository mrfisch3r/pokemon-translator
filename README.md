# Pokemon Translator

A simple Windows desktop app built with Electron that converts entered text into a phrase composed of Pokemon names that rhyme with the original words.

## Features
- Convert phrases into Pokemon-name rhyme phrases
- Phrase-level and word-level rhyme matching
- Keeps original words when no strong rhyme exists
- Offline by default using built-in Pokemon datasets
- Windows packaging via `electron-builder`

## Run locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the app:
   ```bash
   npm start
   ```
3. In the app, enter text and press `Shift + Enter` or click `Translate`.

## Build for Windows
To produce a Windows installer `.exe`:

```bash
npm run dist
```

The output will appear in the `dist/` folder.

## GitHub
This repository is already connected to GitHub and pushed to `origin/main`.

If you want to reinitialize locally or connect to another repo:

```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```
