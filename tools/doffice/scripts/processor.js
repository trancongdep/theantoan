/**
 * D-Office Processor for GitHub Actions
 * 
 * Runs in GitHub Actions, processes D-Office tasks, uploads to Google Drive,
 * updates Google Sheet, and writes status.json.
 * 
 * Required environment variables (GitHub Secrets):
 * - DOFFICE_USERNAME: D-Office login username
 * - DOFFICE_PASSWORD: D-Office login password
 * - GOOGLE_SERVICE_ACCOUNT: JSON key for Google Service Account
 * - DRIVE_FOLDER_ID: Google Drive folder ID
 * - GIST_ID: GitHub Gist ID for real-time progress (optional)
 * - PAT_TOKEN: GitHub PAT for updating Gist (optional)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  DOFFICE_URL: 'https://doffice.hcmpc.com.vn/',
  API_BASE: 'https://gwdoffice.hcmpc.com.vn/',
  USERNAME: process.env.DOFFICE_USERNAME || 'hcmpc\\deptc',
  PASSWORD: process.env.DOFFICE_PASSWORD || 'Dtc@01102026',
  ID_DV: 366,
  ID_NV: 97151,
  ID_PB: 117111,
  DRIVE_FOLDER: process.env.DRIVE_FOLDER_ID || '1VkN7uGemD3dm0kZKysFJzBruGPHtXxWI',
  QUAN_TAM: ['Hồ Minh Tuấn', 'Nguyễn Văn Biển', 'Trần Ngọc Lâm', 'LĐ2 - Tổ Đường Dây'],
  GIST_ID: process.env.GIST_ID || '',
  PAT_TOKEN: process.env.PAT_TOKEN || '',
  STATUS_FILE: path.join(__dirname, '..', 'status.json'),
  DATA_FILE: path.join(__dirname, '..', 'data.json'),
};

// ═══════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════

let browser = null, context = null, page = null, authToken = null;
let allDocs = [], folderCounter = 0, processingLog = [];

// Load existing data
try {
  if (fs.existsSync(CONFIG.DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, 'utf8'));
    allDocs = data.docs || [];
    folderCounter = data.folderCounter || 0;
  }
} catch(e) { console.log('No existing data, starting fresh'); }

// ═══════════════════════════════════════════════════════════════
//  LOGGING & STATUS
// ═══════════════════════════════════════════════════════════════

function log(msg) {
  const ts = new Date().toISOString();
  const entry = `[${ts}] ${msg}`;
  console.log(entry);
  processingLog.push(entry);
  if (processingLog.length > 200) processingLog.shift();
}

function writeStatus(status) {
  const fullStatus = {
    lastRun: new Date().toISOString(),
    ...status,
    totalDocs: allDocs.length,
    docs: allDocs.slice(-200),  // Keep last 200 docs
    processingLog: processingLog.slice(-50),
    quanTamList: CONFIG.QUAN_TAM,
    driveUrl: `https://drive.google.com/drive/folders/${CONFIG.DRIVE_FOLDER}`,
    dofficeUrl: CONFIG.DOFFICE_URL,
  };
  fs.writeFileSync(CONFIG.STATUS_FILE, JSON.stringify(fullStatus, null, 2));
}

async function updateGist(status) {
  if (!CONFIG.GIST_ID || !CONFIG.PAT_TOKEN) return;
  try {
    await fetch(`https://api.github.com/gists/${CONFIG.GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${CONFIG.PAT_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: { 'status.json': { content: JSON.stringify(status, null, 2) } }
      })
    });
  } catch(e) { /* silent fail - Gist is optional */ }
}

// ═══════════════════════════════════════════════════════════════
//  GOOGLE SERVICE ACCOUNT AUTH
// ═══════════════════════════════════════════════════════════════

let googleToken = null;
let googleTokenExpiry = 0;

async function getGoogleToken() {
  if (googleToken && Date.now() < googleTokenExpiry) return googleToken;
  
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!saJson) throw new Error('GOOGLE_SERVICE_ACCOUNT not set');
  
  const sa = JSON.parse(saJson);
  const now = Math.floor(Date.now() / 1000);
  
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url');
  
  const jwtInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(jwtInput);
  const signature = sign.sign(sa.private_key, 'base64url');
  const jwt = `${jwtInput}.${signature}`;
  
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  
  const data = await resp.json();
  if (!data.access_token) throw new Error(`Google auth failed: ${JSON.stringify(data)}`);
  
  googleToken = data.access_token;
  googleTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  log('Google token obtained via Service Account');
  return googleToken;
}

