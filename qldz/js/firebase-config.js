const firebaseConfig = {
  apiKey: "AIzaSyAT0HsIPakq4kQ5metSQuNIO_opQoA2UTY",
  authDomain: "ldct-opms-v1.firebaseapp.com",
  databaseURL: "https://ldct-opms-v1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ldct-opms-v1",
  storageBucket: "ldct-opms-v1.firebasestorage.app",
  messagingSenderId: "1050649873198",
  appId: "1:1050649873198:web:24d1e2c56ad7e3e7bfc8bf",
  measurementId: "G-G3C7S70E05"
};

const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxaAlg1dXhhDJIWZTqZRfQKFjvXqc_6wxYYq6lOFey1z-5jPHtqLDHyC3d__ZWzNcgdDQ/exec";
const API_SECRET_TOKEN = "LDCT2_OPMS_2026_SECRET_KEY";

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

const APP_CONSTANTS = {
  APP_VERSION: "v1.1",
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