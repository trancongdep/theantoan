// QUẢN LÝ PHIÊN BẢN ỨNG DỤNG
const APP_VERSION = "1.2";
const DEFAULT_PASS = "0399496319";

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

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// STATE HỆ THỐNG
let currentTool = null;
let userName = "Chưa đăng nhập";
let workerPresent = true;
let activeControlMode = "panel"; // 'panel' hoặc 'hmi'

let sys = { 
    cb1: true,
    cb2: true, 
    has_hasp: false, 
    lock_count: 0,   
    tagged: false,
    ground_earth_connected: false,
    ground_phase_connected: false,
    barrier_placed: false,
    signs: { prohibit: false, danger: false, work: false }
};

// CẤU TRÚC ĐỒ THỊ MẠCH ĐIỆN (GRAPH TOPOLOGY - BFS ENGINE)
let circuitGraph = {
    sources: ["BUSBAR_L1"],
    devices: {
        "CB1": { id: "CB1", type: "switch", inNode: "BUSBAR_L1", outNode: "NODE_CB1_OUT", state: true },
        "CB2": { id: "CB2", type: "switch", inNode: "BUSBAR_L1", outNode: "NODE_CB2_OUT", state: true },
        "MOTOR_M2": { id: "MOTOR_M2", type: "load", inNodes: ["NODE_CB1_OUT", "NODE_CB2_OUT"] }
    },
    wires: [
        { id: "w_bus_cb1", from: "BUSBAR_L1", to: "CB1" },
        { id: "w_cb1_m2", from: "CB1", to: "MOTOR_M2" },
        { id: "w_bus_cb2", from: "BUSBAR_L1", to: "CB2" },
        { id: "w_cb2_m2", from: "CB2", to: "MOTOR_M2" }
    ]
};

// KHỞI TẠO TỰ ĐỘNG KHI TẢI TRANG
document.addEventListener("DOMContentLoaded", () => {
    const vLogin = document.getElementById("login-version-display");
    const vHeader = document.getElementById("header-version-display");
    if (vLogin) vLogin.textContent = `v${APP_VERSION}`;
    if (vHeader) vHeader.textContent = `v${APP_VERSION}`;
});

// CHUYỂN ĐỔI CHẾ ĐỘ THAO TÁC (TỦ ĐIỆN THỰC TẾ / MÀN HÌNH HMI)
function switchControlMode(mode) {
    activeControlMode = mode;
    const panelView = document.getElementById('view-panel-mode');
    const hmiView = document.getElementById('view-hmi-mode');
    const btnPanel = document.getElementById('btn-mode-panel');
    const btnHMI = document.getElementById('btn-mode-hmi');

    if (mode === 'panel') {
        if (panelView) panelView.style.display = 'block';
        if (hmiView) hmiView.style.display = 'none';
        if (btnPanel) btnPanel.classList.add('active');
        if (btnHMI) btnHMI.classList.remove('active');
        logAction("Chuyển chế độ thao tác: Tủ Điện Thực Tế");
    } else {
        if (panelView) panelView.style.display = 'none';
        if (hmiView) hmiView.style.display = 'block';
        if (btnPanel) btnPanel.classList.remove('active');
        if (btnHMI) btnHMI.classList.add('active');
        logAction("Chuyển chế độ thao tác: Màn Hình HMI Số");
    }
    updateHMIDisplay();
}

// XỬ LÝ ĐĂNG NHẬP VÀ GHI LƯỢT SỬ DỤNG VÀO FIREBASE
function handleLoginSubmit(event) {
    event.preventDefault();
    const fullNameInput = document.getElementById('input-fullname');
    const passwordInput = document.getElementById('input-password');

    const fullName = fullNameInput ? fullNameInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value.trim() : "";

    if (!fullName) {
        showToast("⚠️ Vui lòng nhập Họ và Tên!");
        return;
    }

    if (password !== DEFAULT_PASS) {
        showToast("❌ Mật khẩu không đúng!");
        return;
    }

    userName = fullName;

    try {
        const loginData = {
            fullName: fullName,
            loginTime: new Date().toLocaleString('vi-VN'),
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            appVersion: APP_VERSION,
            userAgent: navigator.userAgent
        };

        firebase.database().ref('user_logins').push(loginData);
    } catch (e) {
        console.warn("Firebase Database error:", e);
    }

    const loginScreen = document.getElementById('screen-login');
    if (loginScreen) {
        loginScreen.classList.remove('show');
        loginScreen.style.setProperty('display', 'none', 'important');
    }

    const userDisp = document.getElementById('user-display');
    if (userDisp) userDisp.innerText = userName;

    nav('tab-device');
    solveAndRenderCircuit();
    logAction(`Đăng nhập hệ thống: ${userName}`);
    showToast(`Xin chào ${userName}!`);
}

