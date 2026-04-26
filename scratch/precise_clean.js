const fs = require('fs');
const path = 'client/src/pages/Settings.jsx';

let buffer = fs.readFileSync(path);

const replacements = [
    { target: Buffer.from('ce93c692e29482', 'hex'), replacement: Buffer.from('⟳', 'utf8') },
    { target: Buffer.from('ce93c387c3b3', 'hex'), replacement: Buffer.from('──', 'utf8') },
    { target: Buffer.from('e294acc3b3', 'hex'), replacement: Buffer.from('──', 'utf8') },
    { target: Buffer.from('e289a1c692c692c3b3', 'hex'), replacement: Buffer.from('✅', 'utf8') },
    { target: Buffer.from('e289a1c692c692c3ad', 'hex'), replacement: Buffer.from('⚠️', 'utf8') },
    { target: Buffer.from('e289a1c692c3b6e294a4', 'hex'), replacement: Buffer.from('❌', 'utf8') },
    // Also handle some literal strings that might be missed or appear in text
    { target: Buffer.from(' (A3)', 'utf8'), replacement: Buffer.from(' ($)', 'utf8') },
    { target: Buffer.from('(A3)', 'utf8'), replacement: Buffer.from('($)', 'utf8') },
    { target: Buffer.from('I"AA\'', 'utf8'), replacement: Buffer.from("'", 'utf8') },
    { target: Buffer.from('I"AA3', 'utf8'), replacement: Buffer.from(' — ', 'utf8') },
    { target: Buffer.from('I"AA', 'utf8'), replacement: Buffer.from('', 'utf8') },
    { target: Buffer.from('ΓöÇΓöÇ', 'utf8'), replacement: Buffer.from('──', 'utf8') },
    { target: Buffer.from('ΓòÉΓòÉ', 'utf8'), replacement: Buffer.from('──', 'utf8') }
];

let changed = false;
for (const { target, replacement } of replacements) {
    let index;
    while ((index = buffer.indexOf(target)) !== -1) {
        const newBuffer = Buffer.concat([
            buffer.slice(0, index),
            replacement,
            buffer.slice(index + target.length)
        ]);
        buffer = newBuffer;
        changed = true;
    }
}

if (changed) {
    fs.writeFileSync(path, buffer);
    console.log('File cleaned successfully via Buffer manipulation');
} else {
    console.log('No matches found for hex sequences');
}
