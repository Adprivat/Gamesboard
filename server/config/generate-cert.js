const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

// Generiere ein selbst-signiertes Zertifikat
function generateCertificate() {
    // Generiere Schlüsselpaar
    const keys = forge.pki.rsa.generateKeyPair(2048);
    
    // Erstelle Zertifikat
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    
    const attrs = [{
        name: 'commonName',
        value: 'localhost'
    }, {
        name: 'countryName',
        value: 'DE'
    }, {
        shortName: 'ST',
        value: 'Berlin'
    }, {
        name: 'localityName',
        value: 'Berlin'
    }, {
        name: 'organizationName',
        value: 'GamesBoard'
    }, {
        shortName: 'OU',
        value: 'Development'
    }];
    
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    
    // Selbst-signieren
    cert.sign(keys.privateKey);
    
    // Speichere Zertifikate
    const certPem = forge.pki.certificateToPem(cert);
    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
    
    fs.writeFileSync(path.join(__dirname, 'cert.pem'), certPem);
    fs.writeFileSync(path.join(__dirname, 'key.pem'), keyPem);
    
    console.log('Zertifikate wurden erfolgreich generiert!');
}

generateCertificate(); 