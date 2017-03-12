import startTick from './worker';
import {createAudioContext, createMixer} from './audio';
import playNote from './player';
import loadSample from './loader';
import initGenerators, {getParams, brightnessToScale} from './generator';

const rootContext = createAudioContext();
const tracks = createMixer(rootContext, {
  PEDAL0: {gain: 0.4},
  PEDAL1: {gain: 0.4},
  PAD0: {gain: 0.3},
  PAD1: {gain: 0.3},
  PAD2: {gain: 0.3},
  PAD3: {gain: 0.3},
  PERC: {gain: 0.6},
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
];
samples.forEach(name => loadSample(rootContext, buffers, name));

let generators = [];

const SCHEDULE_AHEAD = 0.1;
const tempo = 120;
const noteLength = 0.25;
let playing = false;

const p = document.createElement('p');
const ptext = document.createTextNode('');
p.appendChild(ptext);
document.body.appendChild(p);

const showParams = params => {
  const brightness = params.PAD.brightness;
  const scaleName = brightnessToScale(brightness).name;
  ptext.nodeValue = `brightness: ${brightness} (${scaleName})`;
};

const reroll = () => {
  const params = getParams();
  generators = initGenerators(rootContext, buffers, tracks, params);
  showParams(params);
};

const btn = document.createElement('button');
const text = document.createTextNode('change it');
btn.appendChild(text);
document.body.appendChild(btn);
btn.addEventListener('click', () => {
  playing = false;
  reroll();
  setTimeout(() => {
    playing = true;
  }, 1000);
});

const a = document.createElement('a');
const atext = document.createTextNode('github');
a.appendChild(atext);
a.href = 'https://github.com/apvilkko/climate-music';
document.body.appendChild(document.createElement('br'));
document.body.appendChild(a);

reroll();

const onTick = ctx => {
  const timer = ctx.currentTime + SCHEDULE_AHEAD;
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
        if (playing) {
          playNote(ctx, buffer, tempo, destination, nextNote);
        }
      }
    }
  });
};

const startWorker = () => {
  startTick(rootContext, onTick);
};

startWorker();
setTimeout(() => {
  playing = true;
}, 1000);
