# Production Go-Live Checklist (Bharat Radius)

UAT par sab theek chalne ke baad live (`RadiusSoftwareDb`) par jaane ke steps.
Kram se kariye. Har step ke baad agla.

---

## 1. Backup (sabse pehle)

```bash
pg_dump -U postgres -h localhost -F c -f RadiusSoftwareDb-before-golive.backup RadiusSoftwareDb
```

Purane API aur frontend folder ki bhi copy rakhiye (rollback ke liye).

## 2. Live database update

1. Duplicate PPPoE username check: `Database/check-duplicate-pppoe-usernames.sql` (live DB par).
   Agar rows aayein to dhyan se dekhiye. Live par `remove-duplicate-pppoe-usernames.sql` tabhi chalaiye
   jab pakka ho ki "sabse naya record" hi sahi hai.
2. Migration: pgAdmin mein **RadiusSoftwareDb** par `Database/uat-upgrade.sql` chalaiye
   (sab migrations idempotent hain; dobara chalane se kuch nahi bigadta).
   Ya Visual Studio mein connection string live DB ka karke `Update-Database`.
3. Check:
   ```sql
   SELECT "MigrationId" FROM "__EFMigrationsHistory" ORDER BY 1 DESC LIMIT 3;
   ```

## 3. Backend settings (live server par)

Repo ka `appsettings.json` **UAT ke liye** hai. Live server par ye values honi chahiye
(behtar: live server par alag `appsettings.Production.json`, jo git mein na ho):

| Setting | Live value |
|---|---|
| `ConnectionStrings:DefaultConnection` | `...Database=RadiusSoftwareDb;...` |
| `BackgroundJobs:RadiusServer` | `true` |
| `BackgroundJobs:ExpiredSubscribers` | `true` |
| `BackgroundJobs:AutoConfigureNas` | `true` |
| `BackgroundJobs:SmsReminders` | `true` (agar SMS gateway set hai) |
| `JwtSettings:Secret` | **naya lamba random secret** (purana git mein aa chuka hai) |
| `EmailSettings:Password` | email password badal kar naya |
| `RadiusServer:ServerAddress` | server ka public IP (routers isi par RADIUS bhejte hain) |

- `ASPNETCORE_ENVIRONMENT` **Production** hona chahiye (IIS default). Development mode mein RADIUS server start nahi hota.
- UDP **1812 / 1813** (RADIUS) aur **514** (syslog) firewall mein khule hone chahiye.
- Ek server par ek hi API RADIUS chalaye: UAT API par `BackgroundJobs:RadiusServer=false` (ya alag ports).

## 4. Deploy

1. Purani API site stop → naya publish copy → start.
2. Frontend: `RadiusSoftware.Web/.env`
   ```
   VITE_API_ROOT=https://api.bharatradius.com
   ```
   `pnpm install` → `pnpm run build` → `dist` folder live web root par.
3. Naya frontend domain ho to `Program.cs` ke CORS list mein jodiye.
4. Python syslog listener restart (DB naam `appsettings.json` se padhta hai).

## 5. MikroTik routers

- NAS ka **API username/password** sahi ho, user ke group mein `api` policy ho,
  `IP > Services > api` (port 8728) server ke IP ke liye allowed ho.
  Galat hone par panel ab saaf message deta hai: "Login to router ... failed".
- RADIUS secret NAS form aur router mein same.
- Static IP / IPoE users: DHCP server par `use-radius=yes`.
- Hotspot: Hotspot server profile mein `use-radius=yes`.

## 6. Razorpay (wallet Add Money)

1. L1 login → SMS & Payment Gateway → Payment Gateway → **LIVE** Key ID + Secret → **Test**.
2. Razorpay Dashboard → Webhooks → URL `https://api.bharatradius.com/api/WalletTopup/webhook/razorpay`,
   events `payment.captured`, `order.paid`, `payment.failed`; wahi secret "Salt / Webhook secret" mein.
3. Ek chhota payment (₹100) karke wallet aur Razorpay dashboard dono check kariye.

## 7. Go-live ke turant baad check

- [ ] L1 / L2 / L3 login, dashboard numbers
- [ ] RADIUS Auth Log mein **Accept** aa rahe hain (PPPoE users connect ho rahe hain)
- [ ] Dashboard "Online now (RADIUS)" badh raha hai
- [ ] Ek subscriber ka recharge, expiry date sahi
- [ ] Wallet "+ Add" (Razorpay)
- [ ] NAS Statistics / interfaces (router login)
- [ ] Expired user login par "Subscriber Account is Expired" reject

## 8. Rollback (agar zaroorat pade)

1. Nayi API stop, purani API wapas.
2. `pg_restore -U postgres -h localhost -d RadiusSoftwareDb --clean RadiusSoftwareDb-before-golive.backup`
3. Purana frontend wapas.
