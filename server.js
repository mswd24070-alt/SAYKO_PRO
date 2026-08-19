const express = require("express");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Demo/test data only. Replace with your own database later.
const accounts = new Map([
  ["100001", {
    account_number: "100001",
    short_account_number: "0001",
    full_account_number: "100001",
    account_name: "حساب تجريبي",
    account_branch: "الفرع الرئيسي",
    account_type: "savings",
    balance: "5000.00",
    password: "1234"
  }]
]);

const transactions = new Map();

function findAccount(value) {
  if (!value) return null;
  const key = String(value);
  return accounts.get(key) ||
    [...accounts.values()].find(a =>
      a.short_account_number === key ||
      a.full_account_number === key
    ) || null;
}

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "bankak-demo-api" });
});

// Login
app.post("/api/login", (req, res) => {
  const accountNumber =
    req.body.account_number ??
    req.body.username ??
    req.body.accountNumber;

  const password =
    req.body.password ??
    req.body.account_password ??
    req.body.accountPassword;

  const account = findAccount(accountNumber);

  if (!account || String(password ?? "") !== String(account.password)) {
    return res.status(401).json({
      status: "invalid",
      message: "Invalid account or password"
    });
  }

  res.json({
    status: "valid",
    message: "Login successful",
    account_number: account.account_number,
    account_name: account.account_name,
    session: `demo-${account.account_number}`,
    balance: String(account.balance)
  });
});

// Account details
app.post("/api/fetch_account_details", (req, res) => {
  const account = findAccount(
    req.body.account_number ??
    req.body.accountNumber ??
    req.body.to_account_number
  );

  if (!account) {
    return res.status(404).json({
      status: "not_found",
      message: "Account not found"
    });
  }

  res.json({
    status: "valid",
    account_number: account.account_number,
    short_account_number: account.short_account_number,
    full_account_number: account.full_account_number,
    account_name: account.account_name,
    account_branch: account.account_branch,
    account_type: account.account_type
  });
});

// Balance
app.post("/api/fetch_balance", (req, res) => {
  const account = findAccount(
    req.body.account_number ??
    req.body.accountNumber ??
    req.body.username
  );

  if (!account) {
    return res.status(404).json({
      status: "not_found",
      message: "Account not found"
    });
  }

  res.json({
    status: "valid",
    account_number: account.account_number,
    account_name: account.account_name,
    balance: String(account.balance)
  });
});

// Transactions
app.post("/api/get_transactions1", (req, res) => {
  const account = findAccount(
    req.body.account_number ??
    req.body.accountNumber ??
    req.body.username
  );

  if (!account) {
    return res.status(404).json({
      status: "not_found",
      message: "Account not found"
    });
  }

  res.json({
    status: "valid",
    transactions: transactions.get(account.account_number) || []
  });
});

// Demo balance update
app.post("/api/update_balance", (req, res) => {
  const account = findAccount(
    req.body.account_number ??
    req.body.accountNumber
  );

  if (!account) {
    return res.status(404).json({
      status: "not_found",
      message: "Account not found"
    });
  }

  const newBalance = req.body.balance;
  if (newBalance === undefined || Number.isNaN(Number(newBalance))) {
    return res.status(400).json({
      status: "invalid",
      message: "balance is required"
    });
  }

  account.balance = String(newBalance);

  res.json({
    status: "valid",
    account_number: account.account_number,
    balance: String(account.balance)
  });
});

// Compatibility endpoint for the old PHP-style path.
// Demo only: accepts account data and stores it in memory.
app.post("/bankak/insert_data.php", (req, res) => {
  const account = {
    account_number: String(req.body.account_number ?? ""),
    short_account_number: String(req.body.account_number_short ?? req.body.short_account_number ?? ""),
    full_account_number: String(req.body.full_account_number ?? req.body.account_number ?? ""),
    account_name: String(req.body.account_name ?? req.body.name ?? ""),
    account_branch: String(req.body.account_branch ?? req.body.branch ?? ""),
    account_type: String(req.body.account_type ?? "savings"),
    balance: String(req.body.balance ?? "0.00"),
    password: String(req.body.password ?? "")
  };

  if (!account.account_number || !account.account_name) {
    return res.status(400).json({
      status: "invalid",
      message: "account_number and account_name are required"
    });
  }

  accounts.set(account.account_number, account);

  res.json({
    status: "valid",
    message: "Account saved",
    account_number: account.account_number
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bankak demo API listening on port ${PORT}`);
});
