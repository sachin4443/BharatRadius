import React from "react";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";

/* ---------- Types & Interfaces ---------- */

interface LogoProps {
  className?: string;
}

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

interface SignInButtonProps {
  variant?: "solid" | "navy" | "outline";
  className?: string;
}

interface CardShellProps {
  title: string;
  mark: React.ReactNode;
  markClass: string;
  body: string;
  children: React.ReactNode;
}

/* ---------- Logo ---------- */

export function BharatRadiusLogo({ className = "h-12 w-auto" }: LogoProps) {
  return (
    <>
      <div className="rounded-md overflow-hidden shadow-sm transition-transform duration-300 hover:scale-105">
        <img src="https://i.pinimg.com/1200x/43/41/59/434159bb9847397686f1722c8dee4e86.jpg" alt="Bharat Radius" className={className} />
      </div>
    </>
  );
}

/* ---------- Icons ---------- */

const iconBase: React.SVGProps<SVGSVGElement> = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const Icon: React.FC<IconProps> = ({ children, className = "h-4 w-4", ...props }) => (
  <svg viewBox="0 0 24 24" className={className} {...iconBase} {...props} aria-hidden="true">
    {children}
  </svg>
);

export const GridIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
  </Icon>
);

export const UsersIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <path d="M16 5.5a3 3 0 0 1 0 5.6M17.5 14.8c2 .7 3.5 2.5 3.5 5.2" />
  </Icon>
);

export const BuildingIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M4 21V6a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15" />
    <path d="M13 10h6a1 1 0 0 1 1 1v10" />
    <path d="M7 9h3M7 13h3M7 17h3M16 14h1M16 18h1M3 21h18" />
  </Icon>
);

export const SettingsIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.6M12 18.6v2.6M4.6 7.5l2.2 1.3M17.2 15.2l2.2 1.3M4.6 16.5l2.2-1.3M17.2 8.8l2.2-1.3" />
  </Icon>
);

export const NetworkIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <rect x="9" y="2.5" width="6" height="5" rx="1.4" />
    <rect x="2.5" y="16.5" width="6" height="5" rx="1.4" />
    <rect x="15.5" y="16.5" width="6" height="5" rx="1.4" />
    <path d="M12 7.5v4.5M5.5 16.5V13h13v3.5" />
  </Icon>
);

export const TagIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M20.2 12.6 12.6 20.2a2 2 0 0 1-2.8 0l-6-6A2 2 0 0 1 3.2 12.8L4 4l8.8-.8a2 2 0 0 1 1.6.6l5.8 5.8a2 2 0 0 1 0 3Z" />
    <circle cx="8.6" cy="8.6" r="1.3" />
  </Icon>
);

export const LockIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <rect x="4" y="10.5" width="16" height="10.5" rx="2.2" />
    <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7M12 15v2.2" />
  </Icon>
);

export const ChartIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M4 20V4M4 20h16" />
    <path d="M8.5 20v-6M13 20V9.5M17.5 20V13" />
  </Icon>
);

export const ShieldIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M12 3 5 5.6v5.7c0 4.2 2.8 7.9 7 9.7 4.2-1.8 7-5.5 7-9.7V5.6Z" />
    <path d="m9.2 12 2 2 3.6-3.8" />
  </Icon>
);

export const KeyIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <circle cx="8" cy="14" r="4" />
    <path d="m11 11 8-8M17 3l3 3-2.4 2.4-3-3" />
  </Icon>
);

export const CheckIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const WalletIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <rect x="3" y="6" width="18" height="13" rx="2.4" />
    <path d="M3 10.5h18M16.5 14.8h2" />
  </Icon>
);

export const MenuIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

/* ---------- Data ---------- */

const NAV = [
  { label: "Dashboard", Icon: GridIcon, active: true },
  { label: "Subscribers", Icon: UsersIcon },
  { label: "Resellers", Icon: BuildingIcon },
  { label: "System Settings", Icon: SettingsIcon },
  { label: "Networking", Icon: NetworkIcon },
  { label: "Packages", Icon: TagIcon },
  { label: "User Permissions", Icon: LockIcon },
  { label: "Reports", Icon: ChartIcon },
];

