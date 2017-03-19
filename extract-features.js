/* eslint-disable import/no-extraneous-dependencies, array-callback-return, no-console */

const csv = require('csvtojson');
// const skewness = require('compute-skewness');
const config = require('./locals');
const math = require('mathjs');
const fft = require('jsfft');
const fs = require('fs-extra');
const regression = require('regression');

const csvFilePath = config.csv;

let num = -1;

const STD = 0;
const TREND = 1;
const JUMP = 2;

const data = {};
const titles = {};
const DATA_START = 2;

const scaleTrend = val => {
  const r = val < 0 ? -1 : 1;
  let out = Math.abs(val);
  const limit = 0.8;
  if (out > limit) {
    out = out * (1 - limit) / 400 + limit;
  }
  return r * out;
};

const trend = arr => {
  const a = arr.map((x, i) => [i, x]);
  const result = regression('linear', a);
  return scaleTrend(result.equation[0]);
};

const jumpiness = arr => {
  const n = Math.ceil(arr.length / 2);

  const cdata = new fft.ComplexArray(arr.length).map((value, i) => {
    value.real = arr[i];
  });
  const mdata = [];
  const freq = cdata.FFT();
  freq.map((f, i) => {
    if (i > 0 && i <= n) {
      mdata.push(
        math.divide(
          math.sqrt(
            math.pow(f.real, 2) + math.pow(f.imag, 2)
          ), n
        )
      );
    }
  });
  return trend(mdata);
};

const setLimit = (l, i, v) => {
  if (v > l[i][1]) {
    l[i][1] = v;
  }
  if (v < l[i][0] && v !== 0) {
    l[i][0] = v;
  }
};

const OMIT = ['World', 'European Union (15)', 'European Union (28)'];

csv()
.fromFile(csvFilePath)
.on('csv', obj => {
  ++num;
  if (num === 1) {
    obj.forEach((title, i) => {
      if (i >= DATA_START && !OMIT.includes(title)) {
        titles[i] = title;
      }
    });
  } else if (num > 1) {
    const country = obj[0];
    if (!OMIT.includes(country)) {
      if (!data[country]) {
        data[country] = {};
        Object.keys(titles).forEach(i => {
          data[country][i] = {
            data: []
          };
        });
      }
      for (let j = DATA_START; j < obj.length; ++j) {
        data[country][j].data.push(Number(obj[j]));
      }
    }
  }
})
.on('done', err => {
  if (err) {
    throw err;
  }
  const limits = [
    [1000, 0],
    [1000, 0],
    [1000, 0],
  ];
  Object.keys(data).forEach(country => {
    Object.keys(data[country]).forEach(metric => {
      const item = data[country][metric];
      item.trend = trend(item.data);
      // item.std = math.std(math.divide(item.data, math.max(item.data)));
      item.std = math.std(item.data);
      item.jumpiness = jumpiness(item.data);
      setLimit(limits, JUMP, item.jumpiness);
      setLimit(limits, TREND, item.trend);
      setLimit(limits, STD, item.std);
    });
  });
  console.log(limits);
  Object.keys(data).forEach(country => {
    Object.keys(data[country]).forEach(metric => {
      const item = data[country][metric];
      if (item.std !== 0 && (limits[STD][1] === item.std || limits[STD][0] === item.std)) {
        // console.log(country, item);
      }
      if (metric === '8') {
        // console.log(metric, item.trend);
      }
      /* const j = item.jumpiness === 0 ? 0 : (item.jumpiness - limits[JUMP][0]) /
        (limits[JUMP][1] - limits[JUMP][0]); */
      // const s = !item.trend ? 0 : item.trend / limits[TREND][1];
      data[country][metric] = [item.std, item.trend, item.jumpiness];
    });
  });
  fs.writeJson('./assets/data.json', {
    titles,
    data,
  }, {spaces: 0}, err2 => {
    if (err2) {
      console.error(err2);
    } else {
      console.log('success!');
    }
  });
});
