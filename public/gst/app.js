/* ==========================================================================
   GST Billing Application - Pure JavaScript Reactive Billing Engine
   ========================================================================== */

// --- Application State Management ---
let appState = {
    // Company Profile
    company: {
        name: "Your Company Ltd.",
        gstin: "29ABCDE1234F1Z5",
        phone: "+91 80 4567 8901",
        email: "billing@company.com",
        address: "456 Commerce Blvd, Suite 100, Bengaluru, KA - 560001"
    },
    // Customer and Invoice metadata
    invoiceMeta: {
        billNumber: "INV-2026-001",
        date: new Date().toISOString().split('T')[0], // Defaults to today's date
        clientName: "John Doe & Co.",
        clientGst: "27AAAAA1111A1Z1",
        clientPhone: "+91 98765 43210",
        clientAddress: "123 Corporate Park, Sector 62, Mumbai, MH"
    },
    // List of added products
    products: [],
    // Tracking edit state
    editingId: null,
    // Theme Preference
    theme: "light",
    // Signed-in account profile
    account: {
        name: "Admin User",
        email: "admin@gst.com"
    }
};

let stockItems = [];
const demoAccountPassword = "admin123";

// --- Standard Mock Data (Laptop Example from Prompt) ---
const mockProduct = {
    id: "mock-1",
    name: "Laptop (Example Product)",
    qty: 2,
    costPrice: 50000,
    profitPercent: 10,
    gstPercent: 18,
    discountPercent: 5
};

// --- Initialization ---
function initializeApplication() {
    loadStateFromStorage();
    setupEventListeners();
    initializeDefaults();
    calculateAndRender();
    setupLogin();
    loadStockInventory();
    showAppView("dashboard");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApplication, { once: true });
} else {
    initializeApplication();
}

async function setupLogin() {
    const loginScreen = document.getElementById("login-screen");
    const appContainer = document.getElementById("app-container");
    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");
    const loginError = document.getElementById("login-error");
    const signupError = document.getElementById("signup-error");
    const passwordInput = document.getElementById("login-password");

    function showApp(user) {
        loginScreen.hidden = true;
        appContainer.hidden = false;
        if (user) {
            appState.account = { name: user.name, email: user.email };
            initializeAccountProfile();
            saveStateToStorage();
            document.getElementById("btn-open-admin").classList.toggle("admin-nav-hidden", user.role !== "ADMIN");
            showAppView("dashboard");
        }
    }

    function showLogin() {
        appContainer.hidden = true;
        loginScreen.hidden = false;
        document.getElementById("login-email").focus();
    }

    function setAuthMode(mode) {
        const isSignup = mode === "signup";
        loginForm.classList.toggle("auth-form-hidden", isSignup);
        signupForm.classList.toggle("auth-form-hidden", !isSignup);
        document.getElementById("btn-show-login").classList.toggle("active", !isSignup);
        document.getElementById("btn-show-signup").classList.toggle("active", isSignup);
        document.getElementById("auth-kicker").textContent = isSignup ? "GET STARTED" : "WELCOME BACK";
        document.getElementById("login-title").textContent = isSignup ? "Create your workspace account" : "Sign in to your workspace";
        document.getElementById("auth-subtitle").textContent = isSignup ? "Set up your account to manage stock and create invoices." : "Use your account details to continue to the billing dashboard.";
        loginError.textContent = "";
        signupError.textContent = "";
    }

    async function authenticate(url, payload, errorElement) {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) {
            errorElement.textContent = result.error || "Authentication failed.";
            return;
        }
        errorElement.textContent = "";
        showApp(result.user);
    }

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = document.getElementById("login-email").value.trim().toLowerCase();
        const password = passwordInput.value;
        await authenticate("/api/auth/login", { email, password }, loginError);
    });

    signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const password = document.getElementById("signup-password").value;
        await authenticate("/api/auth/signup", {
            name: document.getElementById("signup-name").value.trim(),
            email: document.getElementById("signup-email").value.trim().toLowerCase(),
            password
        }, signupError);
    });

    document.getElementById("btn-show-login").addEventListener("click", () => setAuthMode("login"));
    document.getElementById("btn-show-signup").addEventListener("click", () => setAuthMode("signup"));

    document.getElementById("btn-toggle-password").addEventListener("click", (event) => {
        const button = event.currentTarget;
        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";
        button.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
        button.title = isPassword ? "Hide password" : "Show password";
        button.innerHTML = `<i class="fa-regular fa-eye${isPassword ? "-slash" : ""}"></i>`;
    });

    document.getElementById("btn-forgot-password").addEventListener("click", () => {
        loginError.textContent = "Password recovery is not configured yet. Contact your workspace administrator.";
    });

    document.getElementById("btn-logout").addEventListener("click", async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        localStorage.removeItem("gst_billing_authenticated");
        sessionStorage.removeItem("gst_billing_authenticated");
        loginForm.reset();
        signupForm.reset();
        showLogin();
    });

    async function loadGoogleLogin() {
        const container = document.getElementById("google-login-button");
        const clientId = document.querySelector('meta[name="google-client-id"]')?.content;
        if (!clientId) {
            container.innerHTML = `<button type="button" class="google-fallback-button"><i class="fa-brands fa-google"></i><span>Continue with Google</span></button><span class="google-login-help">Add a Google Client ID in .env to activate this option.</span>`;
            container.querySelector(".google-fallback-button").addEventListener("click", () => {
                loginError.textContent = "Google login is not configured yet. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to .env and restart the app.";
            });
            return;
        }

        await new Promise((resolve, reject) => {
            if (window.google?.accounts?.id) return resolve();
            const script = document.createElement("script");
            script.src = "https://accounts.google.com/gsi/client";
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });

        window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response) => authenticate("/api/auth/google", { credential: response.credential }, loginError)
        });
        window.google.accounts.id.renderButton(container, { theme: "outline", size: "large", width: 360, text: "continue_with" });
    }

    try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
            const result = await response.json();
            showApp(result.user);
        } else {
            showLogin();
        }
    } catch {
        showLogin();
        loginError.textContent = "Unable to connect to the authentication server.";
    }
    loadGoogleLogin().catch(() => {
        document.getElementById("google-login-button").innerHTML = "<span class=\"google-login-help\">Google login could not load.</span>";
    });
}

