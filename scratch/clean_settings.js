const fs = require('fs');
const path = 'client/src/pages/Settings.jsx';

let content = fs.readFileSync(path, 'utf8');

const replacements = [
    [/ΓöÇΓöÇ/g, '──'],
    [/ΓòÉΓòÉ/g, '──'],
    [/ΓÇö/g, '—'],
    [/ΓÇô/g, '–'],
    [/┬⌐/g, '©'],
    [/Γ│/g, '⟳'], // Spinning arrow
    [/Γ£ô/g, '✓'], // Checkmark
    [/Γ£ö/g, '✅'],
    [/ΓÜá/g, '⚠️'],
    [/Γ£ò/g, '❌']
];

let newContent = content;
for (const [pattern, replacement] of replacements) {
    newContent = newContent.replace(pattern, replacement);
}

if (newContent !== content) {
    fs.writeFileSync(path, newContent, 'utf8');
    console.log('File cleaned successfully');
} else {
    console.log('No mangled characters found to replace');
}
