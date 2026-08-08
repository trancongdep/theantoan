// CẤU HÌNH FIREBASE - PROJECT: THEANTOAN-FEA9E
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

// Khởi tạo Firebase SDK
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// STATE HỆ THỐNG
let currentTool = null;
let sys = { 
    cb2: true, 
    has_hasp: false, 
    lock_count: 0,   
    tagged: false 
};
let userName = "Guest";
let workerPresent = true;

// LẮNG NGHE TỰ ĐỘNG ĐĂNG NHẬP
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        onUser(user);
    }
});

// PHÍM TẮT DESKTOP
window.addEventListener('keydown', (e) => {
    if (document.getElementById('screen-login').classList.contains('show')) return;
    
    switch(e.key) {
        case '1': selectTool('hasp'); break;
        case '2': selectTool('lock'); break;
        case '3': selectTool('tag'); break;
        case '4': selectTool('keybox'); break;
        case '5': selectTool('meter'); break;
        case '6': selectTool('speaker'); break;
        case 'Escape': clearTool(); break;
        case ' ': 
            e.preventDefault();
            handleTapCB(2); 
            break;
    }
});

// XỬ LÝ ĐĂNG NHẬP GOOGLE & FALLBACK
function doLogin() {
    showToast("Đang kết nối Google...");
    const provider = new firebase.auth.GoogleAuthProvider();
    
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            onUser(result.user);
        })
        .catch((error) => {
            console.warn("Firebase Auth Warning:", error);
            const fallbackEmail = prompt(
                `Xác thực Popup (${error.code || 'Môi trường Cục bộ'}).\nNhập email làm việc của bạn:`, 
                "deptc.gvatvsld@gmail.com"
            );
            
            if (fallbackEmail && fallbackEmail.trim() !== "") {
                onUser({ email: fallbackEmail.trim() });
            } else {
                showToast("Đã hủy đăng nhập");
            }
        });
}

function onUser(u) {
    if (!u || !u.email) return;
    const loginScreen = document.getElementById('screen-login');
    if (loginScreen) loginScreen.classList.remove('show');
    
    userName = u.email.split('@')[0];
    document.getElementById('user-display').innerText = userName;
    nav('tab-device');
    logAction("Đăng nhập hệ thống thành công");
    
    if (u.email === 'deptc.gvatvsld@gmail.com') {
        const instMenu = document.getElementById('menu-instructor');
        if (instMenu) instMenu.style.display = 'block';
    }
}

// NAVIGATION
function toggleSidebar() { 
    document.getElementById('sidebar').classList.toggle('active'); 
    document.getElementById('backdrop').classList.toggle('show'); 
}

function closeSidebar() { 
    document.getElementById('sidebar').classList.remove('active'); 
    document.getElementById('backdrop').classList.remove('show'); 
}

function nav(tabId) {
    if (window.innerWidth < 1024) {
        document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('show'));
        const targetTab = document.getElementById(tabId);
        if (targetTab) targetTab.classList.add('show');
        
        document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
        const activeNavBtn = document.getElementById(`bnav-${tabId}`);
        if(activeNavBtn) activeNavBtn.classList.add('active');
        
        closeSidebar();
    }
}

// TOOL SELECTION
function selectTool(type) {
    currentTool = type;
    const map = { 
        lock: "Ổ Khóa An Toàn", 
        hasp: "Khóa Kéo Dài", 
        tag: "Thẻ Cảnh Báo", 
        keybox: "Hộp Key Box", 
        meter: "Đồng Hồ VOM", 
        speaker: "Loa Thông Báo" 
    };
    document.getElementById('active-tool-hud').classList.add('show');
    document.getElementById('hud-icon').innerText = "🔧";
    document.getElementById('hud-text').innerText = map[type];
    closeSidebar();
    logAction(`Lấy dụng cụ: ${map[type]}`);
}

function clearTool() {
    currentTool = null;
    document.getElementById('active-tool-hud').classList.remove('show');
}

// INTERACTIONS & CIRCUIT CONTROL
function toggleMachine(run) {
    const blades = document.querySelectorAll('.blade');
    const st = document.getElementById('machine-status');
    if(run && sys.cb2) {
        blades.forEach(b => b.style.animation = "spin 0.2s linear infinite");
        st.innerText = "ĐANG CHẠY"; st.style.color = "var(--success)";
        logAction("Bấm START quạt số 2");
    } else {
        blades.forEach(b => b.style.animation = "none");
        st.innerText = "ĐÃ DỪNG"; st.style.color = "#bdc3c7";
        logAction("Bấm STOP quạt số 2");
    }
}

