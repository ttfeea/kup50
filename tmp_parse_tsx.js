
const ts = require('typescript');
const fs = require('fs');
const path = process.argv[1];
const text = fs.readFileSync(path,'utf8');
const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
console.log(sf.parseDiagnostics.length);
sf.parseDiagnostics.forEach(d=>{
  const pos = sf.getLineAndCharacterOfPosition(d.start);
  console.log(`${pos.line+1}:${pos.character+1}: ${d.messageText}`);
  console.log(JSON.stringify(text.slice(d.start, d.start+120)));
});
