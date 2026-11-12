# UAT Upgrade Guide (Bharat Radius)

Yeh guide `feature/uat-enhancements` branch ko **UAT server** par chalane ke liye hai.
Live database (`RadiusSoftwareDb`) ko is process mein **haath nahi lagana hai**.

---

## 1. Database ka backup lijiye (UatDatabase)

```bash
pg_dump -U postgres -h localhost -F c -f UatDatabase-before-upgrade.backup UatDatabase
```

## 2. Duplicate PPPoE username check kariye

pgAdmin mein `Database/check-duplicate-pppoe-usernames.sql` chalaiye.
Agar koi row aaye to pehle use theek kariye (delete ya rename). Duplicate rehne par
`UniquePppoeUsername` migration ruk jayegi aur batayegi kaunse username duplicate hain.

## 3. Migration chalaiye (do mein se koi ek tareeka)

**A. pgAdmin / psql se (sabse aasaan):**

```bash
psql -U postgres -h localhost -d UatDatabase -v ON_ERROR_STOP=1 -f Database/uat-upgrade.sql
```

Script idempotent hai: dobara chalane par kuch nahi bigadta.

**B. dotnet ef se:**

```bash
cd src
dotnet ef database update --project RadiusSoftware.Infrastructure --startup-project RadiusSoftware.API
```

Migration kya karti hai:
- Naye tables: `SmsGatewayConfigs`, `SmsLogs`, `PaymentGatewayConfigs`
- Naye columns: Subscriber (`LastAuthResult`, `LastAuthReason`, `LastAuthAt`),
  package history (`StartDate`, `EndDate`, `Quantity`, `AmountCharged`, `SiteId`, `CreatedBy...`),
  NAS (`DashboardInterfaces`), User (`DashboardConfigJson`)
- Tez list ke liye indexes
- Purana expiry job expired users ko `IsActive = false` aur `ConnectionEnabled = false` kar deta tha.
  Ab expiry RADIUS server date se check karta hai, isliye aise users wapas ON kiye jaate hain
  (woh tab tak **Expired** hi rahenge jab tak recharge na ho).
- PPPoE username par unique index (case-insensitive)
- `UserOwnLogo`: har user ka apna logo (`Users.LogoUrl`). Company admin ka purana logo uske account par copy ho jaata hai.

- `NormalizeSubscriberMacAddresses`: MAC addresses ek format (XX:XX:XX:XX:XX:XX) mein (Static IP / Hotspot MAC login ke liye). Sirf data, koi column nahi badla.
- `PerformanceIndexes`: RADIUS accounting, auth log, MAC login, wallet ke liye indexes (IF NOT EXISTS).

## Static IP / IPoE aur Hotspot (MikroTik setup)

- **PPPoE**: pehle jaisa (username + password).
- **Hotspot**: subscriber mein Service = Hotspot, login username/password do. MikroTik Hotspot profile mein `use-radius=yes`.
  MAC se auto-login ke liye subscriber mein MAC bhariye aur Hotspot `login-by` mein `mac` on kariye.
- **Static IP / IPoE**: Service = Static, MAC (zaroori) aur Static IP bhariye. MikroTik DHCP server par
  `use-radius=yes` kariye. Router client ka MAC bhejta hai; RADIUS usi subscriber ko pehchaan kar uska
  Static IP (Framed-IP-Address), package speed aur expiry tak ka time deta hai. Expire hone par reject.
- MAC login PPPoE requests ke liye kabhi allow nahi hota (security).

Agar migration "Duplicate PPPoE usernames found" bataye to `Database/remove-duplicate-pppoe-usernames.sql`
chalaiye (har duplicate ka sabse naya record rakhta hai, history shift karta hai, backup table banata hai).

## 4. Backend config (`src/RadiusSoftware.API/appsettings.json`)

- `ConnectionStrings:DefaultConnection` mein `Database=UatDatabase` already set hai.
- **`BackgroundJobs` UAT mein OFF hain** (zaroori):

  ```json
  "BackgroundJobs": {
    "RadiusServer": false,
    "ExpiredSubscribers": false,
    "AutoConfigureNas": false,
    "SmsReminders": false
  }
  ```

  UatDatabase live ki copy hai, isliye usme **asli routers** ke IP/password hain.
  Agar yeh jobs UAT par ON hon to UAT live users ko disconnect kar sakta hai, live routers
  ki RADIUS setting badal sakta hai, ya live UDP 1812/1813 ports se takra sakta hai.
  Live par deploy karte waqt inhe `true` kariye.

