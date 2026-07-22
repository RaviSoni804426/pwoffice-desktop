const fs = require('fs');
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default || pngToIcoModule;

const inputPng = 'C:/pwoffice-project/pwoffice-webapp/public/images/pw-logo.png';
const outputIco = 'C:/pwoffice-desktop/build/icon.ico';

pngToIco([inputPng])
  .then(buf => {
    fs.writeFileSync(outputIco, buf);
    console.log('Icon successfully created at: ' + outputIco);
  })
  .catch(err => {
    console.error('Failed to convert PNG to ICO:', err);
    process.exit(1);
  });
