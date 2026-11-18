/**
 * LĐCT-OPMS v1.0 — Backend Google Apps Script (Code.gs)
 * Triển khai Web App: Execute as "Me", Who has access "Anyone"
 */

const SPREADSHEET_ID = "DIEN_SPREADSHEET_ID_CUA_BAN";
const ROOT_FOLDER_ID = "DIEN_ROOT_FOLDER_ID_CUA_BAN";
const API_SECRET_TOKEN = "LDCT2_OPMS_2026_SECRET_KEY"; // Phải khớp 100% với js/firebase-config.js

const SHEETS_SCHEMA = {
  DM_Tuyen_Tru: [
    "AssetID", "MaTuyen", "TenTuyen", "CapDienAp", "LoaiTaiSan",
    "ViTriTru_Ham", "Lat", "Lng", "DoiQLVH", "NgayCapNhat"
  ],
  Giao_Viec_KH: [
    "TaskID", "LoaiCongTac", "MaTuyen", "PhamViViTri", "NguoiThucHien",
    "NguoiGiao", "HanHoanThanh", "TrangThai", "NgayTao"
  ],
  Nhat_Ky_Kiem_Tra: [
    "RecordID", "TaskID", "AssetID", "LoaiKT", "NguoiKT", "ThoiGianKT",
    "Lat", "Lng", "KetQua", "ChiTietChecklist", "GhiChu", "DriveFolderURL",
    "TrangThaiDuyet", "NguoiDuyet", "ThoiGianDuyet", "PMIS_Status"
  ],
  Chi_So_CBM_CHI: [
    "CBM_ID", "AssetID", "NguoiDo", "ThoiGianDo", "NhietDoMoiNoi_C",
    "NhietDoMoiTruong_C", "DeltaT_C", "PD_pC", "HVDC_kV", "DAR",
    "CHI_Score", "MucDanhGia", "KichHoatTier3", "DriveImageURL"
  ],
  Ton_Tai: [
    "DefectID", "RecordID", "AssetID", "MaTuyen", "MoTaTonTai",
    "MucDo", "HanXuLy", "TrangThai", "NguoiMo", "NguoiDong", "NgayDong"
  ],
  Export_PMIS: [
    "PMIS_SyncID", "RecordID", "MaTuyen", "ViTriTru_Ham", "LoaiKiemTra_4086",
    "NgayKiemTra", "KetQuaTongHop", "CHI_Score", "TonTaiPhatSinh",
    "HanCapNhat_48h", "DaNhapPMIS", "LinkBienBanPDF"
  ]
};

/**
 * Chạy hàm này 1 lần đầu trong trình soạn thảo Apps Script để tạo đủ 6 tab chuẩn cột
 */
function setupDatabase() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Object.keys(SHEETS_SCHEMA).forEach((sheetName) => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(SHEETS_SCHEMA[sheetName]);
      sheet.getRange(1, 1, 1, SHEETS_SCHEMA[sheetName].length)
        .setFontWeight("bold")
        .setBackground("#0F4C81")
        .setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }
  });
  return { status: "OK", message: "Đã khởi tạo đủ 6 sheet chuẩn LĐCT-OPMS v1.0" };
}

