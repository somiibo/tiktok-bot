  // Modules
const os = require('os');
const fs = require('fs-jetpack');
const path = require('path');
const fetch = require('wonderful-fetch');
const downloads = require('downloads-folder');
const util = require('util');
const execute = util.promisify(require('child_process').exec);

// Main
module.exports = async function () {
  // Options
  const url = getURL();
  const location = path.join(downloads(), url.split('/').slice(-1)[0]);
  const interval = setInterval(() => {
    log('Still downloading, please be patient! :)');
  }, 3000);

  // Clear
  fs.remove(location)

  log(`Downloading app to ${location}`)

  // Process
  const res = await fetch(url);
  const fileStream = fs.createWriteStream(location);
  
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on('error', reject);

    fileStream.on('finish', resolve);
  })
  .then((r) => {
    log('Download finished!');

    launch(location);
  })
  .catch((e) => {
    error('Download failed!', e);
  })
  .finally(() => {
    clearInterval(interval);
  })

  return
};

if (require.main === module) {
  module.exports();
}

function getURL() {
  const name = os.type();

  if (name === 'Darwin') {
    return 'https://github.com/somiibo/download-server/releases/download/installer/Somiibo.dmg'
  } else if (name === 'Windows_NT') {
    return 'https://github.com/somiibo/download-server/releases/download/installer/Somiibo-Setup.exe'
  } else {
    return 'https://github.com/somiibo/download-server/releases/download/installer/Somiibo_amd64.deb'
  }  
}

function launch(location) {  
  const name = os.type();

  try {
    if (name === 'Darwin') {
      execute(`open "${location}"`)
        .then(() => {
          
        })
    } else if (name === 'Windows_NT') {
      execute(`"${location}"`)
        .then(() => {
          
        })
    } else {
      execute(`sudo apt install "${location}"`)
        .then(() => {
          execute(`restart-manager`).catch(e => {console.error(e)})    
        })    
    }    
  } catch (e) {
    error('Application failed to execute:', e);
    console.log('\n\n\n')
    log(`Please launch the app manually: ${location}`);    
  }
}

function log() {
  console.log(`[${new Date().toLocaleTimeString()}]`, ...arguments)
}

function error() {
  console.error(`[${new Date().toLocaleTimeString()}]`, ...arguments)
}
