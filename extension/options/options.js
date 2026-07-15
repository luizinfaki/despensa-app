const apiUrlEl = document.getElementById('apiUrl');
const apiTokenEl = document.getElementById('apiToken');
const statusEl = document.getElementById('status');

browser.storage.local.get(['despensa_api_url', 'despensa_api_token']).then(({ despensa_api_url, despensa_api_token }) => {
  if (despensa_api_url) apiUrlEl.value = despensa_api_url;
  if (despensa_api_token) apiTokenEl.value = despensa_api_token;
});

document.getElementById('salvar').onclick = async () => {
  const url = apiUrlEl.value.trim().replace(/\/$/, '');
  const token = apiTokenEl.value.trim();
  if (!url || !token) { statusEl.textContent = 'Preencha os dois campos.'; statusEl.style.color = '#e74c3c'; return; }
  await browser.storage.local.set({ despensa_api_url: url, despensa_api_token: token });
  statusEl.textContent = 'Salvo!';
  statusEl.style.color = '#27ae60';
};
