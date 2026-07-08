const fs = require('fs');
let css = fs.readFileSync('styles/themes.css', 'utf-8');

// Replace dark mode backgrounds with completely black #000000
const themes = ['orange', 'blue', 'green', 'violet'];

themes.forEach(theme => {
  const regex = new RegExp(`(:root\\[data-theme="${theme}"\\]\\[data-mode="dark"\\] \\{[\\s\\S]*?--bg:\\s*)#[0-9A-Fa-f]{3,6}(;\\s*--surface:\\s*)#[0-9A-Fa-f]{3,6}`, 'g');
  css = css.replace(regex, `$1#000000$2#0A0A0A`);
});

fs.writeFileSync('styles/themes.css', css);
console.log('Updated dark theme backgrounds to black.');
