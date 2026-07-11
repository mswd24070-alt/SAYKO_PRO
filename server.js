const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
    secret: "saiko-secure-secret-2026",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

const supabase = createClient(
    "https://kakofhgzpgspsyslesxn.supabase.co",
    "sb_publishable_3RvAZ9uHqcI4u3dtgskEQw_vIc4bzut"
);

const SECRET_KEY = "jhgjhd757487gvgjdf687cb843gvgeg&%FGSVG&&766757dc^ggcjs9900";

const fixVal = (v) => v === null || v === undefined ? "" : String(v).trim();
const fixNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0.0 : n; };
const makeHash = (d) => crypto.createHmac("sha256", SECRET_KEY).update(d).digest("hex");
const makeFullAccount = (acc) => "00111" + acc + "0001";
const makeIBAN = (acc) => "SDG0302230341" + acc + "770001";

// ✅ منع السيرفر من النوم على Render - كل 10 دقائق
setInterval(() => {
    require("https").get("https://sayko-osll.onrender.com/api", { timeout: 5000 }).on("error", () => {});
}, 10 * 60 * 1000);

// ✅ منع النوم بـ GET عادي
setInterval(() => {
    const https = require("https");
    https.get("https://sayko-osll.onrender.com/api", (res) => {
        console.log(`[PING] Keep-alive: ${res.statusCode}`);
    }).on("error", () => {});
}, 8 * 60 * 1000);

/* --- واجهات لوحة التحكم --- */
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/admin-login", (req, res) => {
    const { password } = req.body;
    if (password === "sayko2026") { 
        req.session.authenticated = true; 
        res.redirect("/admin"); 
    }
    else res.redirect("/?error=1");
});

app.get("/admin", (req, res) => {
    if (!req.session.authenticated) return res.redirect("/");
    res.sendFile(path.join(__dirname, "public", "admin-panel.html"));
});

app.get("/logout", (req, res) => { 
    req.session.destroy(); 
    res.redirect("/"); 
});

/* 🔑 1. LOGIN API */
app.post(["/login", "/api/login"], async (req, res) => {
    const acc  = req.body.account_number || req.query.account_number || req.body.p1 || req.query.p1;
    const pass = req.body.password || req.query.password || req.body.p2 || req.query.p2;

    if (!acc || !pass) return res.json({ status: "failed", message: "Missing credentials" });

    const { data: user } = await supabase
        .from("profiles").select("*").eq("account_number_short", acc).maybeSingle();

    if (!user || user.password !== pass)
        return res.json({ status: "failed", message: "Invalid account or password" });

    const bal  = fixNum(user.balance);
    const hash = makeHash(acc + user.password);

    res.json({
        status:          "success",
        success:         true,
        p1:              fixVal(acc),
        p2:              fixVal(user.full_name),
        p3:              bal,
        username:        fixVal(user.full_name),
        full_name:       fixVal(user.full_name),
        balance:         bal,
        account_number:  fixVal(acc),
        release_hash:    hash,
        general_message: fixVal(user.general_message),
        full_account_number:  makeFullAccount(acc),
        account_number_full:  makeFullAccount(acc),
        account_type:         fixVal(user.account_type) || "حساب توفير",
        branch:               fixVal(user.branch) || "الخرطوم",
        iban:                 makeIBAN(acc),
        currency:             "SDG"
    });
});

/* 💰 2. FETCH BALANCE API */
app.all(["/fetch_balance", "/api/fetch_balance"], async (req, res) => {
    const acc = req.body.account_number || req.query.account_number || req.body.p1 || req.query.p1;
    if (!acc) return res.json({ status: "failed", message: "Missing account number" });

    const { data: user } = await supabase
        .from("profiles").select("*").eq("account_number_short", acc).maybeSingle();

    if (!user) return res.json({ status: "failed", success: false, balance: 0, p3: 0 });

    const bal = fixNum(user.balance);

    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Content-Type", "application/json");
    
    res.json({
        status:               "success",
        success:              true,
        balance:              bal,
        p2:                   fixVal(user.full_name),
        p3:                   bal,
        full_name:            fixVal(user.full_name),
        full_account_number:  makeFullAccount(acc),
        short_account_number: acc,
        account_number_full:  makeFullAccount(acc),
        account_number_short: acc,
        account_type:         fixVal(user.account_type) || "حساب توفير",
        branch:               fixVal(user.branch) || "الخرطوم",
        iban:                 makeIBAN(acc),
        currency:             "SDG"
    });
});

