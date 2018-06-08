const { NodeFileUtils } = require('./node-file-utils');
const { AureliaCompiler, Parser } = require('../dist/aurelia-compiler');

console.time('Compilation');
(async () => {
  try {
    let compiler = new AureliaCompiler(new NodeFileUtils());
    compiler.start({
      globalResources: 'src/framework/resources',
      entry: 'src/app.au',
      outputDir: 'src/dist'
    });
    // console.log({ factory: factory.templateFactories[0].dependencies });
    // require('fs').writeFileSync('src/app.au.js', mainModule.toString(), 'utf-8');
    const success = await compiler.emitAll();
    require('fs').writeFileSync('src/asts.js', Parser.generateAst(), 'utf-8');
    console.timeEnd('Compilation');
    console.log(`Compiled ${success ? 'Successfully' : 'Unsuccessfully'}`);
  } catch (ex) {
    console.log('Compilation error\n================');
    console.log(ex);
    console.timeEnd('Compilation');
  }
})();