const STATS = [
  { label: "Total reseller sites", value: "4", note: "Managed nodes", tint: "bg-emerald-50 text-emerald-600", Icon: BuildingIcon },
  { label: "Active sites", value: "4", note: "Inactive 0", tint: "bg-orange-50 text-orange-600", Icon: NetworkIcon },
  { label: "Subscribers", value: "300", note: "Live connections", tint: "bg-blue-50 text-blue-600", Icon: UsersIcon },
  { label: "Bandwidth pool", value: "10 Gbps", note: "Core gateway", tint: "bg-violet-50 text-violet-600", Icon: ChartIcon },
];

const SITE_ROWS = [
  { init: "D1", name: "Demo Site One", company: "Demo Networks Pvt Ltd", phone: "90000 00001" },
  { init: "D2", name: "Demo Site Two", company: "Sample Broadband Co", phone: "90000 00002" },
  { init: "D3", name: "Demo Site Three", company: "Example Internet Services", phone: "90000 00003" },
  { init: "D4", name: "Demo Site Four", company: "Test Fiber Enterprises", phone: "90000 00004" },
];

const DEMO_USERS = [
  { init: "DA", name: "Demo Admin", role: "Admin" },
  { init: "DO", name: "Demo Operator", role: "Operator" },
  { init: "DV", name: "Demo Viewer", role: "Viewer" },
];

const PACKAGES = [
  { name: "Home 100", speed: "100 / 50", price: "₹599" },
  { name: "Home 200", speed: "200 / 100", price: "₹899" },
  { name: "Business 500", speed: "500 / 250", price: "₹2,499" },
];

const PARTNERS = [
  { msr: "MSR #1", name: "Demo Networks Pvt Ltd", level: "Level 1", indent: "ml-0" },
  { msr: "MSR #2", name: "Sample Broadband Co", level: "Level 2", indent: "ml-4" },
  { msr: "MSR #5", name: "Example Internet Services", level: "Level 2", indent: "ml-4" },
  { msr: "MSR #7", name: "Test Fiber Enterprises", level: "Level 2", indent: "ml-4" },
];

const CHECKS = [
  "Data hosted in India",
  "Consent & purpose logging",
  "Encrypted at rest and in transit",
  "Audit trail on every record",
];

const BARS = [38, 52, 44, 61, 55, 72, 64, 80, 71, 88, 76, 94, 84, 100];

const PILLARS = [
  { title: "Scalable & Reliable", body: "Built to grow with your business." },
  { title: "Secure & Trusted", body: "Enterprise-grade security at every layer." },
  { title: "Future Ready", body: "Innovative features for tomorrow's needs." },
  { title: "24/7 Support", body: "Always here when you need us." },
];

/* ---------- Motion helpers ---------- */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } 
  },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const reveal = {
  initial: "hidden" as const,
  whileInView: "show" as const,
  viewport: { once: true, amount: 0.25 },
};

/* ---------- Small building blocks ---------- */

const SignInButton: React.FC<SignInButtonProps> = ({ variant = "solid", className = "" }) => {
  const styles =
    variant === "solid"
      ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-xl shadow-orange-600/30 hover:from-orange-700 hover:to-amber-700"
      : variant === "navy"
      ? "bg-[#10214F] text-white hover:bg-orange-600 shadow-md"
      : "border border-[#10214F]/15 bg-white/85 text-[#10214F] hover:border-[#10214F]";
  return (
    <motion.a
      href="/login"
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className={`inline-flex items-center justify-center rounded-full px-8 py-4 font-medium transition-all ${styles} ${className}`}
    >
      Sign in
    </motion.a>
  );
};

