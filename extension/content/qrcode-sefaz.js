// Runs on sefaz.es.gov.br/nfce/qrcode?p=... (URLs that 404).
// Extracts the chave, stores it, copies to clipboard and redireciona para ConsultaDANFE.
(async function () {
  const p = new URLSearchParams(location.search).get('p');
  if (!p) return;

  const chave = decodeURIComponent(p).split('|')[0].replace(/\D/g, '').slice(0, 44);
  if (chave.length !== 44) return;

  await browser.storage.local.set({
    despensa_chave: chave,
    despensa_url: location.href,
    despensa_ts: Date.now()
  });

  try { await navigator.clipboard.writeText(chave); } catch (_) {}

  // Replace history entry so the back button doesn't land here again.
  location.replace('https://app.sefaz.es.gov.br/ConsultaNFCe/Principal');
})();