/* 🔍 3. SEARCH ACCOUNT API */
app.all(["/search_account", "/get_recipient", "/api/get_recipient"], async (req, res) => {
    let targetAcc = req.body.search_key || req.query.search_key || req.body.p2 || req.body.account_number;
    if (!targetAcc) return res.json({ status: "failed", message: "Account number required" });

    let shortAcc = String(targetAcc).trim();
    if (shortAcc.length >= 7) shortAcc = shortAcc.slice(-7);

    const { data: receiver } = await supabase
        .from("profiles").select("*").eq("account_number_short", shortAcc).maybeSingle();

    if (!receiver) return res.json({ status: "failed", success: false, message: "الحساب غير موجود" });

    res.json({
        status:               "success",
        success:              true,
        p2:                   fixVal(receiver.full_name),
        full_name:            fixVal(receiver.full_name),
        account_owner:        fixVal(receiver.full_name),
        short_account_number: shortAcc,
        account_number_short: shortAcc,
        full_account_number:  makeFullAccount(shortAcc),
        account_number_full:  makeFullAccount(shortAcc),
        account_type:         fixVal(receiver.account_type) || "حساب توفير",
        branch:               fixVal(receiver.branch) || "الخرطوم",
        iban:                 makeIBAN(shortAcc)
    });
});

/* 💸 4. TRANSFER API */
app.post(["/update_balance", "/api/update_balance"], async (req, res) => {
    const fromAcc = req.body.account_number || req.body.p1;
    const toAcc   = req.body.target_account_identifier_for_server || req.body.p2;
    const amount  = parseFloat(req.body.transfer_amount || req.body.p3 || 0);

    if (!fromAcc || !toAcc || isNaN(amount) || amount <= 0)
        return res.json({ status: "failed", success: false, new_balance: 0, balance: 0, message: "Invalid transfer data" });

    const { data: sender } = await supabase
        .from("profiles").select("*").eq("account_number_short", fromAcc).maybeSingle();
    
    if (!sender) return res.json({ status: "failed", success: false, new_balance: 0, balance: 0, message: "Sender not found" });

    const senderBal = fixNum(sender.balance);
    if (senderBal < amount) return res.json({ status: "failed", success: false, new_balance: senderBal, balance: senderBal, message: "Insufficient balance" });

    let toAccShort = toAcc;
    if (toAcc && toAcc.length >= 7) toAccShort = toAcc.slice(-7);

    const { data: receiver } = await supabase
        .from("profiles").select("*").eq("account_number_short", toAccShort).maybeSingle();
    
    if (!receiver) return res.json({ status: "failed", success: false, new_balance: senderBal, balance: senderBal, message: "Receiver not found" });

    const newSenderBal   = senderBal - amount;
    const newReceiverBal = fixNum(receiver.balance) + amount;

    // تحديث رصيد المرسل والمستقبل
    await supabase.from("profiles").update({ balance: newSenderBal }).eq("account_number_short", fromAcc);
    await supabase.from("profiles").update({ balance: newReceiverBal }).eq("account_number_short", toAccShort);

    const txId = "TX" + Date.now();
    await supabase.from("transactions").insert([{
        transaction_id:       txId,
        transaction_type:     "تحويل",
        transaction_date:     new Date().toISOString(),
        transaction_amount:   amount,
        from_account_number:  fromAcc,
        to_account_number:    toAccShort,
        transaction_status:   "ناجح",
        beneficiary_name:     fixVal(receiver.full_name),
        comment:              ""
    }]);

    // ✅ ارجع البيانات الكاملة من Database
    res.json({
        status:              "success",
        success:             true,
        p3:                  newSenderBal,
        transaction_id:      txId,
        new_balance:         newSenderBal,
        balance:             newSenderBal,
        message:             "Transfer successful",
        transaction_date:    new Date().toISOString(),
        full_account_number: makeFullAccount(fromAcc),
        account_owner:       fixVal(sender.full_name),
        account_branch:      fixVal(sender.branch) || "الخرطوم",
        account_type:        fixVal(sender.account_type) || "حساب توفير",
        chose_account_key:   toAcc,
        receiver_name:       fixVal(receiver.full_name),
        receiver_account:    toAccShort,
        receiver_branch:     fixVal(receiver.branch) || "الخرطوم",
        comment:             "",
        price_key:           amount.toString(),
        is_barcode_key:      false
    });
});

/* ========== ADMIN PANEL ENDPOINTS ========== */

/* 📋 5. GET ALL ACCOUNTS */
app.get("/admin-api/accounts", async (req, res) => {
    if (!req.session.authenticated) return res.status(401).json({ error: "Unauthorized" });
    
    const { data: accounts } = await supabase.from("profiles").select("*");
    res.json({ accounts: accounts || [] });
});