// --- Storage Utilities ---
function saveStateToStorage() {
    localStorage.setItem("gst_billing_state", JSON.stringify(appState));
}

function loadStateFromStorage() {
    const saved = localStorage.getItem("gst_billing_state");
    if (saved) {
        try {
            appState = JSON.parse(saved);
            appState.products = Array.isArray(appState.products)
                ? appState.products.filter((product) => product.stockId)
                : [];
        } catch (e) {
            console.error("Failed to parse saved state", e);
        }
    } else {
        appState.products = [];
        saveStateToStorage();
    }
}

// --- Setup Default Inputs on Page ---
function initializeDefaults() {
    // Theme Setup
    document.documentElement.setAttribute("data-theme", appState.theme);
    const themeIcon = document.getElementById("theme-icon");
    const themeText = document.getElementById("theme-text");
    if (appState.theme === "dark") {
        themeIcon.className = "fa-solid fa-sun";
        themeText.textContent = "Light Mode";
    } else {
        themeIcon.className = "fa-solid fa-moon";
        themeText.textContent = "Dark Mode";
    }

    // Set form fields with current invoice details
    document.getElementById("bill-number").value = appState.invoiceMeta.billNumber;
    document.getElementById("bill-date").value = appState.invoiceMeta.date;
    document.getElementById("client-name").value = appState.invoiceMeta.clientName;
    document.getElementById("client-gst").value = appState.invoiceMeta.clientGst;
    document.getElementById("client-phone").value = appState.invoiceMeta.clientPhone;
    document.getElementById("client-address").value = appState.invoiceMeta.clientAddress;

    // Load Company Settings modal inputs
    document.getElementById("company-name").value = appState.company.name;
    document.getElementById("company-gst").value = appState.company.gstin;
    document.getElementById("company-phone").value = appState.company.phone;
    document.getElementById("company-email").value = appState.company.email;
    document.getElementById("company-address").value = appState.company.address;
    initializeAccountProfile();
}

function initializeAccountProfile() {
    const accountName = appState.account?.name || "Admin User";
    const accountEmail = appState.account?.email || "admin@gst.com";
    document.getElementById("account-name").value = accountName;
    document.getElementById("account-email").value = accountEmail;
    document.getElementById("account-name-display").textContent = accountName;
    document.getElementById("account-email-display").textContent = accountEmail;
    document.getElementById("account-avatar").textContent = accountName.charAt(0).toUpperCase();
    document.getElementById("profile-avatar").textContent = accountName.charAt(0).toUpperCase();
    document.getElementById("profile-name-heading").textContent = accountName;
}

// --- Dynamic Mathematical Calculations ---
function computeProductCalculations(qty, price, profitPercent, gstPercent, discountPercent) {
    const baseAmount = qty * price;
    const profitAmount = baseAmount * (profitPercent / 100);
    const sellingPrice = baseAmount + profitAmount;
    const gstAmount = sellingPrice * (gstPercent / 100);
    const subtotal = sellingPrice + gstAmount;
    const discountAmount = subtotal * (discountPercent / 100);
    const finalAmount = subtotal - discountAmount;

    return {
        baseAmount,
        profitAmount,
        sellingPrice,
        gstAmount,
        subtotal,
        discountAmount,
        finalAmount
    };
}

// --- Live Reactive Calculations Form Handler ---
function updateLiveFormPreview() {
    const qty = parseFloat(document.getElementById("product-qty").value) || 0;
    const price = parseFloat(document.getElementById("product-price").value) || 0;
    const sellingPrice = parseFloat(document.getElementById("product-selling-price").value) || 0;
    const profit = price > 0 ? ((sellingPrice / price) - 1) * 100 : 0;
    const gst = parseFloat(document.getElementById("product-gst").value) || 0;
    const discount = parseFloat(document.getElementById("product-discount").value) || 0;

    const calcs = computeProductCalculations(qty, price, profit, gst, discount);

    document.getElementById("live-base").textContent = formatCurrency(calcs.baseAmount);
    document.getElementById("live-profit").textContent = formatCurrency(calcs.profitAmount);
    document.getElementById("live-selling").textContent = formatCurrency(calcs.sellingPrice);
    document.getElementById("live-gst").textContent = formatCurrency(calcs.gstAmount);
    document.getElementById("live-subtotal").textContent = formatCurrency(calcs.subtotal);
    document.getElementById("live-discount").textContent = formatCurrency(calcs.discountAmount);
    document.getElementById("live-final").textContent = formatCurrency(calcs.finalAmount);
}

