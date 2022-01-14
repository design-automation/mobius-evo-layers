// import * as main from './nodejs/index.js';
const main = require('./nodejs/main.js')

const fileName = 'test09-a'
const inpfile = 'https://raw.githubusercontent.com/phuongtung1/test_repo/master/test_mb/' + fileName;
main.runJavascriptFile({
    // file: 'https://raw.githubusercontent.com/phuongtung1/test_repo/master/test09',
    // parameter: {"RAND_SEED":"0.279","PLOT_RATIO":"6.2","MIN_NUM_FLOORS":5,"MAX_NUM_FLOORS":10,"NUM_CONSTRAINTS":"three_constraints"}
    file: inpfile,
})