/* ➕ 6. CREATE ACCOUNT */
app.post("/admin-api/create-account", async (req, res) => {
    if (!req.session.authenticated) return res.status(401).json({ error: "Unauthorized" });
    
    const { account_number, full_name, password, balance, account_type, branch } = req.body;
    
    if (!account_number || !full_name || !password) {
        return res.json({ status: "failed", message: "Missing required fields" });
    }

    const { error } = await supabase.from("profiles").insert([{
        account_number_short: account_number,
        full_name:            full_name,
        password:             password,
        balance:              parseFloat(balance) || 0,
        account_type:         account_type || "حساب توفير",
        branch:               branch || "الخرطوم",
        general_message:      ""
    }]);

    if (error) return res.json({ status: "failed", message: error.message });
    res.json({ status: "success", message: "Account created successfully" });
});

/* 🔍 7. GET ACCOUNT INFO */
app.post("/admin-api/get-account", async (req, res) => {
    if (!req.session.authenticated) return res.status(401).json({ error: "Unauthorized" });
    
    const { account_number } = req.body;
    if (!account_number) return res.json({ status: "failed", message: "Account number required" });

    const { data: account } = await supabase
        .from("profiles")
        .select("*")
        .eq("account_number_short", account_number)
        .maybeSingle();

    if (!account) return res.json({ status: "failed", message: "Account not found" });
    res.json({ status: "success", account });
});

/* 💳 8. RECHARGE ACCOUNT (شحن الحساب) */
app.post("/admin-api/recharge", async (req, res) => {
    if (!req.session.authenticated) return res.status(401).json({ error: "Unauthorized" });
    
    const { account_number, amount } = req.body;
    if (!account_number || !amount) return res.json({ status: "failed", message: "Missing fields" });

    const { data: account } = await supabase
        .from("profiles")
        .select("*")
        .eq("account_number_short", account_number)
        .maybeSingle();

    if (!account) return res.json({ status: "failed", message: "Account not found" });

    const newBalance = fixNum(account.balance) + parseFloat(amount);

    const { error } = await supabase
        .from("profiles")
        .update({ balance: newBalance })
        .eq("account_number_short", account_number);

    if (error) return res.json({ status: "failed", message: error.message });

    // سجل العملية
    await supabase.from("transactions").insert([{
        transaction_id:       "CHG" + Date.now(),
        transaction_type:     "شحن",
        transaction_date:     new Date().toISOString(),
        transaction_amount:   parseFloat(amount),
        from_account_number:  "ADMIN",
        to_account_number:    account_number,
        transaction_status:   "ناجح",
        beneficiary_name:     account.full_name,
        comment:              "شحن من الأدمن"
    }]);

    res.json({ 
        status: "success", 
        message: "Account recharged successfully",
        new_balance: newBalance
    });
});

/* 📊 9. GET ACCOUNT TRANSACTIONS */
app.post("/admin-api/transactions", async (req, res) => {
    if (!req.session.authenticated) return res.status(401).json({ error: "Unauthorized" });
    
    const { account_number } = req.body;
    if (!account_number) return res.json({ status: "failed", message: "Account number required" });

    const { data: transactions } = await supabase
        .from("transactions")
        .select("*")
        .or(`from_account_number.eq.${account_number},to_account_number.eq.${account_number}`)
        .order("transaction_date", { ascending: false });

    res.json({ 
        status: "success",
        transactions: transactions || [] 
    });
});

/* ✏️ 10. UPDATE ACCOUNT */
app.post("/admin-api/update-account", async (req, res) => {
    if (!req.session.authenticated) return res.status(401).json({ error: "Unauthorized" });
    
    const { account_number, full_name, balance, account_type, branch } = req.body;
    if (!account_number) return res.json({ status: "failed", message: "Account number required" });

    const { error } = await supabase
        .from("profiles")
        .update({
            full_name:    full_name || undefined,
            balance:      balance !== undefined ? parseFloat(balance) : undefined,
            account_type: account_type || undefined,
            branch:       branch || undefined
        })
        .eq("account_number_short", account_number);

    if (error) return res.json({ status: "failed", message: error.message });
    res.json({ status: "success", message: "Account updated successfully" });
});

/* 🗑️ 11. DELETE ACCOUNT */
app.post("/admin-api/delete-account", async (req, res) => {
    if (!req.session.authenticated) return res.status(401).json({ error: "Unauthorized" });
    
    const { account_number } = req.body;
    if (!account_number) return res.json({ status: "failed", message: "Account number required" });

    const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("account_number_short", account_number);

    if (error) return res.json({ status: "failed", message: error.message });
    res.json({ status: "success", message: "Account deleted successfully" });
});

/* ✅ API PING */
app.get("/api", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🚀 Keep-alive enabled - Server won't sleep`);
});
