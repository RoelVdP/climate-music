/* eslint-disable import/no-extraneous-dependencies */

const csv = require('csvtojson');
const skewness = require('compute-skewness');
const config = require('./locals');
const math = require('mathjs');

const csvFilePath = config.csv;

let num = -1;

const data = {};
const titles = {};
const DATA_START = 2;

const jumpiness = arr => {
  const sqDiff = arr.map((x, i) => {
    if (i === 0) return 0;
    return math.pow(x - arr[i - 1], 2);
  });
  const a = math.sqrt(math.sum(sqDiff));
  const b = math.add(math.abs(math.max(arr) - math.min(arr)), 0.001);
  const ret = math.divide(a, b);
  return ret;
};

csv()
.fromFile(csvFilePath)
.on('csv', obj => {
  ++num;
  if (num === 1) {
    obj.forEach((title, i) => {
      if (i >= DATA_START) {
        titles[i] = title;
      }
    });
  } else if (num > 1) {
    const country = obj[0];
    if (!data[country]) {
      data[country] = {};
      Object.keys(titles).forEach(i => {
        data[country][titles[i]] = {
          data: []
        };
      });
    }
    for (let j = DATA_START; j < obj.length; ++j) {
      data[country][titles[j]].data.push(obj[j]);
    }
  }
})
.on('done', err => {
  if (err) {
    throw err;
  }
  Object.keys(data).forEach(country => {
    Object.keys(data[country]).forEach(metric => {
      const item = data[country][metric];
      item.skewness = skewness(item.data);
      item.std = math.std(item.data);
      item.jumpiness = jumpiness(item.data);
    });
  });
  console.log(data.Finland);
});
