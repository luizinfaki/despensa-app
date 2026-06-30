import { readFileSync, writeFileSync } from 'fs';

const src = readFileSync('./src/diagnostico.js', 'utf8');

// Remove comentários de linha, colapsa whitespace, preserva strings
const minified = src
  .replace(/\/\/[^\n]*/g, '')       // remove // comments
  .replace(/\n+/g, ' ')             // quebras de linha → espaço
  .replace(/\s{2,}/g, ' ')          // múltiplos espaços → um
  .trim();

const bookmarklet = 'javascript:' + encodeURIComponent(minified);

writeFileSync('./diagnostico.bookmarklet.txt', bookmarklet, 'utf8');
console.log('Bookmarklet gerado: diagnostico.bookmarklet.txt');
console.log('Tamanho:', bookmarklet.length, 'chars');
