// ==========================================
// CẤU HÌNH CÁC LỚP NHẬN DIỆN (CLASSES)
// ==========================================
// Danh sách các nhãn nhận diện. Nếu file model của anh có thứ tự class khác,
// hãy điều chỉnh lại mảng này cho phù hợp.
const LABELS = [
    "Nón bảo hộ",       // Class 0
    "Không nón",        // Class 1
    "Áo bảo hộ",        // Class 2
    "Không áo",         // Class 3
    "Giày bảo hộ",      // Class 4
    "Không giày"        // Class 5
];

// Màu sắc Bounding Box tương ứng cho từng Class (Xanh = Đúng, Đỏ = Vi phạm)
const COLORS = [
    "#00FF00", // Class 0: Xanh lá
    "#FF0000", // Class 1: Đỏ
    "#00FF00", // Class 2: Xanh lá
    "#FF0000", // Class 3: Đỏ
    "#00FF00", // Class 4: Xanh lá
    "#FF0000"  // Class 5: Đỏ
];

const INPUT_SIZE = 640;             // Kích thước Input của YOLOv8 (640x640)
const CONFIDENCE_THRESHOLD = 0.45;  // Ngưỡng độ tin cậy để hiển thị khung

let session = null;
let video = document.getElementById('webcam');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let statusDiv = document.getElementById('status');
let btnToggle = document.getElementById('btnToggle');
let btnSwitch = document.getElementById('btnSwitch');

let isRunning = false;
let currentFacingMode = "environment"; // Mặc định dùng Camera sau trên Android

// ==========================================
// 1. TẢI MÔ HÌNH ONNX RUNTIME
// ==========================================
async function initAI() {
    try {
        ort.env.wasm.numThreads = 2; // Tối ưu đa luồng cho thiết bị di động
        
        // Khởi tạo Session với WebGL (ưu tiên GPU) hoặc WASM
        session = await ort.InferenceSession.create('./best.onnx', {
            executionProviders: ['webgl', 'wasm']
        });

        statusDiv.innerText = "Mô hình AI đã sẵn sàng! Nhấn 'Bật Camera' để bắt đầu.";
        btnToggle.innerText = "Bật Camera";
        btnToggle.disabled = false;
    } catch (e) {
        statusDiv.innerText = "Lỗi tải mô hình: Không tìm thấy file 'best.onnx' hoặc trình duyệt không hỗ trợ.";
        console.error("ONNX Load Error:", e);
    }
}

// ==========================================
// 2. KHỞI TẠO VÀ QUẢN LÝ CAMERA
// ==========================================
async function startCamera() {
    try {
        const constraints = {
            video: {
                facingMode: currentFacingMode,
                width: { ideal: INPUT_SIZE },
                height: { ideal: INPUT_SIZE }
            },
            audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                canvas.width = INPUT_SIZE;
                canvas.height = INPUT_SIZE;
                resolve();
            };
        });
    } catch (err) {
        alert("Không thể truy cập Camera: " + err.message);
        throw err;
    }
}

// ==========================================
// 3. TIỀN XỬ LÝ HÌNH ẢNH (PREPROCESSING)
// ==========================================
// Chuyển đổi khung hình Canvas -> Tensor Float32 dạng NCHW [1, 3, 640, 640]
function preprocess(videoElement) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = INPUT_SIZE;
    tempCanvas.height = INPUT_SIZE;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(videoElement, 0, 0, INPUT_SIZE, INPUT_SIZE);

    const imgData = tempCtx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
    const pixels = imgData.data;

    const float32Data = new Float32Array(1 * 3 * INPUT_SIZE * INPUT_SIZE);

    // Tách các kênh RGB và Chuẩn hóa về khoảng [0.0, 1.0]
    for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
        float32Data[i] = pixels[i * 4] / 255.0;                             // Channel R
        float32Data[INPUT_SIZE * INPUT_SIZE + i] = pixels[i * 4 + 1] / 255.0; // Channel G
        float32Data[2 * INPUT_SIZE * INPUT_SIZE + i] = pixels[i * 4 + 2] / 255.0; // Channel B
    }

    return new ort.Tensor('float32', float32Data, [1, 3, INPUT_SIZE, INPUT_SIZE]);
}

