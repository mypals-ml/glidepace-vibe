/**
 * Generate app icon PNGs from SVG source using sharp.
 * Run: node scripts/generate-icons.cjs
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const svgPath = path.join(publicDir, 'icon-source.svg');
const svgContent = fs.readFileSync(svgPath, 'utf-8');

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.log('Installing sharp...');
    execSync('npm install sharp --no-save', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    sharp = require('sharp');
  }

  const sizes = [
    { name: 'android-chrome-512x512.png', size: 512, transparent: false },
    { name: 'android-chrome-192x192.png', size: 192, transparent: false },
    { name: 'apple-touch-icon.png', size: 180, transparent: false },
    { name: 'favicon-32x32.png', size: 32, transparent: true },
    { name: 'favicon-16x16.png', size: 16, transparent: true },
  ];

  for (const { name, size, transparent } of sizes) {
    const outPath = path.join(publicDir, name);
    
    let currentSvg = svgContent;
    if (transparent) {
      // Remove the background rect for transparent icons
      currentSvg = svgContent.replace(/<rect [^>]*fill="white"[^>]*\/>/i, '');
    }

    await sharp(Buffer.from(currentSvg), { density: 300 })
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`✅ Generated ${name} (${size}x${size})${transparent ? ' (transparent)' : ''}`);
  }

  // Generate favicon.ico from the 32x32 and 16x16 PNGs using png-to-ico
  try {
    let pngToIco;
    try {
      pngToIco = require('png-to-ico');
    } catch (e) {
      console.log('Installing png-to-ico...');
      execSync('npm install png-to-ico --no-save', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
      pngToIco = require('png-to-ico');
    }
    // png-to-ico expects file paths as arguments
    const ico = await pngToIco([
      path.join(publicDir, 'favicon-32x32.png'),
      path.join(publicDir, 'favicon-16x16.png'),
    ]);
    fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico);
    console.log('✅ Generated favicon.ico');
  } catch (e) {
    console.warn('⚠️  Could not generate favicon.ico:', e.message);
    // Fallback: copy 32x32 png as ico
    fs.copyFileSync(
      path.join(publicDir, 'favicon-32x32.png'),
      path.join(publicDir, 'favicon.ico')
    );
    console.log('✅ Generated favicon.ico (fallback: copied from 32x32 PNG)');
  }

  console.log('\nDone! All icons generated.');
}

main().catch(console.error);
