/**
 * LĐCT-OPMS v1.0 — Cấu hình Firebase & Google Apps Script
 * Điền thông tin thực tế từ Firebase Console và Google Apps Script Deployment
 */
const firebaseConfig = {
  apiKey: "DIEN_API_KEY_FIREBASE",
  authDomain: "DIEN_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://DIEN_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "DIEN_PROJECT_ID",
  storageBucket: "DIEN_PROJECT_ID.appspot.com",
  messagingSenderId: "DIEN_SENDER_ID",
  appId: "DIEN_APP_ID"
};

const GAS_WEBAPP_URL = "https://script.google.com/macros/s/DIEN_DEPLOYMENT_ID/exec";
const API_SECRET_TOKEN = "LDCT2_OPMS_2026_SECRET_KEY"; // Phải khớp 100% với backend_gas/Code.gs

// Khởi tạo Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.database();

const APP_CONSTANTS = {
  UNIT_NAME: "Đội QLLĐ 2 — Công ty Lưới điện Cao thế TP.HCM",
  REGULATION: "4086/QĐ-EVNHCMC",
  PMIS_SLA_HOURS: 48,
  ROLES: {
    CAPTAIN: "Đội trưởng / Đội phó QLLĐ",
    TEAM_LEAD: "Tổ trưởng QLVH",
    INSPECTOR: "Nhân viên kiểm tra QLVH",
    VIEWER: "Phòng KTVH / An toàn (Chỉ xem)"
  }
};
