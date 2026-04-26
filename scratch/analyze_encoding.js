const fs = require('fs');
const path = 'client/src/pages/Settings.jsx';

const content = fs.readFileSync(path, 'utf8');
const nonAsciiSequences = content.match(/[^\x00-\x7f]+/g);

if (nonAsciiSequences) {
    const unique = [...new Set(nonAsciiSequences)];
    console.log('Found non-ASCII sequences:');
    unique.forEach(s => {
        console.log(`${s} (hex: ${Buffer.from(s).toString('hex')})`);
    });
} else {
    console.log('No non-ASCII sequences found');
}