// ==========================================
// 4. VÒNG LẬP NHẬN DIỆN REALTIME (INFERENCE)
// ==========================================
async function detectLoop() {
    if (!isRunning) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        try {
            // Tiền xử lý dữ liệu đầu vào
            const inputTensor = preprocess(video);

            // Chạy mô hình dự đoán
            const outputs = await session.run({ [session.inputNames[0]]: inputTensor });
            const outputTensor = outputs[session.outputNames[0]];

            // Xóa nét vẽ Bounding Box cũ
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Giải mã Tensor đầu ra và vẽ các đối tượng phát hiện được
            processOutput(outputTensor);

        } catch (err) {
            console.error("Inference Error:", err);
        }
    }

    // Tiếp tục khung hình kế tiếp
    requestAnimationFrame(detectLoop);
}

// ==========================================
// 5. GIẢI MÃ TENSOR YOLOV8 & VẼ BOUNDING BOX
// ==========================================
function processOutput(tensor) {
    const data = tensor.data;
    const numAnchors = tensor.dims[2];    // 8400 vị trí dự đoán
    const numChannels = tensor.dims[1];   // Số kênh = 4 (Tọa độ box) + N (Classes)
    const numClasses = numChannels - 4;

    for (let i = 0; i < numAnchors; i++) {
        let maxScore = 0;
        let classId = -1;

        // Tìm Lớp (Class) có độ tin cậy cao nhất
        for (let c = 0; c < numClasses; c++) {
            const score = data[(4 + c) * numAnchors + i];
            if (score > maxScore) {
                maxScore = score;
                classId = c;
            }
        }

        // Lọc các kết quả đạt ngưỡng Confidence
        if (maxScore >= CONFIDENCE_THRESHOLD) {
            const cx = data[0 * numAnchors + i];
            const cy = data[1 * numAnchors + i];
            const w = data[2 * numAnchors + i];
            const h = data[3 * numAnchors + i];

            // Chuyển tọa độ tâm (cx, cy, w, h) sang dạng góc trên bên trái (x, y, w, h)
            const x = cx - w / 2;
            const y = cy - h / 2;

            // Lấy màu tương ứng với class
            const color = COLORS[classId] || "#00FF00";

            // Vẽ Bounding Box
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, w, h);

            // Vẽ Nhãn (Label) & Phần trăm độ tin cậy
            ctx.fillStyle = color;
            ctx.font = "bold 16px Arial";
            const labelText = `${LABELS[classId] || 'PPE'} ${(maxScore * 100).toFixed(0)}%`;
            
            // Nền cho chữ nhãn dễ đọc
            const textWidth = ctx.measureText(labelText).width;
            ctx.fillRect(x, y > 22 ? y - 22 : y, textWidth + 10, 22);

            ctx.fillStyle = "#000000";
            ctx.fillText(labelText, x + 5, y > 22 ? y - 5 : y + 16);
        }
    }
}

// ==========================================
// 6. XỬ LÝ SỰ KIỆN NÚT BẤM GIAO DIỆN
// ==========================================
btnToggle.addEventListener('click', async () => {
    if (!isRunning) {
        await startCamera();
        isRunning = true;
        btnToggle.innerText = "Tắt Camera";
        btnToggle.style.backgroundColor = "#ff3d00";
        statusDiv.innerText = "Hệ thống AI đang quét hình ảnh realtime...";
        detectLoop();
    } else {
        isRunning = false;
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        btnToggle.innerText = "Bật Camera";
        btnToggle.style.backgroundColor = "#00e676";
        statusDiv.innerText = "Đã dừng camera.";
    }
});

btnSwitch.addEventListener('click', async () => {
    currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
    if (isRunning) {
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }
        await startCamera();
    }
});

// Khởi tạo AI ngay khi tải trang
initAI();