function handleTapCB(id) {
    if (id === 2) {
        if (currentTool === 'hasp') {
            if(sys.cb2) { showToast("⚡ Lỗi: Còn điện! Hãy gạt OFF CB trước."); logAction("Lỗi: Kẹp Hasp khi còn điện", true); return; }
            if(sys.has_hasp) { showToast("Đã kẹp Hasp rồi!"); return; }
            
            sys.has_hasp = true;
            updateLockVisuals();
            logAction("Đã kẹp khóa kéo dài (Hasp) vào CB-2");
            clearTool();
        } 
        else if (currentTool === 'lock') {
            if(sys.cb2) { showToast("⚡ Lỗi: CB còn điện!"); return; }
            
            if (sys.has_hasp) {
                 sys.lock_count++;
                 updateLockVisuals();
                 logAction(`Đã mắc thêm ổ khóa số ${sys.lock_count} vào Hasp`);
                 showToast(`Đã móc khóa số ${sys.lock_count}`);
                 clearTool();
            } else {
                 if(sys.lock_count > 0) { showToast("Đã có khóa đơn rồi"); return; }
                 sys.lock_count = 1;
                 updateLockVisuals();
                 logAction("Đã khóa an toàn (Khóa đơn)");
                 clearTool();
            }
        } 
        else if (currentTool === 'tag') {
            if(sys.lock_count === 0) { showToast("⚠️ Phải treo khóa trước khi treo thẻ!"); return; }
            sys.tagged = true;
            document.getElementById('cb2-tag-viz').innerHTML = '<div class="vis-tag">🏷️</div>';
            logAction("Đã treo thẻ cảnh báo LOTO"); 
            clearTool();
        } 
        else if (currentTool === 'meter') {
            showToast("⏳ Đang đo điện áp...");
            setTimeout(() => {
                const res = sys.cb2 ? "380V (CÓ ĐIỆN)" : "0V (ĐÃ CẮT ĐIỆN)";
                showToast(`Kết quả đo: ${res}`);
                logAction(`Kiểm tra điện áp VOM tại CB-2: ${res}`);
            }, 800);
        } 
        else if (!currentTool) {
            if(sys.lock_count > 0 || sys.has_hasp) { 
                showToast("⛔ Không thể gạt! CB đã bị khóa LOTO."); 
                logAction("Cảnh báo: Cố tình gạt CB khi đang khóa LOTO", true);
                return; 
            }
            
            sys.cb2 = !sys.cb2;
            toggleMachine(sys.cb2);
            
            const el = document.getElementById('cb2-lever');
            if (sys.cb2) {
                el.classList.remove('off'); el.innerText = "ON";
            } else {
                el.classList.add('off'); el.innerText = "OFF";
            }
            
            updateDynamicDiagram(sys.cb2);
            logAction(`Gạt tay CB-2 sang vị trí: ${sys.cb2 ? 'ON' : 'OFF'}`);
        }
    } else {
        if(!currentTool) {
            const el = document.getElementById(`cb${id}-lever`);
            el.classList.toggle('off'); 
            el.innerText = el.classList.contains('off') ? "OFF" : "ON";
            logAction(`Gạt CB-${id}: ${el.innerText}`);
        }
    }
}

// SƠ ĐỒ ĐƠN TUYẾN ĐỘNG
function updateDynamicDiagram(isLive) {
    const liveColor = "#e74c3c";
    const safeColor = "#2ecee0";

    const wires = ['wire-after-cb2', 'wire-km2-ol', 'wire-to-motor'];
    wires.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.setAttribute('stroke', isLive ? liveColor : safeColor);
    });

    const motor = document.getElementById('svg-motor-symbol');
    if(motor) motor.setAttribute('fill', isLive ? liveColor : safeColor);

    const cbBox = document.getElementById('svg-cb2-box');
    const cbText = document.getElementById('svg-cb2-text');
    
    if(cbBox && cbText) {
        cbBox.setAttribute('stroke', isLive ? liveColor : safeColor);
        cbText.setAttribute('fill', isLive ? liveColor : safeColor);
        cbText.textContent = isLive ? "CB-2 (ON)" : "CB-2 (OFF)";
    }

    const stText = document.getElementById('diagram-status-text');
    const voltText = document.getElementById('diagram-voltage-text');
    
    if(stText && voltText) {
        stText.textContent = isLive ? "MẠCH MANG ĐIỆN" : "CÁCH LY AN TOÀN";
        stText.style.color = isLive ? liveColor : safeColor;
        voltText.textContent = isLive ? "380V" : "0V";
    }
}