const CardShell: React.FC<CardShellProps> = ({ title, mark, markClass, body, children }) => (
  <motion.article
    variants={fadeUp}
    whileHover={{ y: -5, transition: { duration: 0.2 } }}
    className="flex flex-col rounded-[22px] border border-slate-200/80 bg-white/90 p-3 shadow-sm hover:shadow-xl hover:border-orange-200 transition-all backdrop-blur-md"
  >
    <div className="px-5 pb-4 pt-5">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-[12px] text-white shadow-md ${markClass}`}>
          {mark}
        </span>
        <h3 className="text-lg font-bold tracking-tight text-[#10214F]">{title}</h3>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{body}</p>
    </div>
    <div className="mt-auto rounded-xl border border-slate-100 bg-slate-50/50 p-4">{children}</div>
  </motion.article>
);

/* ---------- Product mock (hero) ---------- */

function DashboardMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 bg-slate-50">
        <span className="h-3 w-3 rounded-full bg-rose-500" />
        <span className="h-3 w-3 rounded-full bg-amber-400" />
        <span className="h-3 w-3 rounded-full bg-emerald-500" />
      </div>

      <div className="grid min-h-[520px] grid-cols-1 bg-slate-50 text-[13px] sm:grid-cols-[216px_minmax(0,1fr)]">
        {/* sidebar */}
        <aside className="hidden flex-col gap-5 border-r border-slate-200/80 bg-white p-3 sm:flex">
          <div className="flex items-center gap-2.5 px-1.5">
            <BharatRadiusLogo className="h-10 w-auto" />
          </div>
          <nav className="grid gap-1">
            {NAV.map(({ label, Icon: I, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[12.5px] transition-colors ${
                  active ? "bg-orange-50 font-semibold text-orange-700 shadow-sm" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <I className="h-4 w-4" />
                <span>{label}</span>
              </div>
            ))}
          </nav>
          <div className="mt-auto flex items-center gap-2 border-t border-slate-100 px-2.5 pt-3 text-[11px] text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            v2.1 · Secure Live UI
          </div>
        </aside>

        {/* main */}
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-3.5 border-b border-slate-200/80 bg-white px-6 py-4">
            <MenuIcon className="h-4 w-4 text-[#10214F]" />
            <div className="text-sm font-bold tracking-tight text-[#10214F]">
              ISP Multi-Tenant Portal
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden items-center gap-2 rounded-full border border-slate-200 px-3.5 py-1.5 text-[12px] text-slate-600 sm:inline-flex bg-slate-50">
                <WalletIcon className="h-3.5 w-3.5 text-orange-600" />
                Wallet <strong className="text-[#10214F]">₹12,480</strong>
              </span>
              <span className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 bg-white">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-orange-100 text-[11px] font-bold text-orange-700">
                  BR
                </span>
                <span className="text-[12px] font-medium">BharatRadius</span>
              </span>
            </div>
          </div>

          <div className="grid min-w-0 gap-6 p-6">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <h4 className="text-[20px] font-bold tracking-tight text-[#10214F]">
                  Client Portal Dashboard
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Reseller branches, site network and subscriber nodes overview.
                </p>
              </div>
              <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1.5 text-[12px] font-semibold text-emerald-700 border border-emerald-100">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                Portal online
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {STATS.map(({ label, value, note, tint, Icon: I }) => (
                <div key={label} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2.5">
                    <span className={`grid h-7 w-7 place-items-center rounded-[8px] ${tint}`}>
                      <I className="h-4 w-4" />
                    </span>
                    <span className="text-[12px] font-medium text-slate-500">{label}</span>
                  </div>
                  <div className="mt-3 text-[28px] font-extrabold tracking-tight text-[#10214F]">
                    {value}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400 font-medium">{note}</div>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5 bg-slate-50/50">
                <span className="text-[13.5px] font-bold text-[#10214F]">Reseller site nodes</span>
                <span className="ml-auto text-[11px] font-medium text-slate-400 bg-white px-2.5 py-1 rounded-md border border-slate-200">4 registered sites</span>
              </div>
              <div className="grid grid-cols-[1.5fr_1.4fr_1fr_0.7fr] border-b border-slate-100 bg-slate-100/60 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.09em] text-slate-500">
                <span>Site &amp; owner</span>
                <span>Company</span>
                <span>Contact</span>
                <span className="text-right">Status</span>
              </div>
              {SITE_ROWS.map((r) => (
                <div
                  key={r.init}
                  className="grid grid-cols-[1.5fr_1.4fr_1fr_0.7fr] items-center border-b border-slate-50 px-5 py-3 text-xs hover:bg-slate-50/80 transition-colors"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-orange-50 text-[11px] font-bold text-orange-600 border border-orange-100">
                      {r.init}
                    </span>
                    <span className="truncate font-semibold text-[#10214F]">{r.name}</span>
                  </span>
                  <span className="truncate text-slate-600 font-medium">{r.company}</span>
                  <span className="text-slate-500">{r.phone}</span>
                  <span className="text-right">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200/60">
                      Active
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page (Fluid Full-Width Container) ---------- */

export default function BharatRadiusLanding() {
  return (
    <div className="w-full min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50 font-sans text-[#10214F] antialiased selection:bg-orange-500 selection:text-white">
      {/* Background Glow Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-[650px] pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[15%] w-[500px] h-[500px] bg-orange-400/15 rounded-full blur-[120px]" />
        <div className="absolute top-[5%] right-[10%] w-[450px] h-[450px] bg-emerald-400/10 rounded-full blur-[120px]" />
        <div className="absolute top-[25%] left-[30%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[140px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200/60 shadow-sm">
        <div className="w-full px-6 sm:px-12 lg:px-20 mx-auto flex items-center justify-between py-4">
          <BharatRadiusLogo className="h-12 w-auto flex-none" />
          <nav className="hidden md:flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-4 py-1.5 text-[14px] shadow-sm backdrop-blur-md">
            {[
              ["Features", "#features"],
              ["Platform", "#platform"],
              ["Why us", "#trust"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-5 py-2 font-medium text-slate-600 transition-all hover:bg-orange-50 hover:text-orange-600"
              >
                {label}
              </a>
            ))}
          </nav>
          <SignInButton variant="navy" className="px-6 py-2.5 text-sm" />
        </div>
      </header>

      {/* Hero Section */}
      <motion.section
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative z-10 w-full px-6 sm:px-12 lg:px-20 pt-20 pb-16 text-center max-w-7xl mx-auto"
      >
        <motion.div
          variants={fadeUp}
          className="inline-flex items-center gap-2.5 rounded-full border border-orange-200 bg-orange-50/80 py-1.5 pl-2 pr-4 text-[13.5px] text-orange-800 shadow-sm backdrop-blur-md"
        >
          <span className="rounded-full bg-orange-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
            All-in-One
          </span>
          Digital Management Platform
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="mt-8 text-balance text-[clamp(42px,6.5vw,76px)] font-black leading-[1.02] tracking-[-0.035em] text-[#10214F]"
        >
          One Platform <br />
          <span className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 bg-clip-text text-transparent">
            Infinite Possibilities
          </span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mx-auto mt-6 max-w-2xl text-pretty text-[18px] sm:text-[20px] leading-relaxed text-slate-600 font-normal"
        >
          Powerful features. Seamless operations. Future ready.
          <br className="hidden sm:inline" />
          For ISPs, Partners &amp; Enterprises.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-10 flex flex-wrap justify-center gap-4">
          <SignInButton />
          <motion.a
            href="#features"
            whileHover={{ y: -3, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-8 py-4 font-semibold text-[#10214F] shadow-sm hover:border-[#10214F] hover:bg-slate-50 transition-all"
          >
            View features
          </motion.a>
        </motion.div>
      </motion.section>

      {/* Product Mock Dashboard Preview */}
      <section id="platform" className="relative z-10 w-full px-4 sm:px-10 lg:px-16 pt-8 pb-20 max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[28px] border border-white/85 bg-white/70 p-3 sm:p-4 shadow-[0_50px_100px_-20px_rgba(16,33,79,0.2)] backdrop-blur-xl"
        >
          <DashboardMock />
        </motion.div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="relative z-10 w-full px-6 sm:px-12 lg:px-20 py-24 max-w-[1400px] mx-auto text-center">
        <motion.div variants={stagger} {...reveal}>
          <motion.span
            variants={fadeUp}
            className="inline-flex rounded-full bg-orange-100 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-orange-700"
          >
            Core Features
          </motion.span>
          <motion.h2
            variants={fadeUp}
            className="mx-auto mt-6 max-w-2xl text-balance text-[clamp(32px,4vw,48px)] font-black leading-[1.08] tracking-[-0.025em] text-[#10214F]"
          >
            Powerful features. <br />
            Seamless operations.
          </motion.h2>
        </motion.div>

        <motion.div
          variants={stagger}
          {...reveal}
          className="mt-16 grid gap-6 text-left sm:grid-cols-2 lg:grid-cols-3"
        >
          <CardShell
            title="User Management"
            mark={<UsersIcon className="h-5 w-5" />}
            markClass="bg-gradient-to-br from-orange-500 to-amber-600"
            body="Create, manage & control users with role-based access and permissions."
          >
            <div className="grid gap-3">
              <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.09em] text-slate-400">
                <span>Subscriber</span>
                <span className="ml-auto">Role</span>
              </div>
              {DEMO_USERS.map((u) => (
                <div key={u.init} className="flex items-center gap-3 border-t border-slate-100 pt-2.5">
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-[8px] bg-slate-100 text-[10.5px] font-bold text-slate-700">
                    {u.init}
                  </span>
                  <span className="truncate text-xs font-semibold text-slate-800">{u.name}</span>
                  <span className="ml-auto flex-none rounded-full bg-orange-50 px-3 py-0.5 text-[10.5px] font-medium text-orange-700 border border-orange-100">
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </CardShell>

          <CardShell
            title="Plan Management"
            mark={<TagIcon className="h-5 w-5" />}
            markClass="bg-gradient-to-br from-amber-600 to-orange-700"
            body="Create, customize & manage plans, packages and offers with ease."
          >
            <div className="grid gap-3">
              <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.09em] text-slate-400">
                <span>Package</span>
                <span className="ml-auto">Speed · Price</span>
              </div>
              {PACKAGES.map((p) => (
                <div key={p.name} className="flex items-center gap-3 border-t border-slate-100 pt-2.5">
                  <span className="h-7 w-7 flex-none rounded-[8px] bg-orange-100 border border-orange-200" />
                  <span className="text-xs font-semibold text-slate-800">{p.name}</span>
                  <span className="ml-auto text-[12px] text-slate-500 font-medium">{p.speed}</span>
                  <span className="text-xs font-bold text-orange-600">{p.price}</span>
                </div>
              ))}
            </div>
          </CardShell>

          <CardShell
            title="Partner Management"
            mark={<BuildingIcon className="h-5 w-5" />}
            markClass="bg-gradient-to-br from-emerald-500 to-teal-700"
            body="Onboard, manage & grow your partner network effortlessly."
          >
            <div className="grid gap-3">
              {PARTNERS.map((p) => (
                <div key={p.msr} className={`flex items-center gap-3 ${p.indent}`}>
                  <span className="flex-none rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                    {p.msr}
                  </span>
                  <span className="truncate text-xs font-semibold text-slate-800">{p.name}</span>
                  <span className="ml-auto flex-none rounded-full bg-emerald-50 px-3 py-0.5 text-[10.5px] font-medium text-emerald-700 border border-emerald-100">
                    {p.level}
                  </span>
                </div>
              ))}
            </div>
          </CardShell>

          <CardShell
            title="Advanced Authentication"
            mark={<KeyIcon className="h-5 w-5" />}
            markClass="bg-gradient-to-br from-purple-600 to-indigo-700"
            body="Secure access with multi-factor authentication and SSO support."
          >
            <div className="grid justify-items-center gap-3.5 py-1">
              <span className="text-[12px] font-medium text-slate-500">Verification code</span>
              <div className="flex gap-2">
                {["4", "1", "7", "2", "", ""].map((d, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.06 * i }}
                    className={`grid h-10 w-8 place-items-center rounded-xl border text-[16px] font-bold shadow-sm ${
                      i === 3 ? "border-purple-600 text-purple-600 bg-purple-50/50" : "border-slate-200 text-[#10214F] bg-white"
                    }`}
                  >
                    {d}
                  </motion.span>
                ))}
              </div>
              <span className="rounded-full bg-emerald-50 px-3.5 py-1 text-[11.5px] font-medium text-emerald-700 border border-emerald-200">
                SSO enabled · Google Workspace
              </span>
            </div>
          </CardShell>

          <CardShell
            title="Network Monitoring"
            mark={<ChartIcon className="h-5 w-5" />}
            markClass="bg-gradient-to-br from-blue-600 to-indigo-800"
            body="Real-time network visibility, alerts, and performance analytics."
          >
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-[18px] font-extrabold text-[#10214F]">6.4 Gbps</span>
                <span className="text-[11px] text-slate-400 font-medium">of 10 Gbps pool</span>
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>
              <div className="mt-4 flex h-16 items-end gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-100">
                {BARS.map((h, i) => (
                  <motion.span
                    key={i}
                    initial={{ height: 0 }}
                    whileInView={{ height: `${h}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.03 * i, ease: "easeOut" }}
                    className={`flex-1 rounded-t-[4px] ${
                      i >= BARS.length - 3 ? "bg-blue-600 shadow-sm" : "bg-blue-200"
                    }`}
                  />
                ))}
              </div>
            </div>
          </CardShell>

          <CardShell
            title="DPDP Compliant"
            mark={<ShieldIcon className="h-5 w-5" />}
            markClass="bg-gradient-to-br from-cyan-600 to-teal-800"
            body="Built with data privacy by design and fully DPDP Act compliant."
          >
            <div className="grid gap-3 py-1">
              {CHECKS.map((c) => (
                <div key={c} className="flex items-center gap-3 text-xs font-medium text-slate-700">
                  <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-cyan-100 text-cyan-800">
                    <CheckIcon className="h-3 w-3" />
                  </span>
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </CardShell>
        </motion.div>
      </section>

      {/* Sovereign Cloud Section */}
      <section id="trust" className="w-full px-6 sm:px-12 lg:px-20 py-16 max-w-[1400px] mx-auto">
        <motion.div
          variants={stagger}
          {...reveal}
          className="relative overflow-hidden rounded-[32px] bg-[#10214F] p-8 sm:p-14 lg:p-16 text-white shadow-2xl"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(60% 80% at 88% 8%, rgba(232,118,15,0.4) 0%, rgba(232,118,15,0) 62%), radial-gradient(55% 70% at 6% 96%, rgba(46,155,63,0.38) 0%, rgba(46,155,63,0) 66%)",
            }}
          />
          <div className="relative text-center max-w-3xl mx-auto">
            <motion.span
              variants={fadeUp}
              className="inline-block rounded-full border border-white/25 bg-white/10 px-5 py-2 text-xs font-bold uppercase tracking-[0.1em] text-orange-200 backdrop-blur-md"
            >
              Sovereign Cloud
            </motion.span>
            <motion.h2
              variants={fadeUp}
              className="mx-auto mt-6 text-balance text-[clamp(28px,4vw,46px)] font-black leading-[1.08] tracking-[-0.025em] text-white"
            >
              Hosted on Indian infrastructure for complete data sovereignty.
            </motion.h2>
          </div>
          <motion.div
            variants={stagger}
            className="relative mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {PILLARS.map((p) => (
              <motion.div
                key={p.title}
                variants={fadeUp}
                whileHover={{ y: -5 }}
                className="rounded-2xl border items-center flex flex-col border-white/15 bg-white/[0.07] p-6 backdrop-blur-md transition-all hover:bg-white/[0.12] hover:border-orange-400/50"
              >
                <h3 className="text-[18px] font-bold text-orange-300">{p.title}</h3>
                <p className="mt-3 text-pretty text-[14.5px] leading-relaxed text-center text-indigo-100/90 font-medium">
                  {p.body}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Closing CTA */}
      <motion.section
        variants={stagger}
        {...reveal}
        className="w-full px-6 sm:px-12 lg:px-20 py-24 text-center max-w-4xl mx-auto"
      >
        <motion.h2
          variants={fadeUp}
          className="text-balance text-[clamp(34px,5vw,60px)] font-black leading-[1.04] tracking-[-0.03em] text-[#10214F]"
        >
          One Platform <br />
          <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            Infinite Possibilities
          </span>
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mx-auto mt-5 max-w-xl text-[18px] leading-relaxed text-slate-600 font-medium"
        >
          All-in-One Digital Management Platform for ISPs, Partners &amp; Enterprises
        </motion.p>
        <motion.div variants={fadeUp} className="mt-10">
          <SignInButton className="px-10 py-4 text-base shadow-xl" />
        </motion.div>
      </motion.section>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white/50 backdrop-blur-md">
        <div className="w-full px-6 sm:px-12 lg:px-20 mx-auto flex max-w-[1400px] flex-wrap items-center justify-between py-10 gap-6">
          <BharatRadiusLogo className="h-12 w-auto" />
          <p className="text-[14.5px] text-slate-500 font-medium">
            Empowering next-gen high-speed infrastructure.
          </p>
          <span className="text-[13.5px] font-bold text-slate-400">A product of DIV Pvt. Ltd.</span>
        </div>
      </footer>
    </div>
  );
}