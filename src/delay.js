import {connect} from './util';
import createVCA from './vca';
import createFilter from './filter';
import createWidener from './widener';

export const createDelay = ({context, destination, delayTime}) => {
  const node = context.createDelay(2);
  node.delayTime.value = delayTime;
  if (destination) {
    connect(node, destination);
  }
  return node;
};

export const createFeedbackDelay = ({
  context, destination, delayTime, filterFrequency = 2000, feedback = 0.6,
}) => {
  const node = {};
  node.mixBus = createVCA({context, gain: 1});
  node.delay = createDelay({context, delayTime});
  node.filter = createFilter({context, frequency: filterFrequency});
  node.feedback = createVCA({context, gain: feedback});
  node.widener = createWidener({context});
  node.input = node.delay;
  connect(node.delay, node.filter);
  connect(node.filter, node.feedback);
  connect(node.feedback, node.delay);
  connect(node.filter, node.widener);
  connect(node.widener, node.mixBus);
  node.output = node.mixBus;
  if (destination) {
    connect(node.output, destination);
  }
  return node;
};