// --- Helper: Format Currency to Rupees (INR) ---
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(amount);
}

// --- Form Validation Helper ---
function getFormValues() {
    const name = document.getElementById("product-name").value.trim();
    const stockId = Number(document.getElementById("product-stock-id").value);
    const qty = parseFloat(document.getElementById("product-qty").value);
    const price = parseFloat(document.getElementById("product-price").value);
    const sellingPrice = parseFloat(document.getElementById("product-selling-price").value);
    const profit = price > 0 ? ((sellingPrice / price) - 1) * 100 : 0;
    const gst = parseFloat(document.getElementById("product-gst").value) || 0;
    const discount = parseFloat(document.getElementById("product-discount").value) || 0;

    if (!name || !Number.isInteger(stockId) || isNaN(qty) || isNaN(price) || isNaN(sellingPrice) || qty <= 0 || price < 0 || sellingPrice < 0) {
        return null;
    }

    const stockItem = stockItems.find((item) => item.id === stockId);
    if (!stockItem || qty > stockItem.quantity) {
        alert(`Only ${stockItem?.quantity || 0} units of ${name} are available.`);
        return null;
    }

    return { stockId, name, qty, price, sellingPrice, profit, gst, discount };
}

// --- Main State Calculate & Render Engine ---
function calculateAndRender() {
    // 1. Refresh Invoice Metadata State from user inputs
    appState.invoiceMeta.billNumber = document.getElementById("bill-number").value || "INV-XXXX";
    appState.invoiceMeta.date = document.getElementById("bill-date").value || new Date().toISOString().split('T')[0];
    appState.invoiceMeta.clientName = document.getElementById("client-name").value || "Walk-in Customer";
    appState.invoiceMeta.clientGst = document.getElementById("client-gst").value.toUpperCase() || "";
    appState.invoiceMeta.clientPhone = document.getElementById("client-phone").value || "";
    appState.invoiceMeta.clientAddress = document.getElementById("client-address").value || "";

    saveStateToStorage();

    // 2. Aggregate Totals
    let aggregate = {
        totalBase: 0,
        totalProfit: 0,
        totalSelling: 0,
        totalGst: 0,
        subtotal: 0,
        totalDiscount: 0,
        grandTotal: 0
    };

    const tbody = document.getElementById("products-table-body");
    const invTbody = document.getElementById("invoice-items-tbody");
    
    tbody.innerHTML = "";
    invTbody.innerHTML = "";

    const itemsCount = appState.products.length;
    document.getElementById("ledger-count").textContent = `${itemsCount} item${itemsCount !== 1 ? 's' : ''}`;
    document.getElementById("stat-products-count").textContent = itemsCount;

    if (itemsCount === 0) {
        document.getElementById("table-empty-state").style.display = "flex";
        invTbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: #94a3b8; padding: 2.5rem;">
                    <i class="fa-solid fa-cart-shopping" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block; color: var(--text-muted);"></i>
                    No items added to invoice ledger yet.
                </td>
            </tr>`;
    } else {
        document.getElementById("table-empty-state").style.display = "none";
        
        appState.products.forEach((p, idx) => {
            const calcs = computeProductCalculations(p.qty, p.costPrice, p.profitPercent, p.gstPercent, p.discountPercent);
            
            // Accumulate calculations
            aggregate.totalBase += calcs.baseAmount;
            aggregate.totalProfit += calcs.profitAmount;
            aggregate.totalSelling += calcs.sellingPrice;
            aggregate.totalGst += calcs.gstAmount;
            aggregate.subtotal += calcs.subtotal;
            aggregate.totalDiscount += calcs.discountAmount;
            aggregate.grandTotal += calcs.finalAmount;

            // Render Row for Products Ledger Table
            const tableRow = document.createElement("tr");
            tableRow.innerHTML = `
                <td><strong>${escapeHtml(p.name)}</strong></td>
                <td>${p.qty}</td>
                <td>${formatCurrency(p.costPrice)}</td>
                <td>
                    <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">${p.profitPercent}%</span>
                    <strong>+${formatCurrency(calcs.profitAmount)}</strong>
                </td>
                <td>
                    <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">${p.gstPercent}%</span>
                    <strong>+${formatCurrency(calcs.gstAmount)}</strong>
                </td>
                <td>
                    <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">${p.discountPercent}%</span>
                    <strong>-${formatCurrency(calcs.discountAmount)}</strong>
                </td>
                <td><strong style="color: var(--primary);">${formatCurrency(calcs.finalAmount)}</strong></td>
                <td>
                    <div style="display: flex; gap: 0.5rem; justify-content: center;">
                        <button class="btn-icon btn-icon-edit" onclick="editProduct('${p.id}')" title="Edit Product">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn-icon btn-icon-danger" onclick="deleteProduct('${p.id}')" title="Delete Product">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tableRow);

            // Render Row for High-Fidelity Invoice PDF Preview
            const invoiceRow = document.createElement("tr");
            invoiceRow.innerHTML = `
                <td style="text-align: center;">${idx + 1}</td>
                <td>
                    <div style="font-weight: 700; color: #1e293b;">${escapeHtml(p.name)}</div>
                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.15rem;">
                        Base Cost: ${formatCurrency(p.costPrice)} | Profit: +${p.profitPercent}% (${formatCurrency(calcs.profitAmount / p.qty)}/unit)
                    </div>
                </td>
                <td style="text-align: right;">${p.qty}</td>
                <td style="text-align: right;">${formatCurrency(p.costPrice)}</td>
                <td style="text-align: right;">${formatCurrency(calcs.sellingPrice / p.qty)}</td>
                <td style="text-align: right;">
                    <div>${p.gstPercent}%</div>
                    <div style="font-size: 0.7rem; color: #64748b; white-space: nowrap;">CGST (${p.gstPercent/2}%): ${formatCurrency(calcs.gstAmount/2)}</div>
                    <div style="font-size: 0.7rem; color: #64748b; white-space: nowrap;">SGST (${p.gstPercent/2}%): ${formatCurrency(calcs.gstAmount/2)}</div>
                </td>
                <td style="text-align: right; font-weight: 700; color: #0f172a;">
                    ${formatCurrency(calcs.finalAmount)}
                    <div style="font-size: 0.7rem; color: var(--danger); font-weight: 500;">Less ${p.discountPercent}%: -${formatCurrency(calcs.discountAmount)}</div>
                </td>
            `;
            invTbody.appendChild(invoiceRow);
        });
    }

    // 3. Render Dashboard Metric Cards
    document.getElementById("stat-grand-total").textContent = formatCurrency(aggregate.grandTotal);
    document.getElementById("stat-gst-collected").textContent = formatCurrency(aggregate.totalGst);
    document.getElementById("stat-discounts").textContent = formatCurrency(aggregate.totalDiscount);

    // 4. Render Invoice Preview Profile Headers
    document.getElementById("invoice-company-name").textContent = appState.company.name;
    document.getElementById("invoice-company-address").textContent = appState.company.address;
    document.getElementById("invoice-company-gst").textContent = appState.company.gstin;
    document.getElementById("invoice-company-phone").textContent = appState.company.phone;
    document.getElementById("invoice-company-email").textContent = appState.company.email;
    document.getElementById("signature-company-name").textContent = `For ${appState.company.name}`;

    // 5. Render Invoice Preview Meta Details
    document.getElementById("invoice-num-display").textContent = appState.invoiceMeta.billNumber;
    document.getElementById("invoice-date-display").textContent = formatDate(appState.invoiceMeta.date);
    document.getElementById("invoice-client-name-display").textContent = appState.invoiceMeta.clientName;
    document.getElementById("invoice-client-address-display").textContent = appState.invoiceMeta.clientAddress;

    // Optional customer phone row rendering
    const clientPhoneRow = document.getElementById("invoice-client-phone-row");
    if (appState.invoiceMeta.clientPhone) {
        clientPhoneRow.style.display = "block";
        document.getElementById("invoice-client-phone-display").textContent = appState.invoiceMeta.clientPhone;
    } else {
        clientPhoneRow.style.display = "none";
    }

    // Optional customer GST row rendering
    const clientGstRow = document.getElementById("invoice-client-gst-row");
    if (appState.invoiceMeta.clientGst) {
        clientGstRow.style.display = "block";
        document.getElementById("invoice-client-gst-display").textContent = appState.invoiceMeta.clientGst;
    } else {
        clientGstRow.style.display = "none";
    }

    // Attempt simple Place of Supply derivation
    let placeOfSupply = "Local State (CGST + SGST)";
    const compGst = appState.company.gstin.substring(0, 2);
    const cliGst = appState.invoiceMeta.clientGst.substring(0, 2);
    if (compGst && cliGst && compGst !== cliGst) {
        placeOfSupply = `Interstate IGST (State Code: ${cliGst})`;
    } else if (cliGst) {
        placeOfSupply = `Intrastate (State Code: ${cliGst})`;
    }
    document.getElementById("invoice-supply-place").textContent = placeOfSupply;

    // 6. Render Invoice Preview Summation Box
    document.getElementById("inv-total-base").textContent = formatCurrency(aggregate.totalBase);
    document.getElementById("inv-total-profit").textContent = formatCurrency(aggregate.totalProfit);
    document.getElementById("inv-total-selling").textContent = formatCurrency(aggregate.totalSelling);
    document.getElementById("inv-total-gst").textContent = formatCurrency(aggregate.totalGst);
    document.getElementById("inv-subtotal").textContent = formatCurrency(aggregate.subtotal);
    document.getElementById("inv-total-discount").textContent = formatCurrency(aggregate.totalDiscount);
    document.getElementById("inv-grand-total").textContent = formatCurrency(aggregate.grandTotal);
}

