const fs = require('fs');

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/render-midi-to-wav.js <input.mid> <output.wav>');
  process.exit(1);
}

const DEFAULT_TEMPO = 500000;
const DRUM_CHANNEL = 9;
const SAMPLE_RATE = 44100;
const MASTER_VOLUME = 0.11;

const readString = (view, offset, length) => {
  let value = '';
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }
  return value;
};

const readVariableLength = (view, state) => {
  let value = 0;
  let byte = 0;

  do {
    byte = view.getUint8(state.offset);
    state.offset += 1;
    value = (value << 7) | (byte & 0x7f);
  } while (byte & 0x80);

  return value;
};

const getChannelEventLength = (status) => {
  const type = status & 0xf0;
  return type === 0xc0 || type === 0xd0 ? 1 : 2;
};

const parseTrack = (view, start, length) => {
  const state = { offset: start };
  const end = start + length;
  const events = [];
  let tick = 0;
  let runningStatus = null;

  while (state.offset < end) {
    tick += readVariableLength(view, state);

    let status = view.getUint8(state.offset);
    if (status & 0x80) {
      state.offset += 1;
      if (status < 0xf0) {
        runningStatus = status;
      }
    } else if (runningStatus) {
      status = runningStatus;
    } else {
      break;
    }

    if (status === 0xff) {
      const metaType = view.getUint8(state.offset);
      state.offset += 1;
      const metaLength = readVariableLength(view, state);

      if (metaType === 0x51 && metaLength === 3) {
        const tempo =
          (view.getUint8(state.offset) << 16) |
          (view.getUint8(state.offset + 1) << 8) |
          view.getUint8(state.offset + 2);
        events.push({ type: 'tempo', tick, tempo });
      }

      state.offset += metaLength;
      continue;
    }

    if (status === 0xf0 || status === 0xf7) {
      state.offset += readVariableLength(view, state);
      continue;
    }

    const eventLength = getChannelEventLength(status);
    const data1 = view.getUint8(state.offset);
    const data2 = eventLength === 2 ? view.getUint8(state.offset + 1) : 0;
    state.offset += eventLength;

    events.push({
      type: status & 0xf0,
      channel: status & 0x0f,
      tick,
      data1,
      data2
    });
  }

  return events;
};

const parseMidi = (buffer) => {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 0;

  if (readString(view, offset, 4) !== 'MThd') {
    throw new Error('Invalid MIDI header.');
  }

  offset += 4;
  const headerLength = view.getUint32(offset);
  offset += 4;
  offset += 2;
  const trackCount = view.getUint16(offset);
  offset += 2;
  const ticksPerBeat = view.getUint16(offset);
  offset = 8 + headerLength;

  const events = [];
  for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
    if (readString(view, offset, 4) !== 'MTrk') {
      break;
    }

    offset += 4;
    const trackLength = view.getUint32(offset);
    offset += 4;
    events.push(...parseTrack(view, offset, trackLength));
    offset += trackLength;
  }

  return { events, ticksPerBeat };
};

const buildTempoMap = (events) => {
  const tempos = events
    .filter((event) => event.type === 'tempo')
    .sort((left, right) => left.tick - right.tick);

  if (!tempos.length || tempos[0].tick !== 0) {
    tempos.unshift({ tick: 0, tempo: DEFAULT_TEMPO });
  }

  return tempos;
};

const createTickConverter = (tempoMap, ticksPerBeat) => {
  const segments = [];
  let seconds = 0;

  for (let index = 0; index < tempoMap.length; index += 1) {
    const current = tempoMap[index];
    const previous = tempoMap[index - 1];

    if (previous) {
      seconds += ((current.tick - previous.tick) * previous.tempo) / ticksPerBeat / 1000000;
    }

    segments.push({ tick: current.tick, tempo: current.tempo, seconds });
  }

  return (tick) => {
    let segment = segments[0];
    for (let index = 1; index < segments.length; index += 1) {
      if (segments[index].tick > tick) break;
      segment = segments[index];
    }

    return segment.seconds + ((tick - segment.tick) * segment.tempo) / ticksPerBeat / 1000000;
  };
};

const eventsToNotes = (events, tickToSeconds) => {
  const activeNotes = new Map();
  const notes = [];

  for (const event of events.sort((left, right) => left.tick - right.tick)) {
    if (event.type !== 0x80 && event.type !== 0x90) {
      continue;
    }

    const key = `${event.channel}:${event.data1}`;
    const isNoteOn = event.type === 0x90 && event.data2 > 0;

    if (isNoteOn) {
      const bucket = activeNotes.get(key) ?? [];
      bucket.push(event);
      activeNotes.set(key, bucket);
      continue;
    }

    const bucket = activeNotes.get(key);
    const startEvent = bucket?.shift();
    if (!startEvent) {
      continue;
    }

    notes.push({
      channel: startEvent.channel,
      note: startEvent.data1,
      velocity: startEvent.data2 / 127,
      start: tickToSeconds(startEvent.tick),
      duration: Math.max(0.04, tickToSeconds(event.tick) - tickToSeconds(startEvent.tick))
    });
  }

  return notes;
};

const noteToFrequency = (note) => 440 * 2 ** ((note - 69) / 12);
const square = (phase) => (phase % 1 < 0.5 ? 1 : -1);
const triangle = (phase) => 4 * Math.abs((phase % 1) - 0.5) - 1;

const envelope = (time, duration) => {
  const attack = 0.008;
  const release = Math.min(0.05, duration * 0.4);

  if (time < attack) {
    return time / attack;
  }

  if (time > duration - release) {
    return Math.max(0, (duration - time) / release);
  }

  return 0.78;
};

const renderNotes = (notes) => {
  const duration = notes.reduce((max, note) => Math.max(max, note.start + note.duration), 0) + 0.5;
  const samples = new Float32Array(Math.ceil(duration * SAMPLE_RATE));

  for (const note of notes) {
    const startSample = Math.max(0, Math.floor(note.start * SAMPLE_RATE));
    const endSample = Math.min(samples.length, Math.ceil((note.start + note.duration) * SAMPLE_RATE));
    const frequency = note.channel === DRUM_CHANNEL ? (note.note < 42 ? 85 : 190) : noteToFrequency(note.note);
    const volume = note.velocity * MASTER_VOLUME * (note.channel === DRUM_CHANNEL ? 0.55 : 1);
    const wave = note.channel === DRUM_CHANNEL ? triangle : square;

    for (let sampleIndex = startSample; sampleIndex < endSample; sampleIndex += 1) {
      const time = (sampleIndex - startSample) / SAMPLE_RATE;
      const phase = frequency * time;
      samples[sampleIndex] += wave(phase) * envelope(time, note.duration) * volume;
    }
  }

  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.max(-0.95, Math.min(0.95, samples[index]));
  }

  return samples;
};

const createWavBuffer = (samples) => {
  const dataLength = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataLength);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);

  for (let index = 0; index < samples.length; index += 1) {
    buffer.writeInt16LE(Math.round(samples[index] * 32767), 44 + index * 2);
  }

  return buffer;
};

const { events, ticksPerBeat } = parseMidi(fs.readFileSync(inputPath));
const tickToSeconds = createTickConverter(buildTempoMap(events), ticksPerBeat);
const notes = eventsToNotes(events, tickToSeconds);
const wavBuffer = createWavBuffer(renderNotes(notes));

fs.writeFileSync(outputPath, wavBuffer);
console.log(`Rendered ${notes.length} notes to ${outputPath}`);
