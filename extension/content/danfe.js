// Runs on app.sefaz.es.gov.br/ConsultaNFCe/ConsultaDANFE_NFCe.aspx
// Waits for the NFC-e items to appear (after captcha resolves), scrapes them,
// shows a preview modal and sends the payload to the Despensa backend.
(async function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────────

  function parseBRL(str) {
    return parseFloat((str || '').replace(/\./g, '').replace(',', '.').trim()) || 0;
  }

  function showBanner(msg, color) {
    const b = document.createElement('div');
    b.style.cssText = `position:fixed;top:0;left:0;right:0;background:${color};color:#fff;padding:10px 16px;text-align:center;font-family:sans-serif;font-size:13px;z-index:2147483647;box-shadow:0 2px 8px rgba(0,0,0,.4);`;
    b.textContent = msg;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 6000);
  }

  function waitForItems() {
    return new Promise(resolve => {
      if (document.querySelectorAll('#tabResult tr .txtTit').length > 0) {
        resolve();
        return;
      }
      const observer = new MutationObserver(() => {
        if (document.querySelectorAll('#tabResult tr .txtTit').length > 0) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      // Give up after 2 minutes (captcha can take time).
      setTimeout(() => { observer.disconnect(); resolve(); }, 120000);
    });
  }

  function scrape() {
    const nomeEmitente = (document.querySelector('#u20')?.innerText || '').trim();

    let cnpj = '';
    document.querySelectorAll('.text').forEach(el => {
      if (el.innerText.includes('CNPJ')) {
        const m = el.innerText.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
        if (m) cnpj = m[0];
      }
    });

    const totalEl = document.querySelector('#totalNota .txtMax');
    const valorTotalNota = totalEl ? parseBRL(totalEl.innerText) : 0;

    const chaveEl = document.querySelector('.chave');
    const chaveAcesso = chaveEl ? chaveEl.innerText.replace(/\s/g, '') : '';

    let numeroNF = '', serieNF = '', dataEmissao = '', protocoloAutorizacao = '';
    const infoLi = document.querySelector('#infos li');
    if (infoLi) {
      const t = infoLi.innerText;
      const mNum = t.match(/N[uú]mero:\s*(\d+)/i);
      const mSerie = t.match(/S[eé]rie:\s*(\d+)/i);
      const mEmissao = t.match(/Emiss[aã]o:\s*([\d\/]+\s[\d:]+)/i);
      const mProtocolo = t.match(/Protocolo de Autoriza[cç][aã]o:\s*(\d+)/i);
      if (mNum) numeroNF = mNum[1];
      if (mSerie) serieNF = mSerie[1];
      if (mEmissao) dataEmissao = mEmissao[1].trim();
      if (mProtocolo) protocoloAutorizacao = mProtocolo[1].trim();
    }

    const itens = [];
    document.querySelectorAll('#tabResult tr').forEach(row => {
      const nomeBruto = row.querySelector('.txtTit')?.innerText;
      if (!nomeBruto) return;
      const codText = row.querySelector('.RCod')?.innerText || '';
      const mCod = codText.match(/C[oó]digo:\s*(\d+)/i);
      itens.push({
        nome_bruto: nomeBruto.trim(),
        codigo_produto: mCod ? mCod[1] : null,
        unidade: (row.querySelector('.RUN')?.innerText || '').replace(/.*UN:\s*/i, '').trim() || null,
        quantidade: parseBRL((row.querySelector('.Rqtd')?.innerText || '').replace(/.*Qtde\.:/i, '')),
        valor_unitario: parseBRL((row.querySelector('.RvlUnit')?.innerText || '').replace(/.*Vl\. Unit\.:/i, '')),
        valor_total: parseBRL(row.querySelector('.valor')?.innerText || '')
      });
    });

    return { nomeEmitente, cnpj, valorTotalNota, chaveAcesso, numeroNF, serieNF, dataEmissao, protocoloAutorizacao, itens };
  }

  function showModal(data, originalUrl, apiUrl, apiToken) {
    const linhas = [
      'Emitente : ' + data.nomeEmitente,
      'CNPJ     : ' + data.cnpj,
      'NF       : ' + data.numeroNF + '  Série: ' + data.serieNF,
      'Emissão  : ' + data.dataEmissao,
      'Total    : R$ ' + data.valorTotalNota.toFixed(2),
      'Chave    : ' + data.chaveAcesso,
      '',
      data.itens.length + ' itens:',
      '─'.repeat(44)
    ];
    data.itens.forEach((it, i) => {
      linhas.push(`${i + 1}. ${it.nome_bruto}`);
      linhas.push(`   ${it.quantidade} ${it.unidade || ''} × R$${it.valor_unitario.toFixed(2)} = R$${it.valor_total.toFixed(2)}`);
    });

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2147483646;display:flex;align-items:center;justify-content:center;';

    const box = document.createElement('div');
    box.style.cssText = 'background:#1a1a2e;color:#eee;font-family:monospace;font-size:13px;padding:24px;border-radius:10px;max-width:92vw;max-height:85vh;overflow:auto;position:relative;min-width:320px;';

    const h = document.createElement('h3');
    h.textContent = 'Despensa — Extração NFC-e';
    h.style.cssText = 'margin:0 0 14px;color:#7ec8e3;font-size:15px;font-family:sans-serif;';

    const pre = document.createElement('pre');
    pre.textContent = linhas.join('\n');
    pre.style.cssText = 'margin:0 0 16px;white-space:pre-wrap;word-break:break-word;';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';

    const btnEnviar = document.createElement('button');
    btnEnviar.textContent = 'Enviar para o Despensa';
    btnEnviar.style.cssText = 'background:#2ecc71;color:#fff;border:none;padding:8px 16px;cursor:pointer;font-size:14px;border-radius:6px;';

    const btnCancelar = document.createElement('button');
    btnCancelar.textContent = 'Cancelar';
    btnCancelar.style.cssText = 'background:#e74c3c;color:#fff;border:none;padding:8px 16px;cursor:pointer;font-size:14px;border-radius:6px;';
    btnCancelar.onclick = () => overlay.remove();

    const statusEl = document.createElement('div');
    statusEl.style.cssText = 'margin-top:12px;color:#f1c40f;min-height:20px;font-family:sans-serif;font-size:13px;';

    btnEnviar.onclick = async () => {
      btnEnviar.disabled = true;
      btnEnviar.textContent = 'Enviando...';

      const payload = {
        url_sefaz: originalUrl || location.href,
        cnpj_emitente: data.cnpj,
        nome_emitente: data.nomeEmitente,
        chave_acesso: data.chaveAcesso,
        numero_nf: data.numeroNF,
        serie_nf: data.serieNF,
        data_emissao: data.dataEmissao,
        protocolo_autorizacao: data.protocoloAutorizacao,
        valor_total_nota: data.valorTotalNota,
        itens: data.itens
      };

      try {
        const res = await fetch(`${apiUrl}/notas/processar-scrape`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiToken}`
          },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.ok) {
          statusEl.style.color = '#2ecc71';
          statusEl.textContent = `Nota ID ${json.id_nota} → AGUARDANDO_VALIDACAO`;
          btnEnviar.textContent = 'Enviado';
          await browser.storage.local.remove(['despensa_chave', 'despensa_url', 'despensa_ts']);
        } else {
          throw new Error(json.error || JSON.stringify(json));
        }
      } catch (err) {
        statusEl.style.color = '#e74c3c';
        statusEl.textContent = 'Erro: ' + err.message;
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Tentar novamente';
      }
    };

    btnRow.appendChild(btnEnviar);
    btnRow.appendChild(btnCancelar);
    box.appendChild(h);
    box.appendChild(pre);
    box.appendChild(btnRow);
    box.appendChild(statusEl);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  // ── Main ─────────────────────────────────────────────────────────────────

  const { despensa_api_url: apiUrl, despensa_api_token: apiToken } =
    await browser.storage.local.get(['despensa_api_url', 'despensa_api_token']);

  if (!apiUrl || !apiToken) {
    showBanner('Despensa: configure a URL e o token da API nas opções da extensão.', '#c0392b');
    return;
  }

  await waitForItems();

  const data = scrape();
  if (data.itens.length === 0) return; // página sem NF (formulário de consulta vazio, etc.)

  const { despensa_url: originalUrl, despensa_ts } =
    await browser.storage.local.get(['despensa_url', 'despensa_ts']);

  // Só usa a URL armazenada se for recente (< 30 min).
  const freshUrl = despensa_ts && (Date.now() - despensa_ts < 30 * 60 * 1000) ? originalUrl : null;

  showModal(data, freshUrl, apiUrl, apiToken);
})();