// THUẬT TOÁN BREADTH-FIRST SEARCH (BFS) TỰ ĐỘNG GIẢI MẠCH ĐIỆN
function solveCircuitBFS(graph) {
    const liveNodes = new Set(graph.sources);
    const liveWires = new Set();
    const liveDevices = new Set();
    const queue = [...graph.sources];

    while (queue.length > 0) {
        const currentNode = queue.shift();

        graph.wires.forEach(wire => {
            if (wire.from === currentNode) {
                const target = wire.to;

                if (graph.devices[target]) {
                    const dev = graph.devices[target];
                    
                    if (dev.type === 'switch') {
                        if (dev.state === true) {
                            liveWires.add(wire.id);
                            liveDevices.add(target);
                            if (!liveNodes.has(dev.outNode)) {
                                liveNodes.add(dev.outNode);
                                queue.push(dev.outNode);
                            }
                        }
                    } else if (dev.type === 'load') {
                        liveWires.add(wire.id);
                        liveDevices.add(target);
                    }
                } else if (graph.devices[currentNode]) {
                    liveWires.add(wire.id);
                    if (!liveNodes.has(target)) {
                        liveNodes.add(target);
                        queue.push(target);
                    }
                }
            }
        });
    }

    return { liveNodes, liveWires, liveDevices };
}

// CẬP NHẬT GIAO DIỆN SƠ ĐỒ VÀ MÀN HÌNH HMI DỰA TRÊN KẾT QUẢ BFS
function solveAndRenderCircuit() {
    const { liveWires, liveDevices } = solveCircuitBFS(circuitGraph);
    const liveColor = "#e74c3c";
    const safeColor = "#2ecee0";

    circuitGraph.wires.forEach(wire => {
        const el = document.getElementById(wire.id);
        if (el) el.setAttribute('stroke', liveWires.has(wire.id) ? liveColor : safeColor);
    });

    Object.keys(circuitGraph.devices).forEach(devId => {
        const dev = circuitGraph.devices[devId];
        const el = document.getElementById(devId);
        const txt = document.getElementById(`txt-${devId}`);
        const isLive = liveDevices.has(devId);

        if (dev.type === 'switch') {
            if (el) el.setAttribute('stroke', dev.state ? liveColor : safeColor);
            if (txt) {
                txt.setAttribute('fill', dev.state ? liveColor : safeColor);
                txt.textContent = `${devId} (${dev.state ? 'ON' : 'OFF'})`;
            }
        } else if (dev.type === 'load') {
            if (el) el.setAttribute('fill', isLive ? liveColor : safeColor);
        }
    });

    const isMotorActive = liveDevices.has("MOTOR_M2");
    toggleMachineVisuals(isMotorActive);

    const stText = document.getElementById('diagram-status-text');
    const voltText = document.getElementById('diagram-voltage-text');
    if (stText && voltText) {
        stText.textContent = isMotorActive ? "MẠCH MANG ĐIỆN (380V)" : "CÁCH LY AN TOÀN (0V)";
        stText.style.color = isMotorActive ? liveColor : safeColor;
        voltText.textContent = isMotorActive ? "380V" : "0V";
    }

    updateHMIDisplay();
}