function doGet(e) {
  try {
    const token = e.parameter.token;
    if (token !== API_SECRET_TOKEN) {
      return jsonResponse({ ok: false, error: "Unauthorized token" });
    }
    const action = e.parameter.action || "ping";
    if (action === "ping") {
      return jsonResponse({ ok: true, service: "LDCT-OPMS v1.0 GAS Backend", timestamp: new Date().toISOString() });
    }
    if (action === "exportPMIS") {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sheet = ss.getSheetByName("Export_PMIS");
      const data = sheet ? sheet.getDataRange().getValues() : [];
      return jsonResponse({ ok: true, rows: data });
    }
    return jsonResponse({ ok: false, error: "Unknown GET action" });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (payload.token !== API_SECRET_TOKEN) {
      return jsonResponse({ ok: false, error: "Unauthorized token" });
    }

    const action = payload.action;
    switch (action) {
      case "saveInspection":
        return jsonResponse(handleSaveInspection(payload.data));
      case "saveCBM":
        return jsonResponse(handleSaveCBM(payload.data));
      case "saveSurvey":
        return jsonResponse(handleSaveSurvey(payload.data));
      case "syncAsset":
        return jsonResponse(handleSyncAsset(payload.data));
      case "updateDefect":
        return jsonResponse(handleUpdateDefect(payload.data));
      case "markPMISSynced":
        return jsonResponse(handleMarkPMISSynced(payload.data));
      default:
        return jsonResponse({ ok: false, error: "Unsupported action: " + action });
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

function handleSaveInspection(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const folderUrl = saveMediaToDrive(
    data.maTuyen || "CHUNG",
    data.loaiKT || "KT_NGAY",
    data.recordId,
    data.photos || []
  );

  const pdfUrl = generateInspectionPDF(data, folderUrl);

  const logSheet = ss.getSheetByName("Nhat_Ky_Kiem_Tra");
  logSheet.appendRow([
    data.recordId,
    data.taskId || "",
    data.assetId || "",
    data.loaiKT || "",
    data.nguoiKT || "",
    data.thoiGianKT || new Date().toISOString(),
    data.lat || "",
    data.lng || "",
    data.ketQua || "DAT",
    JSON.stringify(data.checklist || {}),
    data.ghiChu || "",
    folderUrl,
    data.trangThaiDuyet || "SUBMITTED",
    data.nguoiDuyet || "",
    data.thoiGianDuyet || "",
    "PENDING_PMIS"
  ]);

  // Tự mở Ticket tồn tại nếu không đạt
  if (data.ketQua === "KHONG_DAT" || (data.tonTai && data.tonTai.trim() !== "")) {
    const defSheet = ss.getSheetByName("Ton_Tai");
    const defectId = "DEF-" + data.recordId;
    defSheet.appendRow([
      defectId,
      data.recordId,
      data.assetId || "",
      data.maTuyen || "",
      data.tonTai || data.ghiChu || "Phát hiện khiếm khuyết hiện trường",
      data.mucDo || "TRUNG_BINH",
      data.hanXuLy || "",
      "OPEN",
      data.nguoiKT || "",
      "",
      ""
    ]);
  }

  // Ghi dòng chờ đồng bộ PMIS (SLA 48h)
  const pmisSheet = ss.getSheetByName("Export_PMIS");
  const now = new Date();
  const slaDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  pmisSheet.appendRow([
    "PMIS-" + data.recordId,
    data.recordId,
    data.maTuyen || "",
    data.assetId || "",
    data.loaiKT || "",
    data.thoiGianKT || now.toISOString(),
    data.ketQua || "DAT",
    data.chiScore || "",
    data.tonTai || "Không",
    slaDeadline.toISOString(),
    "CHUA_NHAP",
    pdfUrl
  ]);

  return { ok: true, recordId: data.recordId, folderUrl: folderUrl, pdfUrl: pdfUrl };
}

function handleSaveCBM(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const folderUrl = saveMediaToDrive(
    data.maTuyen || "CBM",
    "KT_KY_THUAT_CBM",
    data.cbmId,
    data.photos || []
  );

  const cbmSheet = ss.getSheetByName("Chi_So_CBM_CHI");
  cbmSheet.appendRow([
    data.cbmId,
    data.assetId || "",
    data.nguoiDo || "",
    data.thoiGianDo || new Date().toISOString(),
    data.nhietDoMoiNoi || "",
    data.nhietDoMoiTruong || "",
    data.deltaT || "",
    data.pd || "",
    data.hvdc || "",
    data.dar || "",
    data.chiScore || "",
    data.mucDanhGia || "",
    data.kichHoatTier3 ? "CO" : "KHONG",
    folderUrl
  ]);

  if (Number(data.chiScore) < 4.0 || Number(data.deltaT) > 20) {
    const defSheet = ss.getSheetByName("Ton_Tai");
    defSheet.appendRow([
      "DEF-" + data.cbmId,
      data.cbmId,
      data.assetId || "",
      data.maTuyen || "",
      "CBM Cảnh báo: CHI=" + data.chiScore + ", ΔT=" + data.deltaT + "°C, PD=" + data.pd + "pC",
      Number(data.chiScore) < 4.0 ? "NGHIEM_TRONG" : "TRUNG_BINH",
      data.hanXuLy || "",
      "OPEN",
      data.nguoiDo || "",
      "",
      ""
    ]);
  }

  return { ok: true, cbmId: data.cbmId, folderUrl: folderUrl };
}

function handleSaveSurvey(data) {
  return handleSaveInspection({
    recordId: data.surveyId,
    taskId: data.taskId,
    assetId: data.assetId,
    maTuyen: data.maTuyen,
    loaiKT: "KHAO_SAT_HIEN_TRUONG",
    nguoiKT: data.nguoiLap,
    thoiGianKT: data.thoiGian,
    lat: data.lat,
    lng: data.lng,
    ketQua: "HOAN_THANH",
    checklist: data.ranhGioiAnToan || {},
    ghiChu: data.noiDungBaoCao || "",
    photos: data.photos || [],
    trangThaiDuyet: data.trangThaiDuyet || "SUBMITTED"
  });
}

function handleSyncAsset(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("DM_Tuyen_Tru");
  sheet.appendRow([
    data.assetId,
    data.maTuyen,
    data.tenTuyen,
    data.capDienAp,
    data.loaiTaiSan,
    data.viTri,
    data.lat,
    data.lng,
    data.doiQLVH || "Đội QLLĐ 2",
    new Date().toISOString()
  ]);
  return { ok: true, assetId: data.assetId };
}

function handleUpdateDefect(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Ton_Tai");
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.defectId) {
      sheet.getRange(i + 1, 8).setValue(data.trangThai || "CLOSED");
      sheet.getRange(i + 1, 10).setValue(data.nguoiDong || "");
      sheet.getRange(i + 1, 11).setValue(new Date().toISOString());
      return { ok: true, defectId: data.defectId };
    }
  }
  return { ok: false, error: "Defect not found" };
}

function handleMarkPMISSynced(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Export_PMIS");
  const values = sheet.getDataRange().getValues();
  const ids = data.recordIds || [];
  for (let i = 1; i < values.length; i++) {
    if (ids.indexOf(values[i][1]) !== -1) {
      sheet.getRange(i + 1, 11).setValue("DA_NHAP_PMIS");
    }
  }
  return { ok: true, count: ids.length };
}

function saveMediaToDrive(maTuyen, loaiKT, recordId, photos) {
  const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const now = new Date();
  const monthKey = Utilities.formatDate(now, "Asia/Ho_Chi_Minh", "yyyy-MM");

  const monthFolder = getOrCreateFolder(root, monthKey);
  const lineFolder = getOrCreateFolder(monthFolder, maTuyen);
  const typeFolder = getOrCreateFolder(lineFolder, loaiKT);
  const recordFolder = getOrCreateFolder(typeFolder, recordId);

  photos.forEach((p, idx) => {
    if (!p.base64) return;
    const raw = p.base64.split(",").pop();
    const blob = Utilities.newBlob(
      Utilities.base64Decode(raw),
      p.mimeType || "image/jpeg",
      p.filename || (recordId + "_img_" + (idx + 1) + ".jpg")
    );
    recordFolder.createFile(blob);
  });

  return recordFolder.getUrl();
}

function generateInspectionPDF(data, folderUrl) {
  try {
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 24px;">
        <h2 style="color:#0F4C81; margin-bottom:4px;">BIÊN BẢN KIỂM TRA / BÁO CÁO HIỆN TRƯỜNG (4086/QĐ-EVNHCMC)</h2>
        <p style="color:#475569; font-size:12px;">Mã phiếu: <b>${data.recordId}</b> | Tuyến: <b>${data.maTuyen || ""}</b> | Vị trí: <b>${data.assetId || ""}</b></p>
        <hr/>
        <p><b>Loại hình:</b> ${data.loaiKT || ""}</p>
        <p><b>Người thực hiện:</b> ${data.nguoiKT || ""}</p>
        <p><b>Thời gian:</b> ${data.thoiGianKT || ""}</p>
        <p><b>Tọa độ GPS:</b> ${data.lat || ""}, ${data.lng || ""}</p>
        <p><b>Kết quả đánh giá:</b> ${data.ketQua || ""}</p>
        <p><b>Ghi chú / Tồn tại:</b> ${data.ghiChu || "Không có"}</p>
        <p><b>Kho ảnh hiện trường:</b> <a href="${folderUrl}">${folderUrl}</a></p>
      </div>
    `;
    const blob = Utilities.newBlob(html, "text/html", data.recordId + ".html").getAs("application/pdf");
    blob.setName("BienBan_" + data.recordId + ".pdf");
    const folderId = folderUrl.split("/folders/").pop().split("?")[0];
    const file = DriveApp.getFolderById(folderId).createFile(blob);
    return file.getUrl();
  } catch (err) {
    return folderUrl;
  }
}

function getOrCreateFolder(parent, name) {
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
