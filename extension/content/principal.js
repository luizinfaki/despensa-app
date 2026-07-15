// Runs on app.sefaz.es.gov.br/ConsultaNFCe/Principal
// Auto-fills the chave de acesso stored when the QR code page was visited.
(async function () {
  const { despensa_chave, despensa_ts } = await browser.storage.local.get(['despensa_chave', 'despensa_ts']);
  if (!despensa_chave) return;
  if (!despensa_ts || Date.now() - despensa_ts > 30 * 60 * 1000) return;

  const input = document.getElementById('txtConsulta');
  if (!input) return;

  input.value = despensa_chave;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.focus();
})();
