import startTick from './worker';
import {createAudioContext, createMixer} from './audio';
import playNote from './player';
import loadSample from './loader';
import initGenerators, {getParams} from './generator';
import {sample} from './random';

import './styles.css';

const rootContext = createAudioContext();
const tracks = createMixer(rootContext, {
  PEDAL0: {gain: 0.5},
  PEDAL1: {gain: 0.5},
  PAD0: {gain: 0.3},
  PAD1: {gain: 0.3},
  PAD2: {gain: 0.3},
  PAD3: {gain: 0.3},
  PERC: {gain: 0.5},
});
const buffers = {};
const samples = [
  'bass1',
  'bass2',
  'bass3',
  'bass4',
  'pad1',
  'pad2',
  'pad3',
  'pad4',
  'pad5',
  'pad6',
  'perc1',
  'perc2',
  'perc3',
  'perc4',
  'perc5',
  'perc6',
];
samples.forEach(name => loadSample(rootContext, buffers, name));

let rawData;
let currentCountry;
let generators = [];

const SCHEDULE_AHEAD = 0.1;
const tempo = 120;
const noteLength = 0.25;
let playing = false;

const p = document.getElementById('playing');
const ptext = document.createTextNode('');
p.appendChild(ptext);

const showParams = (/* params */) => {
  // const brightness = params.PAD.brightness;
  // const scaleName = brightnessToScale(brightness).name;
  // ptext.nodeValue = `Playing "${currentCountry}"`;
};

const reroll = () => {
  const params = getParams(rawData, currentCountry);
  generators = initGenerators(generators, rootContext, buffers, tracks, params);
  showParams(params);
};

const getSelected = () => document.getElementById('select-country').value;

const countryChanged = () => {
  document.getElementById('select-country').value = currentCountry;
  playing = false;
  reroll();
  setTimeout(() => {
    playing = true;
  }, 1000);
};

const setupUi = data => {
  const select = document.getElementById('select-country');
  const countries = Object.keys(data.data);
  currentCountry = sample(countries);
  countries.forEach(country => {
    const option = document.createElement('option');
    const otext = document.createTextNode(country);
    option.appendChild(otext);
    option.value = country;
    select.appendChild(option);
  });
  select.addEventListener('change', () => {
    currentCountry = getSelected();
    countryChanged();
  });

  const btn = document.getElementById('random');
  btn.addEventListener('click', () => {
    currentCountry = sample(countries);
    countryChanged();
  });
};

const onTick = ctx => {
  const timer = ctx.currentTime + SCHEDULE_AHEAD;
  if (!playing) {
    return;
  }
  generators.forEach(gen => {
    const nextNoteTime = gen.nextNoteTime;
    if (nextNoteTime < timer) {
      const nextNote = gen.gen.next().value;
      const noteLen = nextNote.length * noteLength;
      gen.nextNoteTime += (noteLen * (60.0 / tempo));
      const buffer = buffers[nextNote.sample];
      const destination = tracks[nextNote.track];
      if (nextNote.velocity) {
        if (destination.inserts.length > 0) {
          destination.inserts[0].effect.frequency.value =
            nextNote.filterFrequency;
        }
        if (nextNoteTime > 0) {
          playNote(ctx, buffer, tempo, destination, nextNote);
        }
      }
    }
  });
};

const startWorker = () => {
  startTick(rootContext, onTick);
};

fetch('data.json').then(response => {
  response.json().then(data => {
    rawData = data;
    setupUi(rawData);
    startWorker();
    countryChanged();
  });
});
