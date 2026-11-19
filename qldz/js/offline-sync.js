const OFFLINE_DB_NAME = "LDCT_OPMS_OFFLINE_DB", OFFLINE_STORE = "sync_queue";
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB_NAME, 1);
    req.onupgradeneeded = (e) => { if (!e.target.result.objectStoreNames.contains(OFFLINE_STORE)) e.target.result.createObjectStore(OFFLINE_STORE, { keyPath: "queueId" }); };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}
async function enqueueOfflinePayload(item) {
  const idb = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(OFFLINE_STORE, "readwrite");
    tx.objectStore(OFFLINE_STORE).put({ queueId: item.queueId || ("Q-" + Date.now()), createdAt: new Date().toISOString(), ...item });
    tx.oncomplete = () => { updateOfflineBadge(); resolve(true); };
    tx.onerror = (e) => reject(e.target.error);
  });
}
async function getOfflineQueue() {
  const idb = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const req = idb.transaction(OFFLINE_STORE, "readonly").objectStore(OFFLINE_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}
async function removeOfflineItem(queueId) {
  const idb = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(OFFLINE_STORE, "readwrite");
    tx.objectStore(OFFLINE_STORE).delete(queueId);
    tx.oncomplete = () => { updateOfflineBadge(); resolve(true); };
    tx.onerror = (e) => reject(e.target.error);
  });
}
async function updateOfflineBadge() {
  const badge = document.getElementById("offline-badge"); if (!badge) return;
  try { const list = await getOfflineQueue(); if (list.length > 0) { badge.textContent = `Chờ đồng bộ: ${list.length}`; badge.classList.remove("hidden"); } else badge.classList.add("hidden"); } catch (e) {}
}
async function flushOfflineQueue() {
  if (!navigator.onLine) return { synced: 0 };
  const list = await getOfflineQueue(); let synced = 0;
  for (const item of list) {
    try {
      if (item.firebasePath && item.firebaseData) await db.ref(item.firebasePath).set(item.firebaseData);
      if (item.gasAction && item.gasData && typeof callGasApi === "function") await callGasApi(item.gasAction, item.gasData);
      await removeOfflineItem(item.queueId); synced++;
    } catch (err) { console.warn("Sync paused:", item.queueId, err); }
  }
  return { synced };
}
window.addEventListener("online", () => { flushOfflineQueue().then((res) => { if (res.synced > 0) alert(`Đã tự động đồng bộ ${res.synced} hồ sơ hiện trường.`); }); });
function compressImageWithWatermark(file, gpsText, maxWidth = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width), w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0, w, h);
        ctx.fillStyle = "rgba(15, 23, 42, 0.75)"; ctx.fillRect(0, h - 34, w, 34);
        ctx.fillStyle = "#FFFFFF"; ctx.font = "14px sans-serif";
        ctx.fillText(`LĐCT-OPMS | ${new Date().toLocaleString("vi-VN")} | ${gpsText || "GPS N/A"}`, 12, h - 12);
        resolve({ filename: file.name.replace(/\.[^.]+$/, "") + "_wm.jpg", mimeType: "image/jpeg", base64: canvas.toDataURL("image/jpeg", quality) });
      };
      img.onerror = reject; img.src = ev.target.result;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}