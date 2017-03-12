import {randRange, randFloat, rand, sample as randSample} from './random';
import {addInsert, createInsertEffect} from './audio';
import createReverb from './reverb';
import {createFeedbackDelay} from './delay';
import loadSample from './loader';
import createFilter from './filter';

export const getParams = () => ({
  PEDAL: {
    pitch: [-7, 4],
    reverb: [1, 4],
    sample: [1, 4],
    length: [12, 64],
    velocity: [100, 127],
    attack: [0.1, 1.0],
    delayTime: [0.5, 1.5],
    reverbDry: [0.5, 0.8],
    reverbWet: [0.7, 0.95],
    delayWet: [0.5, 0.8],
    filterFrequency: [100, 5000],
  },
  PAD: {
    brightness: randFloat(0.0, 1.0),
    reverb: [1, 4],
    pitch: [-7, 4],
    sample: [1, 6],
    length: [32, 128],
    velocity: [30, 127],
    attack: [0.5, 1.0],
    delayTime: [0.5, 1.5],
    reverbDry: [0.5, 0.8],
    reverbWet: [0.7, 0.95],
    delayWet: [0.5, 0.8],
    filterFrequency: [300, 8000],
  },
  PERC: {
    pitch: [-12, 12],
    reverb: [1, 4],
    sample: [1, 4],
    length: [70, 200],
    velocity: [32, 127],
    feedback: [0.5, 0.8],
    delayTime: [0.5, 1.5],
    reverbDry: [0.5, 0.8],
    reverbWet: [0.7, 0.95],
    delayWet: [0.5, 0.8],
    filterFrequency: [1000, 16000],
  }
});

const commonNote = p => ({
  length: randRange(p.length),
  velocity: randRange(p.velocity),
  filterFrequency: randRange(p.filterFrequency),
});

function* generatePedal(params, root) {
  const p = params.PEDAL;
  let channel = 0;
  const pitch = root;
  const sample = `bass${randRange(p.sample)}`;
  while (true) {
    channel = ++channel % 2;
    yield {
      ...commonNote(p),
      pitch,
      track: `PEDAL${channel}`,
      attack: randFloat(p.attack),
      sample,
    };
  }
}

const SCALES = [
  {name: 'locrian', priority: [0, 1, 6], rest: [3, 5, 8, 10]},
  {name: 'phrygian', priority: [0, 1, 3], rest: [5, 7, 8, 10]},
  {name: 'aeolian', priority: [0, 7, 8, 3], rest: [2, 5, 10]},
  {name: 'dorian', priority: [0, 10, 3, 5, 9], rest: [2, 7]},
  {name: 'mixolydian', priority: [0, 10, 4, 9], rest: [2, 5, 7]},
  {name: 'ionian', priority: [0, 11, 4], rest: [2, 5, 7, 9]},
  {name: 'lydian', priority: [0, 6, 7, 2, 4], rest: [9, 11]},
];

export const brightnessToScale = brightness =>
  SCALES[Math.floor(brightness * 7)];

const getPadNote = (root, p) => {
  const scale = brightnessToScale(p.brightness);
  const note = rand(30) ? randSample(scale.rest) : randSample(scale.priority);
  return root + note + randRange(0, 1) * 12;
};

function* generatePad(params, root) {
  const p = params.PAD;
  let channel = 0;
  const sample = `pad${randRange(p.sample)}`;
  let clusterMode = false;
  let clusterAmount = 0;
  let maxCluster = 0;
  while (true) {
    channel = ++channel % 4;
    const note = {
      ...commonNote(p),
      pitch: getPadNote(root, p),
      track: `PAD${channel}`,
      attack: randFloat(p.attack),
      sample,
    };
    if (!clusterMode) {
      if (rand(20)) {
        clusterMode = true;
        clusterAmount = 0;
        maxCluster = randRange(2, 5);
      }
    }
    if (clusterMode) {
      note.length = randRange(1, 4);
      note.velocity = randRange(50, 90);
      clusterAmount++;
      if (clusterAmount > maxCluster) {
        clusterMode = false;
      }
    }
    yield note;
  }
}

function* generatePerc(params) {
  const p = params.PERC;
  const sample = `perc${randRange(p.sample)}`;
  const pitch = randRange(p.pitch);
  while (true) {
    yield {
      ...commonNote(p),
      pitch,
      sample,
      track: 'PERC',
    };
  }
}

const channelToParam = channel => channel.replace(/\d/g, '');

const param = (params, key, defaultValue) =>
  (params[key] ? randFloat(params[key]) : defaultValue);

const addEffects = (context, buffers, tracks, params, channels) => {
  const common = {context};
  const p = params[channelToParam(channels[0])];
  channels.forEach(channel => {
    const filter = createFilter({
      ...common,
      frequency: param(p, 'filterFrequency', 16000),
    });
    const insertFilter = createInsertEffect({
      ...common,
      effect: filter,
      dryGain: 0,
      wetGain: 1,
    });
    addInsert(context, tracks, channel, insertFilter, 0);

    const delay = createFeedbackDelay({
      ...common,
      delayTime: param(p, 'delayTime', 0.9),
      feedback: param(p, 'feedback', 0.6),
    });
    const insertDelay = createInsertEffect({
      ...common,
      effect: delay,
      dryGain: 1,
      wetGain: param(p, 'delayWet', 0.7),
    });
    addInsert(context, tracks, channel, insertDelay, 1);

    const reverb = createReverb({...common, buffer: buffers.impulse1});
    const insertReverb = createInsertEffect({
      ...common,
      effect: reverb,
      dryGain: param(p, 'reverbDry', 0.6),
      wetGain: param(p, 'reverbWet', 0.6),
    });

    addInsert(context, tracks, channel, insertReverb, 2);
  });
};

const initGenerators = (context, buffers, tracks, params) => {
  loadSample(context, buffers, `impulse${randRange(params.PEDAL.reverb)}`)
  .then(() => {
    addEffects(context, buffers, tracks, params, ['PEDAL0', 'PEDAL1']);
  });

  loadSample(context, buffers, `impulse${randRange(params.PAD.reverb)}`)
  .then(() => {
    addEffects(context, buffers, tracks, params,
      ['PAD0', 'PAD1', 'PAD2', 'PAD3']);
  });

  loadSample(context, buffers, `impulse${randRange(params.PERC.reverb)}`)
  .then(() => {
    addEffects(context, buffers, tracks, params, ['PERC']);
  });

  const root = randRange(params.PEDAL.pitch);

  return [
    generatePedal(params, root),
    generatePad(params, root),
    generatePerc(params),
  ].map(gen => ({gen, nextNoteTime: 0}));
};

export default initGenerators;