// CẬP NHẬT TRẠNG THÁI HIỂN THỊ TRÊN MÀN HÌNH HMI
function updateHMIDisplay() {
    const { liveDevices } = solveCircuitBFS(circuitGraph);
    const isMotorActive = liveDevices.has("MOTOR_M2");

    // CB1 LED
    const ledCB1 = document.getElementById('hmi-led-cb1');
    if (ledCB1) {
        const cb1State = circuitGraph.devices["CB1"].state;
        ledCB1.className = `hmi-led ${cb1State ? 'led-on' : 'led-off'}`;
        ledCB1.innerText = cb1State ? "ĐANG ĐÓNG (ON)" : "MỞ/TRIP (OFF)";
    }

    // CB2 LED
    const ledCB2 = document.getElementById('hmi-led-cb2');
    if (ledCB2) {
        const cb2State = circuitGraph.devices["CB2"].state;
        ledCB2.className = `hmi-led ${cb2State ? 'led-on' : 'led-off'}`;
        ledCB2.innerText = cb2State ? "ĐANG ĐÓNG (ON)" : "MỞ/TRIP (OFF)";
    }

    // LOTO MSG ON HMI
    const lotoMsg = document.getElementById('hmi-loto-msg-cb2');
    if (lotoMsg) {
        if (sys.lock_count > 0 || sys.has_hasp) {
            lotoMsg.innerText = "🔒 LOTO LOCKED - LOCAL CONTROL";
            lotoMsg.style.color = "#ff6b6b";
        } else {
            lotoMsg.innerText = "LOTO: BÌNH THƯỜNG";
            lotoMsg.style.color = "var(--warning)";
        }
    }

    // FOOTER
    const hmiVolt = document.getElementById('hmi-volt-disp');
    const hmiMotor = document.getElementById('hmi-motor-disp');
    if (hmiVolt) hmiVolt.innerText = isMotorActive ? "380V" : "0V";
    if (hmiMotor) {
        hmiMotor.innerText = isMotorActive ? "RUNNING" : "STOPPED";
        hmiMotor.style.color = isMotorActive ? "var(--success)" : "#aaa";
    }
}

// THAO TÁC ĐÓNG CẮT TỪ MÀN HÌNH HMI
function handleHMISwitch(id, targetState) {
    const cbKey = `CB${id}`;

    // Kiểm tra LOTO khóa cứng tại Tủ
    if (sys.lock_count > 0 || sys.has_hasp) {
        showToast(`⛔ HMI INTERLOCK: ${cbKey} đang bị Khóa LOTO tại Tủ!`);
        logAction(`HMI BLOCKED: Cố thao tác ${cbKey} qua HMI khi đã khóa LOTO`, true);
        return;
    }

    circuitGraph.devices[cbKey].state = targetState;
    sys[`cb${id}`] = targetState;

    // Đồng bộ cần gạt tủ điện thực tế
    const el = document.getElementById(`cb${id}-lever`);
    if (el) {
        if (targetState) {
            el.classList.remove('off'); el.innerText = "ON";
        } else {
            el.classList.add('off'); el.innerText = "OFF";
        }
    }

    solveAndRenderCircuit();
    logAction(`HMI CONTROL: ${targetState ? 'CLOSE (Đóng ON)' : 'TRIP (Ngắt OFF)'} ${cbKey}`);
    showToast(`HMI: Đã ${targetState ? 'ĐÓNG' : 'NGẮT'} ${cbKey}`);
}

function toggleMachineVisuals(run) {
    const blades = document.querySelectorAll('.blade');
    const st = document.getElementById('machine-status');
    if (run) {
        blades.forEach(b => b.style.animation = "spin 0.2s linear infinite");
        if(st) { st.innerText = "ĐANG CHẠY"; st.style.color = "var(--success)"; }
    } else {
        blades.forEach(b => b.style.animation = "none");
        if(st) { st.innerText = "ĐÃ DỪNG"; st.style.color = "#bdc3c7"; }
    }
}

