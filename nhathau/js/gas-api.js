const GasAPI = {
  // Gọi chung tới Apps Script (Sử dụng text/plain để tránh preflight OPTIONS CORS của trình duyệt)
  async call(payload) {
    const response = await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const resJson = await response.json();
    if (resJson.status !== "success") {
      throw new Error(resJson.message || "Lỗi kết nối Google Apps Script");
    }
    return resJson.data;
  },

  // Chuyển File input thành Base64 và đẩy lên Google Drive
  uploadFile(file, folderPathArray) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result.split(",")[1];
          const data = await this.call({
            action: "UPLOAD_FILE",
            fileName: file.name,
            mimeType: file.type,
            base64Data: base64Data,
            folderPath: folderPathArray
          });
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  },

  // Đồng bộ 1 dòng dữ liệu sang Google Sheet
  syncRow(sheetName, headers, rowData, keyColIndex, keyValue) {
    return this.call({
      action: "SYNC_SHEET",
      sheetName,
      headers,
      rowData,
      keyColIndex,
      keyValue
    });
  },

  // Gửi Email thông báo
  sendEmail(to, subject, htmlBody, cc = "") {
    return this.call({
      action: "SEND_EMAIL",
      to,
      cc,
      subject,
      htmlBody
    });
  }
};