// ═══════════════════════════════════════════════════════════════
//  GOOGLE DRIVE / SHEET FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function uploadFileToDrive(fileName, fileBuffer, folderId) {
  const token = await getGoogleToken();
  
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const boundary = 'doffice_' + Date.now();
  
  // Build multipart body as Buffer (binary-safe)
  const bodyParts = [
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ];
  const body = Buffer.concat(bodyParts);
  
  const resp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      body,
    }
  );
  
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Drive upload failed: ${resp.status} ${err.substring(0, 200)}`);
  }
  
  const result = await resp.json();
  
  // Set sharing (anyone with link can view)
  await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });
  
  return { id: result.id, name: result.name, link: `https://drive.google.com/file/d/${result.id}/view` };
}

async function createDriveFolder(name, parentId) {
  const token = await getGoogleToken();
  const resp = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : [CONFIG.DRIVE_FOLDER],
    }),
  });
  const data = await resp.json();
  return data.id;
}

async function updateGoogleSheet(docs) {
  const token = await getGoogleToken();
  
  const headers = ['STT','ID CV','Ký hiệu','Trích yếu','Chủ trì','Ngày VB','Nơi ban hành','Số file','Link thư mục Drive','Link file Drive'];
  function csvEscape(v){const s=String(v||'');return s.includes(',')||s.includes('"')||s.includes('\n')?'"'+s.replace(/"/g,'""')+'"':s;}
  
  let csv = headers.join(',') + '\n';
  let stt = 0;
  for (const d of docs) {
    stt++;
    csv += [stt, d.id, d.kyHieu, d.trichYeu, d.chuTri, d.ngayVB, d.noiBanHanh, d.soFile,
      d.folderLink || '', (d.fileLinks||[]).map(f=>f.link).join('\n')].map(csvEscape).join(',') + '\n';
  }
  
  // Delete old sheet
  let oldSheetId = null;
  try {
    if (fs.existsSync(CONFIG.DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, 'utf8'));
      oldSheetId = data.sheetId;
    }
  } catch(e) {}
  
  if (oldSheetId) {
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${oldSheetId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      log('Deleted old sheet');
      await new Promise(r => setTimeout(r, 2000));
    } catch(e) {}
  }
  
  // Create new sheet
  const boundary = 'doffice_' + Date.now();
  const metadata = JSON.stringify({
    name: `Danh sách văn bản D-Office ${new Date().toISOString().split('T')[0]}`,
    mimeType: 'application/vnd.google-apps.spreadsheet',
    parents: [CONFIG.DRIVE_FOLDER],
  });
  
  const body = [
    `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', metadata,
    `--${boundary}`, 'Content-Type: text/csv; charset=UTF-8', '', csv,
    `--${boundary}--`, '',
  ].join('\r\n');
  
  const resp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(body, 'utf8'),
      },
      body,
    }
  );
  
  if (!resp.ok) {
    const err = await resp.text();
    log(`Sheet creation failed: ${resp.status} ${err.substring(0, 300)}`);
    return null;
  }
  
  const result = await resp.json();
  
  // Set sharing
  await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });
  
  // Publish as CSV (for HTML to read)
  const csvPublishUrl = `https://docs.google.com/spreadsheets/d/${result.id}/pub?output=csv`;
  
  // Save sheet info
  const data = fs.existsSync(CONFIG.DATA_FILE) ? JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, 'utf8')) : {};
  data.sheetId = result.id;
  data.sheetUrl = result.webViewLink;
  data.sheetCsvUrl = csvPublishUrl;
  fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(data, null, 2));
  
  log(`Sheet created: ${result.webViewLink}`);
  return { sheetId: result.id, sheetUrl: result.webViewLink, sheetCsvUrl: csvPublishUrl };
}

// ═══════════════════════════════════════════════════════════════
//  D-OFFICE FUNCTIONS (via Playwright)
// ═══════════════════════════════════════════════════════════════

async function initDOffice() {
  log('Logging in to D-Office...');
  const { chromium } = require('playwright');
  
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });
  
  context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    acceptDownloads: true,
  });
  
  page = await context.newPage();
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      log(`Login attempt ${attempt}...`);
      await page.goto(CONFIG.DOFFICE_URL, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(3000);
      await page.locator('#mat-input-0').fill(CONFIG.USERNAME, { timeout: 10000 });
      await page.locator('#mat-input-1').fill(CONFIG.PASSWORD, { timeout: 10000 });
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: 'Đăng nhập' }).click();
      await page.waitForTimeout(10000);
      
      if (!page.url().includes('sign-in')) {
        const cookies = await context.cookies();
        const tokenCookie = cookies.find(c => c.name === 'accessTokenDOffice');
        if (tokenCookie) {
          authToken = tokenCookie.value;
          log('Login successful! Token: ' + authToken.substring(0, 30) + '...');
          return true;
        }
      }
      log(`Attempt ${attempt} failed`);
      await page.waitForTimeout(3000);
    } catch(e) {
      log(`Attempt ${attempt} error: ${e.message}`);
      await page.waitForTimeout(3000);
    }
  }
  
  log('FAILED: Could not login to D-Office');
  return false;
}