// --- Setup Event Listeners ---
function setupEventListeners() {
    // Theme toggle button
    document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

    // Form inputs change/keyup listeners to trigger reactive calculation breakdown
    const formInputs = ["product-qty", "product-price", "product-selling-price", "product-gst", "product-discount"];
    formInputs.forEach(id => {
        const elem = document.getElementById(id);
        elem.addEventListener("input", updateLiveFormPreview);
    });

    // Reactive input updates on invoice meta parameters
    const metaInputs = ["bill-number", "bill-date", "client-name", "client-gst", "client-phone", "client-address"];
    metaInputs.forEach(id => {
        const elem = document.getElementById(id);
        elem.addEventListener("input", calculateAndRender);
    });

    // Submit button for the product adding form
    document.getElementById("product-form").addEventListener("submit", handleProductFormSubmit);
    document.getElementById("btn-clear-form").addEventListener("click", resetProductForm);
    document.getElementById("product-stock-id").addEventListener("change", handleStockSelection);
    document.getElementById("stock-form").addEventListener("submit", handleStockFormSubmit);
    document.getElementById("nav-dashboard").addEventListener("click", () => showAppView("dashboard"));
    document.getElementById("btn-open-billing").addEventListener("click", () => showAppView("billing"));
    document.getElementById("btn-open-stock").addEventListener("click", () => showAppView("stock"));
    document.getElementById("btn-open-sales").addEventListener("click", () => showAppView("sales"));
    document.getElementById("btn-open-admin").addEventListener("click", () => showAppView("admin"));

    // Modal Control Events
    document.getElementById("btn-open-settings").addEventListener("click", openCompanyModal);
    document.getElementById("btn-close-modal").addEventListener("click", closeCompanyModal);
    document.getElementById("btn-cancel-settings").addEventListener("click", closeCompanyModal);
    document.getElementById("company-profile-form").addEventListener("submit", handleCompanyProfileSave);

    // App Reset Action
    document.getElementById("btn-reset-data").addEventListener("click", handleSystemReset);
    document.getElementById("btn-close-reset-password").addEventListener("click", closeResetPasswordModal);
    document.getElementById("btn-cancel-reset-password").addEventListener("click", closeResetPasswordModal);
    document.getElementById("reset-password-form").addEventListener("submit", handleResetPasswordSubmit);
    document.getElementById("btn-open-profile").addEventListener("click", openAccountProfile);
    document.getElementById("btn-close-profile").addEventListener("click", closeAccountProfile);
    document.getElementById("btn-cancel-profile").addEventListener("click", closeAccountProfile);
    document.getElementById("account-profile-form").addEventListener("submit", handleAccountProfileSave);

    // High fidelity export buttons
    document.getElementById("btn-download-pdf").addEventListener("click", downloadInvoicePDF);
    document.getElementById("btn-create-invoice").addEventListener("click", createInvoiceFromLedger);
    document.getElementById("btn-print-bill").addEventListener("click", () => {
        window.print();
    });

    // Close modal when clicking backdrop
    window.addEventListener("click", (e) => {
        const modal = document.getElementById("settings-modal");
        if (e.target === modal) {
            closeCompanyModal();
        }
        const profileModal = document.getElementById("profile-modal");
        if (e.target === profileModal) {
            closeAccountProfile();
        }
        const resetPasswordModal = document.getElementById("reset-password-modal");
        if (e.target === resetPasswordModal) {
            closeResetPasswordModal();
        }
    });
}

