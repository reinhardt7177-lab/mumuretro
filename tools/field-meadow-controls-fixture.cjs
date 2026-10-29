const upstream=require('./camera-cost-fixture.cjs');
module.exports={...upstream,B:require('./field-meadow-fixture.cjs').B+'/gameplay'};
