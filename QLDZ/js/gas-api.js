/**
 * LĐCT-OPMS v1.0 — Giao tiếp với Google Apps Script Web App (Code.gs)
 */
async function callGasApi(action, data) {
  if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL.includes("DIEN_DEPLOYMENT_ID")) {
    console.warn("Chưa cấu hình GAS_WEBAPP_URL trong js/firebase-config.js");
    return { ok: true, simulated: true };
  }

  const res = await fetch(GAS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      token: API_SECRET_TOKEN,
      action: action,
      data: data
    })
  });
  return await res.json();
}

async function fetchPmisExportFromGas() {
  if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL.includes("DIEN_DEPLOYMENT_ID")) {
    return { ok: false, rows: [] };
  }
  const url = `${GAS_WEBAPP_URL}?action=exportPMIS&token=${encodeURIComponent(API_SECRET_TOKEN)}`;
  const res = await fetch(url);
  return await res.json();
}
