const upstream=require('./camera-cost-fixture.cjs');
module.exports={...upstream,B:require('./forest-render-fixture.cjs').B+'/gameplay'};
