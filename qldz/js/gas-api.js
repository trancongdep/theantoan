async function callGasApi(action, data) {
  if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL.includes("DIEN_DEPLOYMENT_ID")) {
    return { ok: true, simulated: true };
  }
  const res = await fetch(GAS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token: API_SECRET_TOKEN, action, data })
  });
  if (!res.ok) throw new Error(`GAS HTTP ${res.status}`);
  return await res.json();
}

async function fetchPmisExportFromGas() {
  if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL.includes("DIEN_DEPLOYMENT_ID")) {
    return { ok: false, rows: [] };
  }
  const res = await fetch(`${GAS_WEBAPP_URL}?action=exportPMIS&token=${encodeURIComponent(API_SECRET_TOKEN)}`);
  if (!res.ok) throw new Error(`GAS HTTP ${res.status}`);
  return await res.json();
}