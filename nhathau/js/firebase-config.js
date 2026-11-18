// Cấu hình Firebase của anh
const firebaseConfig = {
  apiKey: "AIzaSyCkBRre5ajocg0EIuOchb6QknsdL6Qq9FA",
  authDomain: "theantoan-fea9e.firebaseapp.com",
  databaseURL: "https://theantoan-fea9e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "theantoan-fea9e",
  storageBucket: "theantoan-fea9e.firebasestorage.app",
  messagingSenderId: "161371447668",
  appId: "1:161371447668:web:3f3c2f9c0b967ace91cc21",
  measurementId: "G-G5R89QH44C"
};

// URL Web App của Google Apps Script
const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzLUF62xbP-ce9XosKnDd1JK-5JCZtuo3--QJmH3CMj0j513KnFUH3_n-wftPG8BvyHeg/exec";

// Khởi tạo Firebase (Sử dụng Compat SDK v10 để chạy trực tiếp trên HTML tĩnh không cần build tool)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
