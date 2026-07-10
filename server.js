const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// تفعيل Cors شامل
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ تعديل: السيرفر يقرا ملفات الواجهة من المجلد الرئيسي مباشرة لأنها برة
app.use(express.static(__dirname));

app.use(session({
    secret: "saiko-final-secure-2026",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

const supabase = createClient(
    "https://kakofhgzpgspslesxn.supabase.co",
    "sb_publishable_3RvAZ9uHqcI4u3dtgskEQw_vIc4bzut"
);

const SECRET_KEY = "jhgjhd757487gvgjdf687cb843gvgeg&%FGSVG&&766757dc^ggcjs9900";

// دالات التنسيق لضمان نصوص String لمنع التطبيق من الطفر
const fixVal = (v) => v === null || v === undefined ? "" : String(v).trim();
const fixBalanceStr = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? "0.00" : n.toFixed(2); // يرجع دايماً نص بنظام قرشين "100.00"
};

const makeHash = (d) => crypto.createHmac("sha256", SECRET_KEY).update(d).digest("hex");
const makeFullAccount = (acc) => "00111" + acc + "0001";
const makeIBAN = (acc) => "SDG0302230341" + acc + "770001";

// ✅ تعديل: دالة Ping ذكية تصحي السيرفر باسمه الجديد لمنعه من النوم
setInterval(() => {
    const https = require("https");
    https.get("https://sayko-osll.onrender.com/api", (res) => {
        console.log("Ping sent to keep server alive...");
    }).on("error", (e) => {
        console.log("Ping error, ignoring...");
    });
}, 10 * 60 * 1000); // كل 10 دقائق


/* ========================================================
   🌐 مسارات الواجهة ولوحة التحكم (تم تصحيح المسارات لقراءة الملفات برة)
   ======================================================== */
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/admin-login", (req, res) => {
    const { password } = req.body;
    if (password === "sayko2026") { 
        req.session.authenticated = true; 
        res.redirect("/admin"); 
    } else {
        res.redirect("/?error=1");
    }
});

app.get("/admin", (req, res) => {
    if (!req.session.authenticated) return res.redirect("/");
    res.sendFile(path.join(__dirname, "admin-panel.html"));
});

app.get("/logout", (req, res) => { 
    req.session.destroy(); 
    res.redirect("/"); 
});


/* ========================================================
   🔑 1. LOGIN API
   ======================================================== */
app.post(["/login", "/api/login"], async (req, res) => {
    const acc  = req.body.account_number || req.query.account_number || req.body.p1 || req.query.p1;
    const pass = req.body.password || req.query.password || req.body.p2 || req.query.p2;

    if (!acc || !pass) return res.json({ status: "failed", message: "Missing credentials" });

    const { data: user } = await supabase
        .from("profiles").select("*").eq("account_number_short", acc).maybeSingle();

    if (!user || user.password !== pass)
        return res.json({ status: "failed", message: "Invalid account or password" });

    const formattedBal = fixBalanceStr(user.balance);
    const hash = makeHash(acc + user.password);

    res.json({
        status:          "success",
        success:         true,
        p1:              fixVal(acc),
        p2:              fixVal(user.full_name),
        p3:              formattedBal, // نص وليس رقم لحل الطفر
        username:        fixVal(user.full_name),
        full_name:       fixVal(user.full_name),
        balance:         formattedBal, // نص وليس رقم لحل الطفر
        account_number:  fixVal(acc),
        release_hash:    hash,
        general_message: fixVal(user.general_message),
        full_account_number:  makeFullAccount(acc),
        account_number_full:  makeFullAccount(acc),
        account_type:         fixVal(user.account_type) || "Saving Account",
        branch:               fixVal(user.branch) || "Main Branch",
        iban:                 makeIBAN(acc),
        currency:             "SDG"
    });
});


/* ========================================================
   💰 2. FETCH BALANCE API - مفرود ونصوص بالكامل لحل الطفر نهائياً
   ======================================================== */
