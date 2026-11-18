/**
 * LĐCT-OPMS v1.0 — Kiểm soát đăng nhập, RBAC & Thanh điều hướng Offcanvas Mobile
 */
window.currentUserProfile = null;

function requireAuth(onReady) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      if (!location.pathname.endsWith("index.html") && location.pathname !== "/") {
        location.href = "index.html";
      }
      return;
    }

    try {
      const snap = await db.ref("users/" + user.uid).once("value");
      let profile = snap.val();
      if (!profile) {
        profile = {
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.email.split("@")[0],
          role: "INSPECTOR",
          team: "Đội QLLĐ 2",
          active: true
        };
      } else {
        profile.uid = user.uid;
      }

      if (profile.active === false) {
        alert("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Đội trưởng QLLĐ.");
        await auth.signOut();
        location.href = "index.html";
        return;
      }

      window.currentUserProfile = profile;
      renderAppShell(profile);
      if (typeof onReady === "function") onReady(profile);
    } catch (err) {
      console.error("Lỗi xác thực RBAC:", err);
    }
  });
}

function canApprove() {
  const r = window.currentUserProfile?.role;
  return r === "CAPTAIN" || r === "TEAM_LEAD";
}

function isReadOnly() {
  return window.currentUserProfile?.role === "VIEWER";
}

function renderAppShell(profile) {
  const mount = document.getElementById("nav-mount");
  if (!mount) return;

  const currentPage = location.pathname.split("/").pop() || "dashboard.html";
  const navItems = [
    { href: "dashboard.html", icon: "fa-chart-line", label: "Tổng quan & SLA" },
    { href: "task-assign.html", icon: "fa-clipboard-list", label: "Giao việc 4086" },
    { href: "patrol-field.html", icon: "fa-location-crosshairs", label: "Kiểm tra Ngày/Đêm/Đột xuất" },
    { href: "tech-cbm.html", icon: "fa-temperature-high", label: "Kỹ thuật & CBM (CHI)" },
    { href: "survey-report.html", icon: "fa-file-signature", label: "Khảo sát & Báo cáo CT" },
    { href: "defects-pmis.html", icon: "fa-triangle-exclamation", label: "Tồn tại & Xuất PMIS" },
    { href: "assets-config.html", icon: "fa-tower-observation", label: "Danh mục Tuyến/Trụ" },
    { href: "users-rbac.html", icon: "fa-users-gear", label: "Phân quyền RBAC" }
  ];

  const linksHtml = navItems.map((item) => {
    const active = currentPage === item.href
      ? "bg-blue-900 text-white font-semibold"
      : "text-slate-700 hover:bg-slate-100";
    return `<a href="${item.href}" class="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition ${active}">
      <i class="fa-solid ${item.icon} w-4 text-center"></i>
      <span>${item.label}</span>
    </a>`;
  }).join("");

  mount.innerHTML = `
    <header class="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
      <div class="flex items-center gap-3">
        <button onclick="toggleSidebar()" class="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700" aria-label="Mở menu">
          <i class="fa-solid fa-bars"></i>
        </button>
        <div>
          <span class="font-bold text-blue-950 text-base tracking-tight">LĐCT-OPMS v1.0</span>
          <span class="hidden sm:inline-block ml-2 text-xs font-mono px-2 py-0.5 bg-blue-50 text-blue-900 rounded">4086/QĐ-EVNHCMC</span>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <span id="offline-badge" class="hidden text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-900"></span>
        <div class="text-right hidden sm:block">
          <div class="text-xs font-semibold text-slate-900">${profile.name}</div>
          <div class="text-[11px] text-slate-500">${APP_CONSTANTS.ROLES[profile.role] || profile.role}</div>
        </div>
        <button onclick="logoutApp()" class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700">
          <i class="fa-solid fa-right-from-bracket mr-1"></i>Thoát
        </button>
      </div>
    </header>

    <div id="sidebar-backdrop" onclick="toggleSidebar()" class="fixed inset-0 bg-slate-900/40 z-40 hidden lg:hidden"></div>
    <aside id="app-sidebar" class="fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-slate-200 z-50 transform -translate-x-full lg:translate-x-0 lg:top-[57px] transition-transform duration-200 flex flex-col justify-between p-3 overflow-y-auto">
      <nav class="space-y-1">
        ${linksHtml}
      </nav>
      <div class="pt-4 border-t border-slate-200 text-[11px] text-slate-500 px-2">
        <div>${APP_CONSTANTS.UNIT_NAME}</div>
        <div class="mt-1">SLA cập nhật PMIS: 24–48 giờ</div>
      </div>
    </aside>
  `;

  if (typeof updateOfflineBadge === "function") updateOfflineBadge();
}

function toggleSidebar() {
  const sb = document.getElementById("app-sidebar");
  const bd = document.getElementById("sidebar-backdrop");
  if (!sb || !bd) return;
  sb.classList.toggle("-translate-x-full");
  bd.classList.toggle("hidden");
}

async function logoutApp() {
  await auth.signOut();
  location.href = "index.html";
}
