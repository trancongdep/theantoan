let CURRENT_USER = null;
const SUPER_ADMIN_EMAIL = "deptc.gvatvsld@gmail.com";

function initAuthGuard(requiredPageKey, onReadyCallback) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      if (!window.location.pathname.endsWith("index.html") && window.location.pathname !== "/") {
        window.location.href = "index.html";
      }
      return;
    }

    // Lấy email chính xác từ user hoặc providerData (Google) và chuẩn hóa chữ thường
    const rawEmail = user.email || (user.providerData && user.providerData[0] ? user.providerData[0].email : "");
    const currentEmail = rawEmail.trim().toLowerCase();

    console.log("Đang đăng nhập với UID:", user.uid, "| Email:", currentEmail);

    try {
      const snap = await db.ref(`users/${user.uid}`).once("value");
      let userData = snap.val();

      // Khóa cứng Super Admin cho deptc.gvatvsld@gmail.com
      if (currentEmail === SUPER_ADMIN_EMAIL) {
        const fullPermissions = {
          config: { view: true, add: true, edit: true, delete: true },
          users: { view: true, add: true, edit: true, delete: true },
          contractors: { view: true, add: true, edit: true, delete: true },
          sra: { view: true, add: true, edit: true, approve: true, send: true },
          ptw: { view: true, add: true, edit: true, approve: true },
          gate: { view: true, check: true }
        };

        await db.ref("roles/ROLE_SUPER_ADMIN").set({
          name: "Quản trị hệ thống (Super Admin)",
          permissions: fullPermissions
        });

        userData = {
          uid: user.uid,
          email: currentEmail,
          name: user.displayName || "Trần Công Đẹp (Admin)",
          username: currentEmail,
          type: "INTERNAL",
          roleId: "ROLE_SUPER_ADMIN",
          active: true,
          updatedAt: new Date().toISOString()
        };

        await db.ref(`users/${user.uid}`).set(userData);
      } else if (!userData) {
        alert(`Tài khoản (${currentEmail || user.uid}) chưa được cấp quyền trên hệ thống. Vui lòng liên hệ Admin!`);
        await auth.signOut();
        return;
      }

      if (!userData.active) {
        alert("Tài khoản của bạn đã bị khóa!");
        await auth.signOut();
        return;
      }

      const roleSnap = await db.ref(`roles/${userData.roleId}`).once("value");
      userData.role = roleSnap.val() || { name: "Chưa phân quyền", permissions: {} };
      CURRENT_USER = userData;

      renderTopNavbar();
      if (onReadyCallback) onReadyCallback(CURRENT_USER);

    } catch (error) {
      console.error("Lỗi Firebase Database:", error);
      alert("Lỗi đọc/ghi dữ liệu Firebase: " + error.message);
    }
  });
}

function renderTopNavbar() {
  const navContainer = document.getElementById("app-navbar");
  if (!navContainer || !CURRENT_USER) return;

  const perms = CURRENT_USER.role.permissions || {};
  const isInternal = CURRENT_USER.type === "INTERNAL";

  navContainer.innerHTML = `
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm mb-4">
      <div class="container-fluid">
        <a class="navbar-brand fw-bold text-info" href="config.html">
          <i class="fas fa-shield-alt me-2"></i>CSMS PORTAL
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav me-auto">
            <li class="nav-item"><a class="nav-link" href="dashboard.html"><i class="fas fa-chart-line me-1"></i>Tổng quan</a></li>
            ${perms.contractors?.view ? `<li class="nav-item"><a class="nav-link" href="contractors.html"><i class="fas fa-hard-hat me-1"></i>Nhà thầu & Nhân sự</a></li>` : ''}
            ${perms.sra?.view ? `<li class="nav-item"><a class="nav-link" href="sra-list.html"><i class="fas fa-briefcase me-1"></i>Gói công việc (SRA)</a></li>` : ''}
            ${perms.ptw?.view ? `<li class="nav-item"><a class="nav-link" href="ptw.html"><i class="fas fa-file-signature me-1"></i>Giấy phép (PTW)</a></li>` : ''}
            ${perms.gate?.view ? `<li class="nav-item"><a class="nav-link" href="gate-check.html"><i class="fas fa-qrcode me-1"></i>Kiểm soát cổng</a></li>` : ''}
            ${isInternal && perms.users?.view ? `<li class="nav-item"><a class="nav-link" href="users.html"><i class="fas fa-users-cog me-1"></i>Người dùng & Quyền</a></li>` : ''}
            ${isInternal && perms.config?.view ? `<li class="nav-item"><a class="nav-link" href="config.html"><i class="fas fa-cogs me-1"></i>Cấu hình</a></li>` : ''}
          </ul>
          <div class="d-flex align-items-center text-white">
            <span class="badge bg-primary me-2">${CURRENT_USER.role.name}</span>
            <span class="me-3 small"><i class="fas fa-user-circle me-1"></i>${CURRENT_USER.name}</span>
            <button class="btn btn-outline-light btn-sm" onclick="logoutApp()"><i class="fas fa-sign-out-alt"></i></button>
          </div>
        </div>
      </div>
    </nav>
  `;
}

function logoutApp() {
  auth.signOut().then(() => window.location.href = "index.html");
}
