(function () {
  // Coleta info de todas as tabelas da página
  var tabelas = document.querySelectorAll('table');
  var linhas = [];

  linhas.push('=== URL ===');
  linhas.push(location.href);
  linhas.push('');

  // Tenta pegar CNPJ e totais de texto solto na página (fora de tabelas)
  linhas.push('=== TEXTO DA PÁGINA (primeiros 3000 chars) ===');
  linhas.push(document.body.innerText.slice(0, 3000));
  linhas.push('');

  linhas.push('=== TABELAS ENCONTRADAS: ' + tabelas.length + ' ===');

  tabelas.forEach(function (tabela, i) {
    linhas.push('');
    linhas.push('--- Tabela #' + i + ' ---');
    linhas.push('id: "' + tabela.id + '"');
    linhas.push('class: "' + tabela.className + '"');

    var rows = tabela.querySelectorAll('tr');
    linhas.push('linhas: ' + rows.length);

    // Mostra até 5 linhas
    var limite = Math.min(rows.length, 5);
    for (var r = 0; r < limite; r++) {
      var cells = rows[r].querySelectorAll('th, td');
      var celulas = [];
      cells.forEach(function (c) { celulas.push(c.innerText.trim()); });
      linhas.push('  [' + r + '] ' + celulas.join(' | '));
    }
  });

  // Monta o modal
  var overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
    'background:rgba(0,0,0,0.8)', 'z-index:999999',
    'display:flex', 'align-items:center', 'justify-content:center'
  ].join(';');

  var box = document.createElement('div');
  box.style.cssText = [
    'background:#111', 'color:#0f0', 'font-family:monospace', 'font-size:12px',
    'padding:20px', 'border-radius:8px', 'max-width:90vw', 'max-height:80vh',
    'overflow:auto', 'white-space:pre', 'position:relative'
  ].join(';');

  var texto = linhas.join('\n');

  var btnFechar = document.createElement('button');
  btnFechar.innerText = 'X';
  btnFechar.style.cssText = 'position:absolute;top:8px;right:8px;background:#f00;color:#fff;border:none;padding:4px 8px;cursor:pointer;font-size:14px;';
  btnFechar.onclick = function () { document.body.removeChild(overlay); };

  var btnCopiar = document.createElement('button');
  btnCopiar.innerText = 'Copiar tudo';
  btnCopiar.style.cssText = 'position:absolute;top:8px;right:50px;background:#080;color:#fff;border:none;padding:4px 8px;cursor:pointer;font-size:14px;';
  btnCopiar.onclick = function () { navigator.clipboard.writeText(texto); btnCopiar.innerText = 'Copiado!'; };

  var pre = document.createElement('pre');
  pre.innerText = texto;
  pre.style.margin = '0';
  pre.style.marginTop = '30px';

  box.appendChild(btnFechar);
  box.appendChild(btnCopiar);
  box.appendChild(pre);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
})();