function showAppView(view) {
    const views = {
        dashboard: {
            title: "Sales Dashboard",
            description: "Track invoiced totals, GST collected, discounts, and products sold.",
            visible: ["dashboard-metrics"],
            nav: "nav-dashboard"
        },
        billing: {
            title: "Generate New Bill",
            description: "Create an invoice, apply GST and discount, and deduct sold quantities from stock.",
            visible: ["billing-workspace"],
            nav: "btn-open-billing"
        },
        stock: {
            title: "Stock Inventory",
            description: "Add products, monitor available quantities, and keep your store inventory current.",
            visible: ["stock-panel"],
            nav: "btn-open-stock"
        },
        sales: {
            title: "Sales History",
            description: "Review invoices, customers, products sold, GST, discounts, and collected totals.",
            visible: ["sales-history-panel"],
            nav: "btn-open-sales"
        },
        admin: {
            title: "Admin Panel",
            description: "Manage workspace accounts and review user access activity.",
            visible: ["admin-panel"],
            nav: "btn-open-admin"
        }
    }[view];

    if (!views) return;

    ["dashboard-metrics", "sales-history-panel", "billing-workspace", "stock-panel", "admin-panel"].forEach((id) => {
        document.getElementById(id).classList.toggle("view-hidden", !views.visible.includes(id));
    });
    document.getElementById("page-view-title").textContent = views.title;
    document.getElementById("page-view-description").textContent = views.description;
    document.querySelectorAll(".sidebar-nav .nav-item").forEach((item) => item.classList.remove("active"));
    document.getElementById(views.nav).classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (view === "admin") loadAdminUsers();
    if (view === "dashboard" || view === "sales") loadSalesDashboard();
}