app.all(["/fetch_balance", "/api/fetch_balance"], async (req, res) => {
    const acc = req.body.account_number || req.query.account_number || req.body.p1 || req.query.p1;
    if (!acc) return res.json({ status: "failed", message: "Missing account number" });

    const { data: user } = await supabase
        .from("profiles").select("*").eq("account_number_short", acc).maybeSingle();

    if (!user) return res.json({ status: "failed", success: false, balance: "0.00", p3: "0.00" });

    const formattedBal = fixBalanceStr(user.balance);

    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Content-Type", "application/json");
    
    // إرجاع البيانات مفرودة ونص String بالكامل حتى لا يطفر كلاس الجافا
    res.json({
        status:               "success",
        success:              true,
        balance:              formattedBal,
        p2:                   fixVal(user.full_name),
        p3:                   formattedBal,
        full_name:            fixVal(user.full_name),
        full_account_number:  makeFullAccount(acc),
        short_account_number: acc,
        account_number_full:  makeFullAccount(acc),
        account_number_short: acc,
        account_type:         fixVal(user.account_type) || "Saving Account",
        branch:               fixVal(user.branch) || "Main Branch",
        iban:                 makeIBAN(acc),
        currency:             "SDG"
    });
});


/* ========================================================
   🔍 3. SEARCH ACCOUNT API
   ======================================================== */
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
        account_type:         fixVal(receiver.account_type) || "Saving Account",
        branch:               fixVal(receiver.branch) || "Main Branch",
        iban:                 makeIBAN(shortAcc)
    });
});


/* ========================================================
   💸 4. TRANSFER API
   ======================================================== */
app.post(["/update_balance", "/api/update_balance"], async (req, res) => {
    const fromAcc = req.body.account_number || req.body.p1;
    const toAcc   = req.body.target_account_identifier_for_server || req.body.p2;
    const amount  = parseFloat(req.body.transfer_amount || req.body.p3 || 0);

    if (!fromAcc || !toAcc || isNaN(amount) || amount <= 0)
        return res.json({ status: "failed", success: false, new_balance: "0.00", balance: "0.00", message: "Invalid data" });

    const { data: sender } = await supabase
        .from("profiles").select("*").eq("account_number_short", fromAcc).maybeSingle();
    
    if (!sender) return res.json({ status: "failed", success: false, new_balance: "0.00", balance: "0.00", message: "Sender not found" });

    const senderBal = parseFloat(sender.balance) || 0;
    if (senderBal < amount) {
        const currentBalStr = fixBalanceStr(senderBal);
        return res.json({ status: "failed", success: false, new_balance: currentBalStr, balance: currentBalStr, message: "Insufficient balance" });
    }

    let toAccShort = toAcc;
    if (toAcc && toAcc.length >= 7) toAccShort = toAcc.slice(-7);

    const { data: receiver } = await supabase
        .from("profiles").select("*").eq("account_number_short", toAccShort).maybeSingle();
    
    if (!receiver) {
        const currentBalStr = fixBalanceStr(senderBal);
        return res.json({ status: "failed", success: false, new_balance: currentBalStr, balance: currentBalStr, message: "Receiver not found" });
    }

    const newSenderBal   = senderBal - amount;
    const newReceiverBal = (parseFloat(receiver.balance) || 0) + amount;

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

    const finalSenderBalStr = fixBalanceStr(newSenderBal);
    res.json({
        status:              "success",
        success:             true,
        p3:                  finalSenderBalStr,
        transaction_id:      txId,
        new_balance:         finalSenderBalStr,
        balance:             finalSenderBalStr,
        message:             "Transfer successful",
        transaction_date:    new Date().toISOString(),
        full_account_number: makeFullAccount(fromAcc),
        account_owner:       fixVal(sender.full_name),
        account_branch:      fixVal(sender.branch) || "Main Branch",
        account_type:        fixVal(sender.account_type) || "Saving Account",
        chose_account_key:   toAcc,
        comment:             "",
        price_key:           amount.toFixed(2),
        is_barcode_key:      false
    });
});

app.get("/api", (req, res) => { res.json({ status: "ok" }); });

app.listen(PORT, () => {
    console.log(`Server running perfectly on port ${PORT}`);
});
