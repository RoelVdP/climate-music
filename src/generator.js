import {
  randRange, randFloat, rand, sample as randSample, shuffle
} from './random';
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
    sample: [1, 6],
    length: [70, 200],
    velocity: [32, 127],
    feedback: [0.5, 0.8],
    delayTime: [0.5, 1.5],
    reverbDry: [0.3, 0.7],
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

const getOrderedScale = p => {
  const scale = brightnessToScale(p.brightness);
  return scale.priority.concat(scale.rest).sort((a, b) => a - b);
};

const getRawNote = (p, anywhere) => {
  const scale = brightnessToScale(p.brightness);
  return anywhere ? randSample(scale.priority.concat(scale.rest)) : (
    rand(30) ? randSample(scale.rest) : randSample(scale.priority)
  );
};

const getPadNote = (root, p) =>
  root + getRawNote(p) + randRange(0, 1) * 12;

const getNoteFromScale = (scale, distance) => {
  let index = distance;
  let readjust = 0;
  if (index > (scale.length - 1)) {
    index -= scale.length;
    readjust = 12;
  }
  return scale[index] + readjust;
};

const getTriad = (root, p, len) => {
  const notes = [];
  const first = getRawNote(p, true);
  notes.push(first);
  const scale = getOrderedScale(p);
  const firstIndex = scale.indexOf(first);
  const skewLeft = rand(50);
  const distance2 = firstIndex + 1;
  const distance3 = firstIndex + randRange(4, 6);
  const note2 = getNoteFromScale(scale, distance2);
  const note3 = getNoteFromScale(scale, distance3);
  notes.push(skewLeft ? note2 : note3);
  notes.push(skewLeft ? note3 : note2);
  const line = shuffle(notes);
  for (let i = line.length; i < len; ++i) {
    line.push(randSample(notes));
  }
  const octaveShift = randRange(-2, 1) * 12;
  let adjusted = line.map(i => root + i + octaveShift);
  if (Math.max(...adjusted) > 19) {
    adjusted = adjusted.map(i => i - 12);
  }
  if (Math.min(...adjusted) < -7) {
    adjusted = adjusted.map(i => i + 12);
  }
  return adjusted;
};

const P_CLUSTER = 20;
const P_TRIAD = 50;

function* generatePad(params, root) {
  const p = params.PAD;
  let channel = 0;
  const sample = `pad${randRange(p.sample)}`;
  const clusterMode = {};
  while (true) {
    channel = ++channel % 4;
    const note = {
      ...commonNote(p),
      pitch: getPadNote(root, p),
      track: `PAD${channel}`,
      attack: randFloat(p.attack),
      sample,
    };
    if (!clusterMode.active) {
      if (rand(P_CLUSTER)) {
        clusterMode.active = true;
        clusterMode.max = randRange(clusterMode.triad ? 3 : 2, 5);
        clusterMode.triad = rand(P_TRIAD) ?
          getTriad(root, p, clusterMode.max) : null;
        clusterMode.amount = 0;
      }
    }
    if (clusterMode.active) {
      if (clusterMode.triad) {
        note.pitch = clusterMode.triad[clusterMode.amount];
        note.length = randRange(4, 16);
      } else {
        note.length = randRange(1, 4);
      }
      note.velocity = randRange(50, 90);
      clusterMode.amount++;
      if (clusterMode.amount > clusterMode.max) {
        clusterMode.active = false;
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

const addEffects = (context, buffer, tracks, params, channels) => {
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

    const reverb = createReverb({...common, buffer});
    const insertReverb = createInsertEffect({
      ...common,
      effect: reverb,
      dryGain: param(p, 'reverbDry', 0.6),
      wetGain: param(p, 'reverbWet', 0.6),
    });

    addInsert(context, tracks, channel, insertReverb, 2);
  });
};

const initGenerators = (oldGenerators, context, buffers, tracks, params) => {
  let buffer = `impulse${randRange(params.PEDAL.reverb)}`;
  loadSample(context, buffers, buffer)
  .then(() => {
    addEffects(context, buffers[buffer], tracks, params, ['PEDAL0', 'PEDAL1']);
  });

  buffer = `impulse${randRange(params.PAD.reverb)}`;
  loadSample(context, buffers, buffer)
  .then(() => {
    addEffects(context, buffers[buffer], tracks, params,
      ['PAD0', 'PAD1', 'PAD2', 'PAD3']);
  });

  buffer = `impulse${randRange(params.PERC.reverb)}`;
  loadSample(context, buffers, buffer)
  .then(() => {
    addEffects(context, buffers[buffer], tracks, params, ['PERC']);
  });

  const root = randRange(params.PEDAL.pitch);

  return [
    generatePedal(params, root),
    generatePad(params, root),
    generatePerc(params),
  ].map((gen, i) => ({
    gen,
    nextNoteTime: oldGenerators.length > i ? oldGenerators[i].nextNoteTime : 0,
  }));
};

export default initGenerators;
