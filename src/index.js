const { exec } = require('child_process');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');
const os = require('os');
const path = require('path');
const pkg = require('../package.json');

const PLATFORM_MAP = {
  darwin: 'mac',
  win32: 'windows',
  linux: 'linux',
};

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

function getDownloadsFolder() {
  return path.join(os.homedir(), 'Downloads');
}

function launchFile(filePath) {
  const platform = os.platform();
  log(`Launching ${filePath}...`);

  if (platform === 'darwin') {
    exec(`open "${filePath}"`);
  } else if (platform === 'win32') {
    exec(`start "" "${filePath}"`);
  } else {
    exec(`xdg-open "${filePath}"`);
  }
}

async function main() {
  const platform = os.platform();
  const platformKey = PLATFORM_MAP[platform] || 'linux';

  log(`${pkg.name} v${pkg.version}`);
  log(`Platform: ${platform} (${platformKey})`);

  // Fetch download URLs from the website's config.json
  const siteUrl = new URL(pkg.homepage).origin;
  const configUrl = `${siteUrl}/config.json`;
  log(`Fetching download info from ${configUrl}...`);

  const configRes = await fetch(configUrl);

  if (!configRes.ok) {
    throw new Error(`Failed to fetch config: ${configRes.status} ${configRes.statusText}`);
  }

  const config = await configRes.json();
  const downloads = config.download || {};
  const platformDownloads = downloads[platformKey];

  if (!platformDownloads) {
    throw new Error(`No downloads available for ${platformKey}`);
  }

  const url = platformDownloads.universal || platformDownloads.debian || '';

  if (!url) {
    throw new Error(`No download URL found for ${platformKey}`);
  }

  log(`Download URL: ${url}`);

  // Download the file
  const fileName = url.split('/').pop();
  const filePath = path.join(getDownloadsFolder(), fileName);

  log(`Downloading to ${filePath}...`);

  const downloadRes = await fetch(url);

  if (!downloadRes.ok) {
    throw new Error(`Download failed: ${downloadRes.status} ${downloadRes.statusText}`);
  }

  const fileStream = createWriteStream(filePath);
  await pipeline(downloadRes.body, fileStream);

  log(`Download complete: ${fileName}`);

  // Install and launch
  if (platform === 'darwin' && fileName.endsWith('.dmg')) {
    log('Mounting DMG...');
    const { execSync } = require('child_process');
    const mountOutput = execSync(`hdiutil attach "${filePath}" -nobrowse`, { encoding: 'utf8' });
    const mountPoint = mountOutput.split('\t').pop().trim();
    log(`Mounted at ${mountPoint}`);

    const appName = require('fs').readdirSync(mountPoint).find((f) => f.endsWith('.app'));

    if (appName) {
      const appSource = path.join(mountPoint, appName);
      const appDest = path.join('/Applications', appName);
      log(`Copying ${appName} to /Applications...`);
      execSync(`cp -R "${appSource}" "${appDest}"`);
      log('Launching app...');
      exec(`open "${appDest}"`);
      log(`Ejecting ${mountPoint}...`);
      exec(`hdiutil detach "${mountPoint}"`);
    } else {
      log('No .app found in DMG, opening manually...');
      launchFile(filePath);
    }
  } else {
    launchFile(filePath);
  }

  log('Done!');
}

main().catch((err) => {
  console.error(`[${new Date().toLocaleTimeString()}] Error: ${err.message}`);
  console.log(`\nVisit ${pkg.homepage} to download manually.`);
  process.exit(1);
});
