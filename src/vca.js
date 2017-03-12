import {connect} from './util';

export default ({context, gain = 0.5, destination}) => {
  const node = context.createGain();
  node.gain.value = gain;
  if (destination) {
    connect(node, destination);
  }
  return node;
};
