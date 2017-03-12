import createVCA from './vca';
import {connect, disconnect} from './util';
import createCompressor from './compressor';

export const createAudioContext = () =>
  new (window.AudioContext || window.webkitAudioContext)();

export const createInsertEffect = ({
  context, effect, dryGain = 1, wetGain = 0.5
}) => {
  const dry = createVCA({context, gain: dryGain});
  const wet = createVCA({context, gain: wetGain});
  const input = createVCA({context, gain: 1});
  const output = createVCA({context, gain: 1});
  connect(input, dry);
  connect(input, effect);
  connect(effect, wet);
  connect(wet, output);
  connect(dry, output);
  return {
    dry,
    wet,
    effect,
    input,
    output,
  };
};

export const getMixBus = tracks => tracks.master.mixBus;

export const addInsert = (ctx, tracks, key, insertEffect, index = -1) => {
  const inserts = tracks[key].inserts;
  const dest = getMixBus(tracks);
  const pos = index < 0 ? inserts.length : index;
  const addingToEnd = pos === inserts.length;
  if (pos > 0) {
    const next = addingToEnd ? dest : inserts[pos];
    try {
      disconnect(inserts[pos - 1], next);
    } catch (err) {
      console.log(err); // eslint-disable-line no-console
    }
    connect(inserts[pos - 1], insertEffect);
  }
  if (inserts.length === 0) {
    try {
      disconnect(tracks[key].gain, dest);
    } catch (err) {
      console.log(err); // eslint-disable-line no-console
    }
    connect(tracks[key].gain, insertEffect);
  }
  const next = pos >= (inserts.length - 1) ? dest : inserts[pos + 1];
  connect(insertEffect, next);
  tracks[key].inserts =
    [...inserts.slice(0, pos), insertEffect, ...inserts.slice(pos + 1)];
};

const createTrack = spec => ({...spec, inserts: []});

export const createMixer = (context, trackSpec) => {
  const masterGain = createVCA({
    context, gain: 1, destination: context.destination
  });
  const masterLimiter = createCompressor({
    context, destination: masterGain
  });
  const mixBus = createVCA({
    context, gain: 0.4, destination: masterLimiter
  });
  const tracks = {
    master: createTrack({
      gain: masterGain,
      limiter: masterLimiter,
      mixBus,
    }),
  };
  Object.keys(trackSpec).forEach(track => {
    const gainValue = trackSpec[track].gain || 0.6;
    tracks[track] = createTrack({
      gain: createVCA({
        context,
        gain: gainValue,
        destination: mixBus
      }),
      gainValue,
    });
  });
  return tracks;
};
