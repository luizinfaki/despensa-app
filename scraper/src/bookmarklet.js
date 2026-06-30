(function () {
  var API_URL = '__API_URL__';
  var API_TOKEN = '__API_TOKEN__';

  function parseBRL(str) {
    return parseFloat((str || '').replace(/\./g, '').replace(',', '.').trim()) || 0;
  }

  // Emitente
  var nomeEmitente = ((document.querySelector('#u20') || {}).innerText || '').trim();

  // CNPJ
  var cnpj = '';
  document.querySelectorAll('.text').forEach(function (el) {
    if (el.innerText.indexOf('CNPJ') !== -1) {
      var m = el.innerText.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
      if (m) cnpj = m[0];
    }
  });

  // Valor total da nota
  var totalEl = document.querySelector('#totalNota .txtMax');
  var valorTotalNota = totalEl ? parseBRL(totalEl.innerText) : 0;

  // Chave de acesso (remove espaços)
  var chaveEl = document.querySelector('.chave');
  var chaveAcesso = chaveEl ? chaveEl.innerText.replace(/\s/g, '') : '';

  // Infos gerais da nota (número, série, emissão, protocolo)
  var numeroNF = '', serieNF = '', dataEmissao = '', protocoloAutorizacao = '';
  var infoLi = document.querySelector('#infos li');
  if (infoLi) {
    var infoText = infoLi.innerText;
    var mNum = infoText.match(/N[uú]mero:\s*(\d+)/i);
    var mSerie = infoText.match(/S[eé]rie:\s*(\d+)/i);
    var mEmissao = infoText.match(/Emiss[aã]o:\s*([\d\/]+\s[\d:]+)/i);
    var mProtocolo = infoText.match(/Protocolo de Autoriza[cç][aã]o:\s*(\d+)/i);
    if (mNum) numeroNF = mNum[1];
    if (mSerie) serieNF = mSerie[1];
    if (mEmissao) dataEmissao = mEmissao[1].trim();
    if (mProtocolo) protocoloAutorizacao = mProtocolo[1].trim();
  }

  // Itens
  var itens = [];
  document.querySelectorAll('#tabResult tr').forEach(function (row) {
    var nomeBruto = (row.querySelector('.txtTit') || {}).innerText;
    if (!nomeBruto) return;

    var codText = (row.querySelector('.RCod') || {}).innerText || '';
    var mCod = codText.match(/C[oó]digo:\s*(\d+)/i);

    var qtdText = (row.querySelector('.Rqtd') || {}).innerText || '';
    var unText = (row.querySelector('.RUN') || {}).innerText || '';
    var vlUnitText = (row.querySelector('.RvlUnit') || {}).innerText || '';
    var vlTotalText = (row.querySelector('.valor') || {}).innerText || '';

    itens.push({
      nome_bruto: nomeBruto.trim(),
      codigo_produto: mCod ? mCod[1] : null,
      unidade: unText.replace(/.*UN:\s*/i, '').trim() || null,
      quantidade: parseBRL(qtdText.replace(/.*Qtde\.:/i, '')),
      valor_unitario: parseBRL(vlUnitText.replace(/.*Vl\. Unit\.:/i, '')),
      valor_total: parseBRL(vlTotalText)
    });
  });

  if (itens.length === 0) {
    alert('Nenhum item encontrado em #tabResult. A página carregou?');
    return;
  }

  // --- Preview modal ---
  var linhas = [
    'Emitente : ' + nomeEmitente,
    'CNPJ     : ' + cnpj,
    'NF       : ' + numeroNF + '  Série: ' + serieNF,
    'Emissão  : ' + dataEmissao,
    'Protocolo: ' + protocoloAutorizacao,
    'Total    : R$ ' + valorTotalNota.toFixed(2),
    'Chave    : ' + chaveAcesso.slice(0, 22) + '...',
    'URL      : ' + location.href.slice(0, 60) + '...',
    '',
    itens.length + ' itens encontrados:',
    '------------------------------------------------'
  ];
  itens.forEach(function (item, i) {
    linhas.push((i + 1) + '. ' + item.nome_bruto + (item.codigo_produto ? ' [' + item.codigo_produto + ']' : ''));
    linhas.push(
      '   Qtd: ' + item.quantidade + ' ' + (item.unidade || '') +
      '  Unit: R$' + item.valor_unitario.toFixed(2) +
      '  Total: R$' + item.valor_total.toFixed(2)
    );
  });

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:999999;display:flex;align-items:center;justify-content:center;';

  var box = document.createElement('div');
  box.style.cssText = 'background:#1a1a2e;color:#eee;font-family:monospace;font-size:13px;padding:24px;border-radius:10px;max-width:92vw;max-height:85vh;overflow:auto;position:relative;min-width:320px;';

  var titulo = document.createElement('h3');
  titulo.innerText = 'Despensa — Preview da extração';
  titulo.style.cssText = 'margin:0 0 12px 0;color:#7ec8e3;font-size:15px;';

  var pre = document.createElement('pre');
  pre.innerText = linhas.join('\n');
  pre.style.cssText = 'margin:0 0 16px 0;white-space:pre-wrap;word-break:break-word;';

  var btnEnviar = document.createElement('button');
  btnEnviar.innerText = 'Enviar para o backend';
  btnEnviar.style.cssText = 'margin-right:8px;background:#2ecc71;color:#fff;border:none;padding:8px 16px;cursor:pointer;font-size:14px;border-radius:6px;';

  var btnCancelar = document.createElement('button');
  btnCancelar.innerText = 'Cancelar';
  btnCancelar.style.cssText = 'background:#e74c3c;color:#fff;border:none;padding:8px 16px;cursor:pointer;font-size:14px;border-radius:6px;';
  btnCancelar.onclick = function () { document.body.removeChild(overlay); };

  var status = document.createElement('div');
  status.style.cssText = 'margin-top:12px;color:#f1c40f;min-height:20px;';

  btnEnviar.onclick = function () {
    btnEnviar.disabled = true;
    btnEnviar.innerText = 'Enviando...';

    var payload = {
      url_sefaz: location.href,
      cnpj_emitente: cnpj,
      nome_emitente: nomeEmitente,
      chave_acesso: chaveAcesso,
      numero_nf: numeroNF,
      serie_nf: serieNF,
      data_emissao: dataEmissao,
      protocolo_autorizacao: protocoloAutorizacao,
      valor_total_nota: valorTotalNota,
      itens: itens
    };

    fetch(API_URL + '/notas/processar-scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_TOKEN },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.ok) {
          status.style.color = '#2ecc71';
          status.innerText = 'OK! Nota ID ' + data.id_nota + ' → AGUARDANDO_VALIDACAO';
          btnEnviar.innerText = 'Enviado';
        } else {
          throw new Error(data.error || JSON.stringify(data));
        }
      })
      .catch(function (err) {
        status.style.color = '#e74c3c';
        status.innerText = 'Erro: ' + err.message;
        btnEnviar.disabled = false;
        btnEnviar.innerText = 'Tentar novamente';
      });
  };

  box.appendChild(titulo);
  box.appendChild(pre);
  box.appendChild(btnEnviar);
  box.appendChild(btnCancelar);
  box.appendChild(status);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
})();