// --- Action: Product Form Submit Handler ---
function handleProductFormSubmit(e) {
    e.preventDefault();
    const data = getFormValues();
    if (!data) return;

    if (appState.editingId) {
        // Edit existing product
        const index = appState.products.findIndex(p => p.id === appState.editingId);
        if (index !== -1) {
            appState.products[index] = {
                id: appState.editingId,
                stockId: data.stockId,
                name: data.name,
                qty: data.qty,
                costPrice: data.price,
                sellingPrice: data.sellingPrice,
                profitPercent: data.profit,
                gstPercent: data.gst,
                discountPercent: data.discount
            };
        }
        appState.editingId = null;
        document.getElementById("btn-add-product").innerHTML = `<i class="fa-solid fa-plus"></i> Add to Invoice`;
    } else {
        // Add new product
        const newProduct = {
            id: Date.now().toString(),
            stockId: data.stockId,
            name: data.name,
            qty: data.qty,
            costPrice: data.price,
            sellingPrice: data.sellingPrice,
            profitPercent: data.profit,
            gstPercent: data.gst,
            discountPercent: data.discount
        };
        appState.products.push(newProduct);
    }

    resetProductForm();
    calculateAndRender();
}

// --- Action: Edit Product Trigger ---
window.editProduct = function(id) {
    const product = appState.products.find(p => p.id === id);
    if (!product) return;

    appState.editingId = id;

    // Load values back into product input form
    document.getElementById("product-name").value = product.name;
    document.getElementById("product-stock-id").value = product.stockId || "";
    document.getElementById("product-qty").value = product.qty;
    document.getElementById("product-price").value = product.costPrice;
    document.getElementById("product-selling-price").value = product.sellingPrice || product.costPrice * (1 + product.profitPercent / 100);
    document.getElementById("product-gst").value = product.gstPercent;
    document.getElementById("product-discount").value = product.discountPercent;

    // Update submit button text to indicate edit state
    document.getElementById("btn-add-product").innerHTML = `<i class="fa-solid fa-check"></i> Save Item Details`;

    // Focus input and update calculations preview
    document.getElementById("product-name").focus();
    updateLiveFormPreview();
};

// --- Action: Delete Product Trigger ---
window.deleteProduct = function(id) {
    if (confirm("Are you sure you want to remove this product from the ledger?")) {
        appState.products = appState.products.filter(p => p.id !== id);
        if (appState.editingId === id) {
            appState.editingId = null;
            document.getElementById("btn-add-product").innerHTML = `<i class="fa-solid fa-plus"></i> Add to Invoice`;
            resetProductForm();
        }
        calculateAndRender();
    }
};

// --- Action: Clear Product Form Values ---
function resetProductForm() {
    document.getElementById("product-form").reset();
    appState.editingId = null;
    document.getElementById("btn-add-product").innerHTML = `<i class="fa-solid fa-plus"></i> Add to Invoice`;
    
    // Clear live calculations card back to 0
    updateLiveFormPreview();
}

async function loadStockInventory() {
    const status = document.getElementById("stock-sync-status");
    try {
        const response = await fetch("/api/stock");
        if (!response.ok) throw new Error("Stock API unavailable");
        stockItems = await response.json();
        renderStockInventory();
        populateStockSelector();
        status.innerHTML = `<i class="fa-solid fa-database"></i> ${stockItems.length} item${stockItems.length === 1 ? "" : "s"} synced`;
    } catch (error) {
        status.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Database unavailable`;
        document.getElementById("stock-table-body").innerHTML = `<tr><td colspan="6" class="stock-loading">Unable to load stock inventory.</td></tr>`;
    }
}

async function loadAdminUsers() {
    const tbody = document.getElementById("admin-users-table-body");
    const errorElement = document.getElementById("admin-panel-error");
    try {
        const response = await fetch("/api/admin/users");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load users.");

        document.getElementById("admin-user-count").textContent = `${result.users.length} account${result.users.length === 1 ? "" : "s"}`;
        tbody.innerHTML = result.users.map((user) => {
            const method = user.googleId ? "Google" : "Email & password";
            const roleClass = user.role === "ADMIN" ? "admin-role" : "user-role";
            return `<tr>
                <td><strong>${escapeHtml(user.name)}</strong><small class="admin-user-id">#${user.id}</small></td>
                <td>${escapeHtml(user.email)}</td>
                <td><span class="admin-role-badge ${roleClass}">${user.role}</span></td>
                <td><span class="admin-auth-method"><i class="fa-brands fa-${user.googleId ? "google" : "key"}"></i> ${method}</span></td>
                <td>${new Date(user.createdAt).toLocaleDateString("en-IN")}</td>
                <td>${user._count.sessions}</td>
            </tr>`;
        }).join("") || `<tr><td colspan="6" class="stock-loading">No user accounts found.</td></tr>`;
        errorElement.textContent = "";
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="stock-loading">Unable to load user directory.</td></tr>`;
        errorElement.textContent = error.message;
    }
}