- Agar UAT par RADIUS test karna ho to `RadiusServer: true` kariye aur alag ports dijiye:

  ```json
  "RadiusServer": { "ListenAuthPort": 11812, "ListenAcctPort": 11813, ... }
  ```

- Panel se kiye gaye kaam (Disconnect, Recharge ke baad speed change, NAS Configure)
  UAT mein bhi asli router par jaate hain. UAT mein test ke liye ek test NAS/test router rakhiye.

## 5. Frontend

`RadiusSoftware.Web/.env` file banaiye (`.env.example` dekhiye):

```bash
VITE_API_ROOT=https://<uat-api-domain>
```

Phir build kariye:

```bash
cd RadiusSoftware.Web
pnpm install
pnpm run build
```

## 6. Python syslog listener

`syslog_listener.py` ab DB ka naam/password `appsettings.json` se padhta hai
(file mein password likha nahi hai). Environment variable `BR_DB_NAME`, `BR_DB_PASSWORD`
waghera se override bhi kar sakte hain. UDP 514 par sirf ek listener chal sakta hai.

## 7. Login

- Purane plain-text passwords pehle jaise kaam karenge. Pehli successful login par
  woh apne-aap secure hash mein badal jaate hain.
- Company list mein admin password ab "(encrypted)" dikhega. Naya password set karne ke liye
  Edit mein "New Password" bhariye (khaali chhodne par password nahi badlega).
- "Remember Me" lagane par login 7 din tak rehta hai (`JwtSettings:RememberMeDays`).

## 8. UAT checklist

- [ ] Login (L1 / L2 / L3), Remember Me
- [ ] Subscriber list: search, status filter, expiry date, export, page size
- [ ] Recharge: same package (advance), alag package, quantity 3, kam balance par error
- [ ] Recharge history mein start/end date
- [ ] Dashboard: cards, card click par list, Config se widgets on/off
- [ ] NAS Statistics: ⚙ Interfaces se ports chuniye, graph aata hai
- [ ] Real-time traffic graph: interface dropdown
- [ ] Reports: This Month / Last Month, day-wise / month-wise, recharge list export
- [ ] RADIUS Auth Log page
- [ ] L1: SMS & Payment Gateway, Test SMS
- [ ] Excel import: Username/Password columns, duplicate rows
- [ ] Mobile par sidebar menu aur tables

## Online wallet top-up (Razorpay) – L2 / L3 "Add Money"

1. L1 admin: **SMS & Payment Gateway → Payment Gateway → + Add**
   - Applies to: "All sites (default)" (ya kisi ek site ke liye)
   - Provider: Razorpay, Mode: TEST ya LIVE
   - API key = Razorpay **Key ID**, API secret = **Key Secret**
   - Save karke **Test** dabaiye ("Razorpay keys are working" aana chahiye)
2. Razorpay Dashboard → Settings → **Webhooks → Add**:
   - URL: `https://<api-domain>/api/WalletTopup/webhook/razorpay` (page par Copy button hai)
   - Events: `payment.captured`, `order.paid`, `payment.failed`
   - Secret jo yahan dein, wahi "Salt / Webhook secret" mein save kariye
3. L2 / L3 site: top bar mein wallet balance ke paas **+ Add**, ya Wallet Transactions → **+ Add Money**.
   Recharge ke time balance kam ho to Recharge popup mein bhi "Add money" button aata hai.
4. Paisa **L1 ke Razorpay account** mein jaata hai. Wallet tabhi credit hota hai jab Razorpay
   payment ko confirm kare (signature + captured status + sahi amount). Ek payment se ek hi baar credit.
5. Browser band ho gaya ho to webhook apne-aap credit kar deta hai; ya Wallet Transactions → Online payments
   → **Check status**.
6. Server ko `api.razorpay.com` aur browser ko `checkout.razorpay.com` tak internet access chahiye.