async function getTaskCountsViaWeb() {
  return new Promise(async (resolve) => {
    let captured = null;
    const handler = async (resp) => {
      if (resp.url().includes('GetDSCVCVien')) {
        try {
          const body = await resp.text();
          if (body && !body.includes('<html>')) captured = JSON.parse(body);
        } catch(e) {}
      }
    };
    
    page.on('response', handler);
    try {
      await page.goto('https://doffice.hcmpc.com.vn/congviec/cviec-cvien-xuly/chothuchien',
        { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(3000);
      const phoiHop = page.locator('text=Phối hợp').first();
      if (await phoiHop.count() > 0) {
        await phoiHop.click();
        await page.waitForTimeout(8000);
      }
      let waitCount = 0;
      while (!captured && waitCount < 10) { await page.waitForTimeout(2000); waitCount++; }
    } catch(e) { log('Navigation error: ' + e.message); }
    finally { page.off('response', handler); }
    
    if (captured && captured.Data) {
      const tasks = captured.Data;
      const choXuLy = tasks.filter(t => t.TT_XULY === 'CHUA_THUC_HIEN').length;
      log(`Via web: ${tasks.length} total tasks, ${choXuLy} pending`);
      resolve({ choXuLy, total: tasks.length, tasks });
    } else { resolve(null); }
  });
}

async function getTaskCounts() {
  log('Getting task counts...');
  const counts = { choXuLy: 0, vbDiNoiBoChuaKy: 0, vbDiNgoaiChuaKy: 0 };
  const apiHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
    'org-code': String(CONFIG.ID_DV),
  };
  
  try {
    const resp = await context.request.get(
      `${CONFIG.API_BASE}v1/congviec/ChuyenVien/GetDSCVCVien?id_donvi=${CONFIG.ID_DV}&id_nv=${CONFIG.ID_NV}`,
      { headers: apiHeaders }
    );
    const text = await resp.text();
    if (resp.status() === 200 && !text.includes('<html>')) {
      const data = JSON.parse(text);
      const tasks = data.Data || data.data || [];
      counts.choXuLy = tasks.filter(t => t.TT_XULY === 'CHUA_THUC_HIEN').length;
      log(`API: ${tasks.length} total, ${counts.choXuLy} pending`);
    } else {
      const webCounts = await getTaskCountsViaWeb();
      if (webCounts) counts.choXuLy = webCounts.choXuLy;
    }
  } catch(e) {
    const webCounts = await getTaskCountsViaWeb();
    if (webCounts) counts.choXuLy = webCounts.choXuLy;
  }
  
  try {
    const resp = await context.request.get(
      `${CONFIG.API_BASE}v1/duthao/VBDT/Get_Counter_ChuaDuyetALL?ID_NV=${CONFIG.ID_NV}&ListPB=${CONFIG.ID_PB}&ID_DV=${CONFIG.ID_DV}`,
      { headers: apiHeaders }
    );
    const text = await resp.text();
    if (resp.status() === 200 && !text.includes('<html>')) {
      const data = JSON.parse(text);
      const d = data.Data || data.data || {};
      counts.vbDiNgoaiChuaKy = d.COUNT_VBDI || 0;
      counts.vbDiNoiBoChuaKy = d.COUNT_VBNB || 0;
      log(`VB: ${counts.vbDiNgoaiChuaKy} external, ${counts.vbDiNoiBoChuaKy} internal`);
    }
  } catch(e) { log('Counter API error: ' + e.message); }
  
  return counts;
}

async function getPendingTasks() {
  log('Getting pending tasks...');
  const apiHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
    'org-code': String(CONFIG.ID_DV),
  };
  
  try {
    const resp = await context.request.get(
      `${CONFIG.API_BASE}v1/congviec/ChuyenVien/GetDSCVCVien?id_donvi=${CONFIG.ID_DV}&id_nv=${CONFIG.ID_NV}`,
      { headers: apiHeaders }
    );
    const text = await resp.text();
    if (resp.status() === 200 && !text.includes('<html>')) {
      const data = JSON.parse(text);
      const tasks = data.Data || data.data || [];
      log(`Got ${tasks.length} tasks via API`);
      return tasks;
    }
  } catch(e) { log('Direct API failed: ' + e.message); }
  
  log('Falling back to web navigation...');
  const result = await getTaskCountsViaWeb();
  return result ? result.tasks : [];
}

