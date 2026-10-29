const upstream=require('./camera-cost-fixture.cjs');
module.exports={...upstream,B:require('./world-horizon-fixture.cjs').B+'/gameplay'};
