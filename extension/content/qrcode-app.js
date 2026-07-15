// Runs on app.sefaz.es.gov.br/ConsultaNFCe/qrcode.aspx?p=...
// Extracts the 44-digit chave from the URL and stores it so danfe.js can pick it up
// after the captcha resolves. If the page shows an error (QR code inválido, reload loop),
// copies the chave to clipboard and redirects to the consultation page.
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

  // After DOM is ready, check if the page shows an error instead of captcha.
  function checkError() {
    const txt = document.body?.innerText || '';
    if (/inv[áa]lido|qr code inv|erro/i.test(txt)) {
      try { navigator.clipboard.writeText(chave); } catch (_) {}
      location.replace('https://app.sefaz.es.gov.br/ConsultaNFCe/Principal');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkError);
  } else {
    checkError();
  }
})();