async function downloadTaskFiles(task) {
  const apiHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
    'org-code': String(CONFIG.ID_DV),
  };
  
  try {
    const resp = await context.request.get(
      `${CONFIG.API_BASE}v1/congviec/CongViec/FILE_CongViec?id_vanban=${task.ID_VB}&hstl=false`,
      { headers: apiHeaders }
    );
    const body = await resp.text();
    if (resp.status() !== 200 || body.length === 0 || body.includes('<html>')) return { files: [] };
    
    const fileData = JSON.parse(body);
    if (!fileData.Data || fileData.Data.length === 0) return { files: [] };
    
    const downloaded = [];
    for (const file of fileData.Data) {
      try {
        const url = `${CONFIG.API_BASE}v1/files/FileVb/GetPreviewFileVBByDuongDan?ID_DV=${CONFIG.ID_DV}&ID_NV=${CONFIG.ID_NV}&ID_LOAI_VB=${task.ID_LOAI_VB || 97045}&DUONG_DAN=${encodeURIComponent(file.DUONG_DAN)}`;
        const dlResp = await context.request.get(url, {
          headers: { 'Accept': 'application/json, text/plain, */*', 'Authorization': `Bearer ${authToken}` },
        });
        const dlBody = await dlResp.text();
        if (dlResp.status() === 200 && dlBody.length > 0) {
          let b64 = dlBody;
          if (b64.startsWith('"') && b64.endsWith('"')) b64 = b64.slice(1, -1);
          b64 = b64.replace(/\\"/g, '"').replace(/\\n/g, '').replace(/\\r/g, '').replace(/\\\\/g, '\\');
          const buffer = Buffer.from(b64, 'base64');
          downloaded.push({ name: file.TEN_FILE, buffer, size: buffer.length });
        }
      } catch(e) { log(`  Download error ${file.TEN_FILE}: ${e.message}`); }
    }
    return { files: downloaded };
  } catch(e) { return { files: [] }; }
}

async function completeTask(task) {
  const apiHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
    'org-code': String(CONFIG.ID_DV),
  };
  const payload = {
    ID_XULY: task.ID_XULY,
    ID_PB: task.ID_PB || CONFIG.ID_PB,
    ID_NV: CONFIG.ID_NV,
    ID_CV: task.ID_CV,
    NDUNG_XULY: '',
    TT_XULY: 'HOAN_THANH',
    NGAY_HTHANH: new Date().toISOString(),
    FILE_DUTHAO: [],
    VB_DUTHAO: [],
  };
  try {
    const resp = await context.request.post(
      `${CONFIG.API_BASE}v1/congviec/ChuyenVien/CVCapNhatXLCV`,
      { headers: apiHeaders, data: payload }
    );
    const body = await resp.text();
    return body.trim() === 'true' || (resp.status() === 200 && body.includes('true'));
  } catch(e) { log(`  Complete error: ${e.message}`); return false; }
}