async function loadSalesDashboard() {
    const tbody = document.getElementById("sales-history-table-body");
    const status = document.getElementById("sales-sync-status");
    try {
        const response = await fetch("/api/invoices");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load sales history.");

        const invoices = result.invoices;
        const totals = invoices.reduce((summary, invoice) => {
            summary.total += invoice.total;
            summary.gst += invoice.gstAmount;
            summary.discount += invoice.discountAmount;
            summary.quantity += invoice.items.reduce((quantity, item) => quantity + item.quantity, 0);
            return summary;
        }, { total: 0, gst: 0, discount: 0, quantity: 0 });

        document.getElementById("stat-grand-total").textContent = formatCurrency(totals.total);
        document.getElementById("stat-gst-collected").textContent = formatCurrency(totals.gst);
        document.getElementById("stat-discounts").textContent = formatCurrency(totals.discount);
        document.getElementById("stat-products-count").textContent = totals.quantity;
        status.textContent = `${invoices.length} saved invoice${invoices.length === 1 ? "" : "s"}`;

        tbody.innerHTML = invoices.map((invoice) => {
            const products = invoice.items.map((item) => `${escapeHtml(item.name)} x${item.quantity}`).join(", ");
            const quantity = invoice.items.reduce((sum, item) => sum + item.quantity, 0);
            return `<tr>
                <td><strong>${escapeHtml(invoice.number)}</strong></td>
                <td>${escapeHtml(invoice.customerName)}</td>
                <td>${products}</td>
                <td>${quantity}</td>
                <td>${formatCurrency(invoice.gstAmount)}</td>
                <td><strong class="sales-total">${formatCurrency(invoice.total)}</strong></td>
                <td>${new Date(invoice.createdAt).toLocaleDateString("en-IN")}</td>
            </tr>`;
        }).join("") || `<tr><td colspan="7" class="stock-loading">No invoices created yet.</td></tr>`;
    } catch (error) {
        status.textContent = "Sales unavailable";
        tbody.innerHTML = `<tr><td colspan="7" class="stock-loading">Unable to load saved sales.</td></tr>`;
    }
}

function populateStockSelector() {
    const selector = document.getElementById("product-stock-id");
    selector.innerHTML = `<option value="">Choose an inventory item</option>`;
    stockItems.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = `${item.name} (${item.quantity} available)`;
        option.disabled = item.quantity <= 0;
        selector.appendChild(option);
    });
}

