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
    secret: "sayko-vip-secret-2026",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

const supabase = createClient(
    "https://kakofhgzpgspsyslesxn.supabase.co",
    "sb_publishable_3RvAZ9uHqcI4u3dtgskEQw_vIc4bzut"
);

const SECRET_KEY = "jhgjhd757487gvgjdf687cb843gvgeg&%FGSVG&&766757dc^ggcjs9900";

// Handle CONNECT requests (for HTTPS proxy tunneling)
app.connect('*', (req, res) => {
    res.writeHead(200, { 'Content-Length': 0 });
    res.end();
});

const fixVal = (v) => v === null || v === undefined ? "" : String(v).trim();
const fixNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0.0 : n; };
const makeHash = (d) => crypto.createHmac("sha256", SECRET_KEY).update(d).digest("hex");
const makeFullAccount = (acc) => "00111" + acc + "0001";
const makeIBAN = (acc) => "SDG0302230341" + acc + "770001";

// ping عشان السيرفر ما ينام على Render
setInterval(() => {
    require("https").get("https://sayko-osll.onrender.com/api").on("error", () => {});
}, 14 * 60 * 1000);

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/admin-login", (req, res) => {
    const { password } = req.body;
    if (password === "sayko2026") { req.session.authenticated = true; res.redirect("/admin"); }
    else res.redirect("/?error=1");
});

app.get("/admin", (req, res) => {
    if (!req.session.authenticated) return res.redirect("/");
    res.sendFile(path.join(__dirname, "public", "admin-panel.html"));
});

app.get("/logout", (req, res) => { req.session.destroy(); res.redirect("/"); });

/* LOGIN */
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
        // اضفنا هاي البيانات الإضافية
        full_account_number:  makeFullAccount(acc),
        account_number_full:  makeFullAccount(acc),
        account_type:         fixVal(user.account_type) || "حساب توفير",
        branch:               fixVal(user.branch) || "الخرطوم",
        iban:                 makeIBAN(acc),
        currency:             "SDG"
    });
});

/* FETCH BALANCE */
app.all(["/fetch_balance", "/api/fetch_balance"], async (req, res) => {
    const acc = "3503252";

    const { data: user } = await supabase
        .from("profiles")
        .select("*")
        .eq("account_number_short", acc)
        .maybeSingle();

    if (!user) {
        return res.json({ 
            status: "failed", 
            success: false, 
            balance: 0,
            p3: 0
        });
    }

    const bal = fixNum(user.balance);

    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Content-Type", "application/json");
    
    // ارجع JSON صريح بدون أي مشاكل
    const response = {
        status: "success",
        success: true,
        balance: bal,
        p2: fixVal(user.full_name),
        p3: bal,
        data: {
            full_name: fixVal(user.full_name),
            full_account_number: makeFullAccount(acc),
            short_account_number: acc,
            account_number_full: makeFullAccount(acc),
            account_number_short: acc,
            account_type: fixVal(user.account_type) || "حساب توفير",
            branch: fixVal(user.branch) || "الخرطوم",
            balance: bal,
            iban: makeIBAN(acc),
            currency: "SDG"
        }
    };
    
    res.json(response);
});
        }
    });
});

/* TRANSFER */
app.post(["/update_balance", "/api/update_balance"], async (req, res) => {
    const fromAcc = req.body.account_number || req.body.p1;
    const toAcc   = req.body.target_account_identifier_for_server || req.body.p2;
    const amount  = parseFloat(req.body.transfer_amount || req.body.p3 || 0);

    if (!fromAcc || !toAcc || isNaN(amount) || amount <= 0)
        return res.json({ 
            status: "failed", 
            success: false, 
            new_balance: 0, 
            balance: 0,
            message: "Invalid transfer data" 
        });

    const { data: sender } = await supabase
        .from("profiles").select("*").eq("account_number_short", fromAcc).maybeSingle();
    
    if (!sender) 
        return res.json({ 
            status: "failed", 
            success: false, 
            new_balance: 0, 
            balance: 0,
            message: "Sender not found" 
        });

    const senderBal = fixNum(sender.balance);
    if (senderBal < amount) 
        return res.json({ 
            status: "failed", 
            success: false, 
            new_balance: senderBal, 
            balance: senderBal,
            message: "Insufficient balance" 
        });

    // استخرج آخر 7 أرقام من الحساب المستقبل
    let toAccShort = toAcc;
    if (toAcc && toAcc.length >= 7) {
        toAccShort = toAcc.slice(-7); // Always get last 7 digits
    }

    const { data: receiver } = await supabase
        .from("profiles").select("*").eq("account_number_short", toAccShort).maybeSingle();
    
    if (!receiver) 
        return res.json({ 
            status: "failed", 
            success: false, 
            new_balance: senderBal, 
            balance: senderBal,
            message: "Receiver not found" 
        });

    const newSenderBal   = senderBal - amount;
    const newReceiverBal = fixNum(receiver.balance) + amount;

    // تحديث الرصيد
    await supabase.from("profiles").update({ balance: newSenderBal }).eq("account_number_short", fromAcc);
    await supabase.from("profiles").update({ balance: newReceiverBal }).eq("account_number_short", toAccShort);

    // حفظ العملية
    const txId = "TX" + Date.now();
    await supabase.from("transactions").insert([{
        transaction_id:       txId,
        transaction_type:     "تحويل",
        transaction_date:     new Date().toISOString(),
        transaction_amount:   amount,
        from_account_number:  fromAcc,
        to_account_number:    toAcc,
        transaction_status:   "ناجح",
        beneficiary_name:     fixVal(receiver.full_name),
        comment:              ""
    }]);

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
        account_branch:      fixVal(sender.branch),
        account_type:        fixVal(sender.account_type),
        chose_account_key:   toAcc,
        comment:             "",
        price_key:           amount.toString(),
        is_barcode_key:      false
    });
});

/* API PING */
app.get("/api", (req, res) => {
    res.json({ status: "ok" });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
