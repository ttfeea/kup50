
const ts = require('typescript');
const configPath = ts.findConfigFile('./', ts.sys.fileExists, 'tsconfig.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, './');
const program = ts.createProgram({ rootNames: ['frontend/src/pages/ReportDetailPage.tsx'], options: parsed.options });
const diagnostics = ts.getPreEmitDiagnostics(program);
console.log(diagnostics.length);
for (const d of diagnostics) {
  const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
  const pos = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start) : null;
  console.log(pos ? `${pos.line+1}:${pos.character+1}: ${message}` : message);
  if (d.file && d.start !== undefined) {
    console.log(JSON.stringify(d.file.text.slice(d.start, d.start + 120)));
  }
}