// ═══════════════════════════════════════════════════════════════
//  MAIN PROCESSING
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  D-Office Processor (GitHub Actions)');
  console.log('  ' + new Date().toISOString());
  console.log('═══════════════════════════════════════════════════\n');
  
  let status = {
    status: 'starting',
    isProcessing: true,
    choXuLy: 0,
    vbDiNoiBoChuaKy: 0,
    vbDiNgoaiChuaKy: 0,
    processed: 0,
    quanTam: 0,
    files: 0,
  };
  writeStatus(status);
  await updateGist(status);
  
  try {
    // Login
    const ok = await initDOffice();
    if (!ok) {
      status.status = 'error';
      status.message = 'Không thể đăng nhập D-Office';
      status.isProcessing = false;
      writeStatus(status);
      await updateGist(status);
      process.exit(1);
    }
    
    // Get counts
    const counts = await getTaskCounts();
    status.choXuLy = counts.choXuLy;
    status.vbDiNoiBoChuaKy = counts.vbDiNoiBoChuaKy;
    status.vbDiNgoaiChuaKy = counts.vbDiNgoaiChuaKy;
    writeStatus(status);
    await updateGist(status);
    
    // Get pending tasks
    const tasks = await getPendingTasks();
    if (tasks.length === 0) {
      status.status = 'success';
      status.message = 'Không có công việc chờ xử lý';
      status.isProcessing = false;
      
      // Still update Sheet with existing quan tâm docs
      const quanTamDocs = allDocs.filter(d => d.quanTam);
      if (quanTamDocs.length > 0) {
        const sheetInfo = await updateGoogleSheet(quanTamDocs);
        if (sheetInfo) status.sheetUrl = sheetInfo.sheetUrl;
      }
      
      writeStatus(status);
      await updateGist(status);
      await browser.close();
      return;
    }
    
    log(`Processing ${tasks.length} tasks...`);
    status.total = tasks.length;
    
    let quanTamCount = 0, completedCount = 0, fileCount = 0;
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const isQuanTam = CONFIG.QUAN_TAM.includes(task.TEN_CT || '');
      
      log(`[${i+1}/${tasks.length}] ${task.KY_HIEU} - ${task.TEN_CT}${isQuanTam ? ' (QT)' : ''}`);
      
      status.current = i + 1;
      status.currentTask = task.KY_HIEU;
      status.currentChuTri = task.TEN_CT;
      await updateGist(status);
      
      const docInfo = {
        id: task.ID_CV, kyHieu: task.KY_HIEU || '',
        trichYeu: (task.TRICH_YEU || '').replace(/\n/g, ' ').trim(),
        chuTri: task.TEN_CT || '',
        ngayVB: task.NGAY_VB ? task.NGAY_VB.split('T')[0] : '',
        noiBanHanh: task.NOI_BAN_HANH || '',
        soFile: 0, folderLink: '', fileLinks: [],
        quanTam: isQuanTam, status: 'HOAN_THANH',
        processedAt: new Date().toISOString(),
      };
      
      if (isQuanTam) {
        const dlResult = await downloadTaskFiles(task);
        if (dlResult.files.length > 0) {
          docInfo.soFile = dlResult.files.length;
          fileCount += dlResult.files.length;
          
          // Upload to Drive
          const today = new Date().toISOString().split('T')[0];
          const folderName = `${today}_${task.KY_HIEU || 'unknown'}`.replace(/[\\/:*?"<>|]/g, '_');
          const folderId = await createDriveFolder(folderName, CONFIG.DRIVE_FOLDER);
          
          if (folderId) {
            docInfo.folderLink = `https://drive.google.com/drive/folders/${folderId}`;
            for (const f of dlResult.files) {
              const safeName = f.name.replace(/[\\/:*?"<>|]/g, '_');
              const uploaded = await uploadFileToDrive(safeName, f.buffer, folderId);
              if (uploaded) {
                docInfo.fileLinks.push({ name: f.name, link: uploaded.link, id: uploaded.id });
              }
            }
            log(`  Uploaded ${dlResult.files.length} files to Drive`);
          }
          quanTamCount++;
        }
      }
      
      // Complete task
      const completed = await completeTask(task);
      if (completed) { completedCount++; log(`  Completed: ${task.KY_HIEU}`); }
      
      allDocs.push(docInfo);
      
      // Save data
      const data = { docs: allDocs, folderCounter };
      fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(data, null, 2));
      
      // Update Sheet periodically
      const quanTamDocs = allDocs.filter(d => d.quanTam);
      if (quanTamDocs.length > 0 && (quanTamDocs.length % 10 === 0 || i === tasks.length - 1)) {
        const sheetInfo = await updateGoogleSheet(quanTamDocs);
        if (sheetInfo) status.sheetUrl = sheetInfo.sheetUrl;
      }
      
      status.processed = completedCount;
      status.quanTam = quanTamCount;
      status.files = fileCount;
      await updateGist(status);
    }
    
    // Final Sheet update
    const quanTamDocs = allDocs.filter(d => d.quanTam);
    if (quanTamDocs.length > 0) {
      const sheetInfo = await updateGoogleSheet(quanTamDocs);
      if (sheetInfo) status.sheetUrl = sheetInfo.sheetUrl;
    }
    
    status.status = 'success';
    status.isProcessing = false;
    status.message = `Hoàn thành: ${completedCount}/${tasks.length} công việc, ${quanTamCount} quan tâm, ${fileCount} file`;
    log(status.message);
    
    writeStatus(status);
    await updateGist(status);
    
    // Load data to get sheetCsvUrl for status
    if (fs.existsSync(CONFIG.DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, 'utf8'));
      if (data.sheetCsvUrl) {
        status.sheetCsvUrl = data.sheetCsvUrl;
        writeStatus(status);
      }
    }
    
  } catch(e) {
    log('FATAL ERROR: ' + e.message + '\n' + e.stack);
    status.status = 'error';
    status.message = e.message;
    status.isProcessing = false;
    writeStatus(status);
    await updateGist(status);
  }
  
  if (browser) await browser.close();
  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
