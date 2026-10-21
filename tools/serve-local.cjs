// Local authoring server: game + review artifacts + shared classroom API.
// node tools/serve-local.cjs [port]; binds only this PC.
const {createAppServer}=require('../server/app.cjs');
const port=Number(process.argv[2]||5500);
createAppServer({allowReview:true}).listen(port,'127.0.0.1',()=>console.log(`Mumu Planet + classroom rooms: http://127.0.0.1:${port}`));
