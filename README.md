# Bankak Demo API

API تجريبي لتطبيقك، بدون الاتصال بأي نظام بنكي حقيقي.

## التشغيل

```bash
npm install
npm start
```

المنفذ:
`PORT` أو 3000

## Endpoints

- POST `/api/login`
- POST `/api/fetch_account_details`
- POST `/api/fetch_balance`
- POST `/api/get_transactions1`
- POST `/api/update_balance`
- POST `/bankak/insert_data.php`

بيانات الحساب التجريبي:
- account_number: `100001`
- password: `1234`

## ملاحظة

البيانات محفوظة في الذاكرة فقط، وستختفي عند إعادة تشغيل السيرفر.
