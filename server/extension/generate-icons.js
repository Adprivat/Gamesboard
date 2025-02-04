const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [24, 32, 100];
const iconDir = path.join(__dirname, 'icons');

// Erstelle Icons-Verzeichnis, falls es nicht existiert
if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
}

// Konvertiere SVG zu PNG in verschiedenen Größen
async function generateIcons() {
    const svgPath = path.join(iconDir, 'icon.svg');
    
    for (const size of sizes) {
        const outputPath = path.join(iconDir, `icon-${size}.png`);
        
        await sharp(svgPath)
            .resize(size, size)
            .png()
            .toFile(outputPath);
        
        console.log(`Icon ${size}x${size} wurde erstellt: ${outputPath}`);
    }
}

generateIcons().catch(console.error); 