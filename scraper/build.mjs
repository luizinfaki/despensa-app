import { readFileSync, writeFileSync, existsSync } from 'fs';

if (!existsSync('./config.json')) {
  console.error('Erro: config.json não encontrado. Copie config.example.json e preencha.');
  process.exit(1);
}

const config = JSON.parse(readFileSync('./config.json', 'utf8'));
const src = readFileSync('./src/bookmarklet.js', 'utf8');

// Remove comentários ANTES de substituir placeholders (evita apagar // da URL)
const stripped = src
  .replace(/\/\/[^\n]*/g, '')
  .replace(/\n+/g, ' ')
  .replace(/\s{2,}/g, ' ')
  .trim();

const minified = stripped
  .replace("'__API_URL__'", JSON.stringify(config.apiUrl))
  .replace("'__API_TOKEN__'", JSON.stringify(config.apiToken));

const bookmarklet = 'javascript:' + encodeURIComponent(minified);
writeFileSync('./bookmarklet.txt', bookmarklet, 'utf8');
console.log('Bookmarklet gerado: bookmarklet.txt (' + bookmarklet.length + ' chars)');
console.log('API URL:', config.apiUrl);