function updateLockVisuals() {
    const container = document.getElementById('cb2-locks');
    let html = '';
    
    if(sys.has_hasp) {
        html += '<div class="vis-hasp">🔗</div>';
    }
    
    if(sys.lock_count > 0) {
         if(sys.has_hasp) {
             if(sys.lock_count >= 1) html += '<div class="vis-lock lock-1">🔒</div>';
             if(sys.lock_count >= 2) html += '<div class="vis-lock lock-2">🔒</div>';
             if(sys.lock_count >= 3) html += '<div class="vis-lock lock-3">🔒</div>';
         } else {
             html += '<div class="vis-lock">🔒</div>';
         }
    }
    container.innerHTML = html;
}

function handleTapMachine() {
    if(currentTool === 'speaker') {
        logAction("Phát loa thông báo an toàn");
        showToast("📢 Đã phát loa thông báo");
        speak("Chú ý! Chuẩn bị cắt điện bảo trì quạt số 2.");
        
        if(workerPresent) {
            setTimeout(() => {
                document.getElementById('worker-npc').classList.add('worker-walk-out');
                workerPresent = false;
                logAction("Công nhân vận hành đã rời khu vực nguy hiểm");
            }, 1800);
        }
        clearTool();
    }
}

function handlePermit() {
    logAction("Yêu cầu Cho phép làm việc (Work Permit)");
    const worker = document.getElementById('worker-npc');
    const svg = worker.querySelector('.worker-svg');
    
    worker.className = 'worker-container'; 
    svg.classList.remove('shocked');
    setTimeout(() => worker.classList.add('worker-walk-in'), 100);

    setTimeout(() => {
        let unsafe = false;
        if(sys.cb2) unsafe = true;
        if(sys.lock_count === 0) unsafe = true; 

        if(unsafe) {
            svg.classList.add('shocked');
            document.getElementById('shock-flash').style.display = 'block';
            logAction("TAI NẠN: ĐIỆN GIẬT DO CHƯA CẮT ĐIỆN/KHÓA LOTO!", true);
            showToast("⚡ TAI NẠN NGHIÊM TRỌNG!");
            
            setTimeout(() => {
                 document.getElementById('shock-flash').style.display = 'none';
                 document.getElementById('reset-overlay').style.display = 'flex';
            }, 4000);
        } else {
            logAction("An toàn tuyệt đối. Công nhân tiến hành sửa chữa.", false);
            showToast("✅ An toàn. Bắt đầu công việc.");
        }
    }, 1200);
}

function resetSimulation() {
    sys = { cb2: true, has_hasp: false, lock_count: 0, tagged: false };
    updateLockVisuals();
    document.getElementById('cb2-tag-viz').innerHTML = '';
    
    const el = document.getElementById('cb2-lever');
    el.classList.remove('off'); el.innerText = "ON";
    toggleMachine(true);
    updateDynamicDiagram(true);

    workerPresent = true;
    const worker = document.getElementById('worker-npc');
    const svg = worker.querySelector('.worker-svg');
    worker.className = 'worker-container';
    svg.classList.remove('shocked');

    document.getElementById('reset-overlay').style.display = 'none';
    document.getElementById('shock-flash').style.display = 'none';
    
    nav('tab-device');
    logAction("--- HỆ THỐNG RESET MÔ PHỎNG ---");
    showToast("Đã làm mới hệ thống");
}

function speak(text) {
    if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'vi-VN';
        speechSynthesis.speak(u);
    }
}

function logAction(action, isDanger = false) {
    const container = document.getElementById('log-container');
    if (!container) return;
    const time = new Date().toLocaleTimeString();
    const dangerClass = isDanger ? 'log-danger' : '';
    container.innerHTML += `<div class="log-entry"><span style="color:#888">[${time}]</span> <span style="color:var(--primary)">${userName}:</span> <span class="${dangerClass}">${action}</span></div>`;
    container.scrollTop = container.scrollHeight;
}

function showToast(m) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.innerText = m; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}