function selectTool(type) {
    currentTool = type;
    const map = { 
        lock: "Ổ Khóa An Toàn", 
        hasp: "Khóa Kéo Dài", 
        tag: "Thẻ Cảnh Báo", 
        keybox: "Hộp Key Box", 
        meter: "Đồng Hồ VOM", 
        speaker: "Loa Thông Báo",
        earth_earth: "Tiếp Địa (Đầu Đất)",
        earth_phase: "Tiếp Địa (Đầu Pha)",
        barrier: "Rào Chắn An Toàn",
        sign_prohibit: "Biển Cấm Đóng Điện",
        sign_danger: "Biển Cảnh Báo Có Điện",
        sign_work: "Biển Làm Việc Tại Đây"
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

// THAO TÁC CÁC APTOMAT VỚI DỤNG CỤ TẠI TỦ THỰC TẾ
function handleTapCB(id) {
    const cbKey = `CB${id}`;
    const isLive = circuitGraph.devices[cbKey] ? circuitGraph.devices[cbKey].state : false;

    if (currentTool === 'earth_earth') {
        sys.ground_earth_connected = true;
        showToast("✅ Đã kẹp đầu ĐẤT của bộ tiếp địa vào vỏ tủ/hệ thống nối đất.");
        logAction("Đã kẹp tiếp địa: Đầu ĐẤT");
        clearTool();
        return;
    }

    if (currentTool === 'earth_phase') {
        if (!sys.ground_earth_connected) {
            showToast("❌ VI PHẠM: Phải kẹp đầu ĐẤT trước khi kẹp đầu PHA!");
            logAction("VI PHẠM QUY TRÌNH: Kẹp đầu Pha tiếp địa khi chưa kẹp đầu Đất", true);
            return;
        }

        if (isLive) {
            document.getElementById('shock-flash').style.display = 'block';
            logAction("TAI NẠN NGHÊM TRỌNG: Kẹp tiếp địa khi thiết bị ĐANG MANG ĐIỆN! Phóng điện hồ quang!", true);
            showToast("💥 TAI NẠN: NỔ HỒ QUANG ĐIỆN DO KẸP TIẾP ĐỊA CÓ ĐIỆN!");
            setTimeout(() => {
                document.getElementById('shock-flash').style.display = 'none';
                document.getElementById('reset-overlay').style.display = 'flex';
            }, 3000);
            return;
        }

        sys.ground_phase_connected = true;
        updateGroundVisuals();
        showToast("✅ Đã kẹp đầu PHA tiếp địa vào thanh cái sau CB.");
        logAction(`Đã kẹp tiếp địa di động đầu PHA vào ${cbKey}`);
        clearTool();
        return;
    }

    if (currentTool === 'sign_prohibit') {
        if (isLive) {
            showToast("⚠️ Phải gạt OFF CB trước khi treo Biển Cấm!");
            return;
        }
        sys.signs.prohibit = true;
        updateSignsVisuals();
        showToast("✅ Đã treo biển 'CẤM ĐÓNG ĐIỆN! CÓ NGUỜI ĐANG LÀM VIỆC'");
        logAction(`Treo biển Cấm đóng điện tại ${cbKey}`);
        clearTool();
        return;
    }

    if (currentTool === 'barrier') {
        sys.barrier_placed = true;
        updateBarrierVisuals();
        showToast("✅ Đã dựng rào chắn cách ly vùng mang điện lân cận.");
        logAction("Đã dựng rào chắn an toàn hiện trường");
        clearTool();
        return;
    }

    if (currentTool === 'sign_danger') {
        sys.signs.danger = true;
        updateSignsVisuals();
        showToast("✅ Đã treo biển 'DỪNG LẠI! CÓ ĐIỆN NGUY HIỂM CHẾT NGUỜI'");
        logAction("Treo biển cảnh báo điện nguy hiểm tại rào chắn");
        clearTool();
        return;
    }

    if (currentTool === 'sign_work') {
        sys.signs.work = true;
        updateSignsVisuals();
        showToast("✅ Đã treo biển 'LÀM VIỆC TẠI ĐÂY'");
        logAction("Treo biển chỉ dẫn Làm việc tại đây tại vị trí công tác");
        clearTool();
        return;
    }

    if (id === 1 || id === 2) {
        if (currentTool === 'hasp') {
            if (circuitGraph.devices[cbKey].state) { 
                showToast("⚡ Lỗi: Còn điện! Hãy gạt OFF CB trước."); 
                logAction(`Lỗi: Kẹp Hasp vào ${cbKey} khi còn điện`, true); 
                return; 
            }
            if(sys.has_hasp) { showToast("Đã kẹp Hasp rồi!"); return; }
            
            sys.has_hasp = true;
            updateLockVisuals();
            logAction(`Đã kẹp khóa kéo dài (Hasp) vào ${cbKey}`);
            clearTool();
        } 
        else if (currentTool === 'lock') {
            if (circuitGraph.devices[cbKey].state) { showToast("⚡ Lỗi: CB còn điện!"); return; }
            
            if (sys.has_hasp) {
                 sys.lock_count++;
                 updateLockVisuals();
                 logAction(`Đã mắc thêm ổ khóa số ${sys.lock_count} vào Hasp trên ${cbKey}`);
                 showToast(`Đã móc khóa số ${sys.lock_count}`);
                 clearTool();
            } else {
                 if(sys.lock_count > 0) { showToast("Đã có khóa đơn rồi"); return; }
                 sys.lock_count = 1;
                 updateLockVisuals();
                 logAction(`Đã khóa an toàn (Khóa đơn) trên ${cbKey}`);
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
                const isLiveNow = circuitGraph.devices[cbKey].state;
                const res = isLiveNow ? "380V (CÓ ĐIỆN)" : "0V (ĐÃ CẮT ĐIỆN)";
                showToast(`Kết quả đo tại ${cbKey}: ${res}`);
                logAction(`Kiểm tra điện áp VOM tại ${cbKey}: ${res}`);
            }, 800);
        } 
        else if (!currentTool) {
            if(sys.lock_count > 0 || sys.has_hasp) { 
                showToast(`⛔ Không thể gạt! ${cbKey} đã bị khóa LOTO.`); 
                logAction(`Cảnh báo: Cố tình gạt ${cbKey} khi đang khóa LOTO`, true);
                return; 
            }
            
            circuitGraph.devices[cbKey].state = !circuitGraph.devices[cbKey].state;
            sys[`cb${id}`] = circuitGraph.devices[cbKey].state;
            
            const el = document.getElementById(`cb${id}-lever`);
            if (circuitGraph.devices[cbKey].state) {
                el.classList.remove('off'); el.innerText = "ON";
            } else {
                el.classList.add('off'); el.innerText = "OFF";
            }
            
            solveAndRenderCircuit();
            logAction(`Gạt tay ${cbKey} sang vị trí: ${circuitGraph.devices[cbKey].state ? 'ON' : 'OFF'}`);
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

function updateGroundVisuals() {
    const container = document.getElementById('cb2-locks');
    if (sys.ground_phase_connected && container) {
        container.innerHTML += `
            <svg class="vis-ground-set" viewBox="0 0 100 100">
                <line x1="50" y1="10" x2="50" y2="80" class="ground-wire" />
                <circle cx="50" cy="10" r="6" fill="#f1c40f" />
                <path d="M35 80 L65 80 M40 86 L60 86 M45 92 L55 92" stroke="#f1c40f" stroke-width="3" />
            </svg>`;
    }
}

function updateBarrierVisuals() {
    let el = document.getElementById('barrier-zone');
    if (!el) {
        const targetCard = document.querySelector('#tab-electrical .card');
        if (targetCard) {
            el = document.createElement('div');
            el.id = 'barrier-zone';
            el.className = 'barrier-overlay';
            el.innerHTML = '🚧 KHU VỰC CÓ ĐIỆN LÂN CẬN - DỪNG LẠI 🚧';
            targetCard.appendChild(el);
        }
    }
}

function updateSignsVisuals() {
    const container = document.querySelector('#tab-electrical .card');
    if (!container) return;

    if (sys.signs.prohibit && !document.getElementById('sign-p')) {
        container.innerHTML += `<div id="sign-p" class="vis-sign sign-prohibit">🚫 CẤM ĐÓNG ĐIỆN!</div>`;
    }
    if (sys.signs.danger && !document.getElementById('sign-d')) {
        container.innerHTML += `<div id="sign-d" class="vis-sign sign-danger">⚠️ DỪNG LẠI! CÓ ĐIỆN</div>`;
    }
    if (sys.signs.work && !document.getElementById('sign-w')) {
        container.innerHTML += `<div id="sign-w" class="vis-sign sign-work">✅ LÀM VIỆC TẠI ĐÂY</div>`;
    }
}

function toggleMachine(run) {
    if (!run) {
        toggleMachineVisuals(false);
        logAction("Bấm STOP quạt số 2 tại chỗ");
    } else {
        const { liveDevices } = solveCircuitBFS(circuitGraph);
        const isLive = liveDevices.has("MOTOR_M2");
        toggleMachineVisuals(isLive);
        logAction("Bấm START quạt số 2 tại chỗ");
    }
}

function updateLockVisuals() {
    const container = document.getElementById('cb2-locks');
    let html = '';
    if(sys.has_hasp) html += '<div class="vis-hasp">🔗</div>';
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
    const svg = worker ? worker.querySelector('.worker-svg') : null;
    
    if (worker) worker.className = 'worker-container'; 
    if (svg) svg.classList.remove('shocked');
    setTimeout(() => { if (worker) worker.classList.add('worker-walk-in'); }, 100);

    setTimeout(() => {
        const { liveDevices } = solveCircuitBFS(circuitGraph);
        const isMotorLive = liveDevices.has("MOTOR_M2");
        
        let violationList = [];

        if (isMotorLive) violationList.push("Thiết bị vẫn đang mang điện!");
        if (sys.lock_count === 0) violationList.push("Chưa thực hiện khóa LOTO!");
        if (!sys.ground_phase_connected) violationList.push("Chưa đặt tiếp địa di động tại vị trí công tác!");
        if (!sys.barrier_placed) violationList.push("Chưa dựng rào chắn an toàn hiện trường!");
        if (!sys.signs.prohibit) violationList.push("Chưa treo biển Cấm đóng điện tại CB!");
        if (!sys.signs.work) violationList.push("Chưa treo biển Làm việc tại đây!");

        if (violationList.length > 0) {
            if (svg) svg.classList.add('shocked');
            document.getElementById('shock-flash').style.display = 'block';
            
            const errorMsg = "TAI NẠN / VI PHẠM AN TOÀN:\n- " + violationList.join("\n- ");
            logAction(errorMsg, true);
            showToast("⚡ VI PHẠM AN TOÀN NGHÊM TRỌNG!");
            
            setTimeout(() => {
                 document.getElementById('shock-flash').style.display = 'none';
                 document.getElementById('reset-overlay').style.display = 'flex';
            }, 4000);
        } else {
            logAction("ĐẦY ĐỦ BẢO VỆ (Cắt điện, Khóa LOTO, Tiếp địa, Rào chắn & Biển báo). Cho phép thi công!", false);
            showToast("✅ Đạt chuẩn an toàn QCVN 01:2020/BCT. Cho phép làm việc!");
        }
    }, 1200);
}

function resetSimulation() {
    sys = { 
        cb1: true, cb2: true, has_hasp: false, lock_count: 0, tagged: false,
        ground_earth_connected: false, ground_phase_connected: false, barrier_placed: false,
        signs: { prohibit: false, danger: false, work: false }
    };
    circuitGraph.devices["CB1"].state = true;
    circuitGraph.devices["CB2"].state = true;

    updateLockVisuals();
    document.getElementById('cb2-tag-viz').innerHTML = '';
    
    const barrierEl = document.getElementById('barrier-zone');
    if (barrierEl) barrierEl.remove();
    ['sign-p', 'sign-d', 'sign-w'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    document.getElementById('cb1-lever').classList.remove('off');
    document.getElementById('cb1-lever').innerText = "ON";
    document.getElementById('cb2-lever').classList.remove('off');
    document.getElementById('cb2-lever').innerText = "ON";
    
    solveAndRenderCircuit();

    workerPresent = true;
    const worker = document.getElementById('worker-npc');
    const svg = worker ? worker.querySelector('.worker-svg') : null;
    if (worker) worker.className = 'worker-container';
    if (svg) svg.classList.remove('shocked');

    document.getElementById('reset-overlay').style.display = 'none';
    document.getElementById('shock-flash').style.display = 'none';
    
    nav('tab-device');
    logAction("--- HỆ THỐNG RESET MÔ PHỎNG ---");
    showToast("Đã làm mới hệ thống");
}

function handleCircuitUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileName = file.name;
    const fileExt = fileName.split('.').pop().toLowerCase();
    document.getElementById('upload-filename').innerText = `📄 Đã nạp: ${fileName}`;

    const reader = new FileReader();

    if (fileExt === 'svg') {
        reader.onload = function(e) {
            document.getElementById('diagram-container').innerHTML = e.target.result;
            logAction(`Đã nạp sơ đồ SVG mới: ${fileName}`);
            showToast("✅ Đã nạp sơ đồ SVG thành công");
            solveAndRenderCircuit();
        };
        reader.readAsText(file);
    } else if (fileExt === 'json') {
        reader.onload = function(e) {
            try {
                circuitGraph = JSON.parse(e.target.result);
                solveAndRenderCircuit();
                logAction(`Đã nạp cấu trúc JSON mới: ${fileName}`);
                showToast("✅ Đã giải sơ đồ JSON thành công");
            } catch (err) {
                showToast("❌ Lỗi cấu trúc JSON!");
            }
        };
        reader.readAsText(file);
    }
}

window.addEventListener('keydown', (e) => {
    const loginScreen = document.getElementById('screen-login');
    if (loginScreen && loginScreen.style.display !== 'none' && loginScreen.classList.contains('show')) return;

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
        document.querySelectorAll('.tab-view').forEach(t => {
            if (t.id !== 'screen-login') t.classList.remove('show');
        });
        const targetTab = document.getElementById(tabId);
        if (targetTab) targetTab.classList.add('show');
        
        document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
        const activeNavBtn = document.getElementById(`bnav-${tabId}`);
        if (activeNavBtn) activeNavBtn.classList.add('active');
        
        closeSidebar();
    } else {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.style.display = 'grid';
    }
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