function renderStockInventory() {
    const tbody = document.getElementById("stock-table-body");
    if (!stockItems.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="stock-loading">No stock added yet. Add your first product above.</td></tr>`;
        return;
    }

    tbody.innerHTML = stockItems.map((item) => {
        const status = item.quantity <= 0 ? "Out of stock" : item.quantity <= 5 ? "Low stock" : "In stock";
        const statusClass = item.quantity <= 0 ? "stock-out" : item.quantity <= 5 ? "stock-low" : "stock-good";
        return `<tr>
            <td><strong>${escapeHtml(item.name)}</strong></td>
            <td>${escapeHtml(item.sku || "-")}</td>
            <td><strong>${item.quantity}</strong> units</td>
            <td>${formatCurrency(item.unitPrice)}</td>
            <td>${item.gstPercent}%</td>
            <td><span class="stock-status ${statusClass}">${status}</span></td>
        </tr>`;
    }).join("");
}

function handleStockSelection(event) {
    const stockItem = stockItems.find((item) => item.id === Number(event.target.value));
    if (!stockItem) return;
    document.getElementById("product-name").value = stockItem.name;
    document.getElementById("product-price").value = stockItem.unitPrice;
    document.getElementById("product-selling-price").value = stockItem.unitPrice;
    document.getElementById("product-gst").value = stockItem.gstPercent;
    document.getElementById("product-qty").max = stockItem.quantity;
    document.getElementById("product-qty").value = stockItem.quantity > 0 ? 1 : 0;
    updateLiveFormPreview();
}

async function handleStockFormSubmit(event) {
    event.preventDefault();
    const payload = {
        name: document.getElementById("stock-name").value.trim(),
        sku: document.getElementById("stock-sku").value.trim(),
        quantity: Number(document.getElementById("stock-quantity").value),
        unitPrice: Number(document.getElementById("stock-price").value),
        gstPercent: Number(document.getElementById("stock-gst").value)
    };

    const response = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
        alert(result.error || "Unable to add stock.");
        return;
    }

    document.getElementById("stock-form").reset();
    document.getElementById("stock-gst").value = 18;
    await loadStockInventory();
}

async function createInvoiceFromLedger() {
    if (!appState.products.length) {
        alert("Add at least one stock item to the invoice before creating it.");
        return;
    }
    if (appState.products.some((product) => !product.stockId)) {
        alert("Every invoice item must be selected from Stock Inventory.");
        return;
    }

    const totals = appState.products.reduce((aggregate, product) => {
        const calculations = computeProductCalculations(product.qty, product.costPrice, product.profitPercent, product.gstPercent, product.discountPercent);
        aggregate.subtotal += calculations.subtotal;
        aggregate.gstAmount += calculations.gstAmount;
        aggregate.discountAmount += calculations.discountAmount;
        aggregate.total += calculations.finalAmount;
        return aggregate;
    }, { subtotal: 0, gstAmount: 0, discountAmount: 0, total: 0 });

    const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            number: appState.invoiceMeta.billNumber,
            customerName: appState.invoiceMeta.clientName,
            ...totals,
            items: appState.products.map((product) => ({
                stockItemId: product.stockId,
                name: product.name,
                quantity: product.qty,
                unitPrice: product.sellingPrice || product.costPrice * (1 + product.profitPercent / 100),
                gstPercent: product.gstPercent,
                discountPercent: product.discountPercent,
                total: computeProductCalculations(product.qty, product.costPrice, product.profitPercent, product.gstPercent, product.discountPercent).finalAmount
            }))
        })
    });
    const result = await response.json();
    if (!response.ok) {
        alert(result.error || "Invoice could not be created.");
        await loadStockInventory();
        return;
    }

    alert(`Invoice ${result.number} created. Stock quantities have been deducted.`);
    appState.products = [];
    resetInvoiceFormToDefaults();
    calculateAndRender();
    await loadSalesDashboard();
    await loadStockInventory();
}

function resetInvoiceFormToDefaults() {
    const today = new Date().toISOString().split("T")[0];
    appState.invoiceMeta = {
        billNumber: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
        date: today,
        clientName: "Walk-in Customer",
        clientGst: "",
        clientPhone: "",
        clientAddress: ""
    };
    initializeDefaults();
    resetProductForm();
}

// --- Action: Open/Close Company Settings Modal ---
function openCompanyModal() {
    document.getElementById("settings-modal").classList.add("open");
}

function closeCompanyModal() {
    document.getElementById("settings-modal").classList.remove("open");
}

function openAccountProfile() {
    document.getElementById("profile-modal").classList.add("open");
}

function closeAccountProfile() {
    document.getElementById("profile-modal").classList.remove("open");
}

function closeResetPasswordModal() {
    document.getElementById("reset-password-modal").classList.remove("open");
    document.getElementById("reset-password-form").reset();
    document.getElementById("reset-password-error").textContent = "";
}

function handleResetPasswordSubmit(event) {
    event.preventDefault();
    const password = document.getElementById("reset-password").value;
    if (password !== demoAccountPassword) {
        document.getElementById("reset-password-error").textContent = "Incorrect password. The reset was not completed.";
        document.getElementById("reset-password").select();
        return;
    }

    closeResetPasswordModal();
    if (confirm("This will erase all company profile information, client entries, and the products ledger. Do you want to proceed?")) {
        resetSystemData();
    }
}

function handleAccountProfileSave(event) {
    event.preventDefault();
    appState.account = {
        name: document.getElementById("account-name").value.trim(),
        email: document.getElementById("account-email").value.trim().toLowerCase()
    };
    initializeAccountProfile();
    saveStateToStorage();
    closeAccountProfile();
}

// --- Action: Save Company Profile ---
function handleCompanyProfileSave(e) {
    e.preventDefault();

    appState.company.name = document.getElementById("company-name").value.trim();
    appState.company.gstin = document.getElementById("company-gst").value.trim().toUpperCase();
    appState.company.phone = document.getElementById("company-phone").value.trim();
    appState.company.email = document.getElementById("company-email").value.trim();
    appState.company.address = document.getElementById("company-address").value.trim();

    closeCompanyModal();
    calculateAndRender();
}

// --- Action: Complete System Reset ---
function handleSystemReset() {
    document.getElementById("reset-password-modal").classList.add("open");
    document.getElementById("reset-password").focus();
}

function resetSystemData() {
    localStorage.removeItem("gst_billing_state");
    appState = {
            company: {
                name: "Your Company Ltd.",
                gstin: "29ABCDE1234F1Z5",
                phone: "+91 80 4567 8901",
                email: "billing@company.com",
                address: "456 Commerce Blvd, Suite 100, Bengaluru, KA - 560001"
            },
            invoiceMeta: {
                billNumber: "INV-2026-001",
                date: new Date().toISOString().split('T')[0],
                clientName: "John Doe & Co.",
                clientGst: "27AAAAA1111A1Z1",
                clientPhone: "+91 98765 43210",
                clientAddress: "123 Corporate Park, Sector 62, Mumbai, MH"
            },
            products: [],
            editingId: null,
            theme: "light",
            account: {
                name: "Admin User",
                email: "admin@gst.com"
            }
    };
    initializeDefaults();
    resetProductForm();
    calculateAndRender();
}

// --- Action: Toggle Dark/Light Mode Theme ---
function toggleTheme() {
    const themeIcon = document.getElementById("theme-icon");
    const themeText = document.getElementById("theme-text");

    if (appState.theme === "light") {
        appState.theme = "dark";
        document.documentElement.setAttribute("data-theme", "dark");
        themeIcon.className = "fa-solid fa-sun";
        themeText.textContent = "Light Mode";
    } else {
        appState.theme = "light";
        document.documentElement.setAttribute("data-theme", "light");
        themeIcon.className = "fa-solid fa-moon";
        themeText.textContent = "Dark Mode";
    }
    saveStateToStorage();
}

// --- Action: High-Fidelity PDF Export Engine ---
function downloadInvoicePDF() {
    const element = document.getElementById("invoice-print-area");
    
    // Set custom visual styles optimized specifically for high-quality client PDF downloads
    const opt = {
        margin:       [10, 10, 10, 10], // Margin in mm (top, left, bottom, right)
        filename:     `${appState.company.name.replace(/[^a-z0-9]/gi, '_')}_Invoice_${appState.invoiceMeta.billNumber}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2.5, useCORS: true, letterRendering: true }, // Higher scale represents high-resolution print vectors
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' } // A4 Paper standard format
    };

    // Execute standard html2pdf promise flow
    html2pdf().set(opt).from(element).save();
}

// --- Helper: Format Date string beautifully ---
function formatDate(dateStr) {
    if (!dateStr) return "";
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-IN', options);
}

// --- Helper: Escapes HTML strings to prevent XSS vulnerability ---
function escapeHtml(str) {
    if (!str) return '';
    return str
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
