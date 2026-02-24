"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store, ShoppingBag, Coins, ShieldAlert, User, RefreshCw, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectButton, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { PACKAGE_ID, MODULE_NAMES } from "@/lib/sui-constants";
import { useState, useEffect, useCallback } from "react";

const NAV_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Nunito:wght@600;700;800&display=swap');

  .gyate-nav {
    position: fixed;
    top: 0; left: 0; width: 100%;
    z-index: 50;
    font-family: 'Nunito', sans-serif;
    background: rgba(250,250,250,0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 2px solid rgba(26,26,26,0.08);
    transition: box-shadow 0.3s ease;
  }
  .gyate-nav.scrolled {
    box-shadow: 0 2px 20px rgba(0,0,0,0.08);
  }

  .nav-progress {
    position: absolute;
    top: 0; left: 0; height: 3px;
    background: linear-gradient(90deg, #c9b8ff, #ff3d9a, #fff5b8);
    width: 0%;
    transition: width 0.1s ease-out;
    z-index: 10;
  }

  .gyate-nav-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 24px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  /* ── Logo ── */
  .nav-logo {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    flex-shrink: 0;
  }
  .nav-logo-icon {
    position: relative;
    width: 38px; height: 38px;
    border-radius: 12px;
    border: 2px solid #1a1a1a;
    background: linear-gradient(145deg, #fffde8, #fff5b8);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 3px 3px 0px #c9b8ff;
    transition: transform 0.2s cubic-bezier(0.175,0.885,0.32,1.275);
    overflow: hidden;
  }
  .nav-logo:hover .nav-logo-icon { transform: rotate(-6deg) scale(1.08); }
  .nav-logo-star {
    position: absolute; top: -2px; right: -2px;
    font-size: 10px;
    animation: starPop 2s ease-in-out infinite;
  }
  @keyframes starPop { 0%,100%{transform:scale(1) rotate(0)} 50%{transform:scale(1.3) rotate(15deg)} }
  .nav-logo-text {
    font-family: 'Caveat', cursive;
    font-size: 22px;
    font-weight: 700;
    color: #1a1a1a;
    letter-spacing: -0.5px;
  }

  /* ── Nav links ── */
  .nav-links {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 1;
    justify-content: center;
  }
  .nav-link {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
    color: #64748b;
    text-decoration: none;
    transition: all 0.2s ease;
    white-space: nowrap;
  }
  .nav-link:hover { color: #1a1a1a; background: rgba(201,184,255,0.15); }
  .nav-link.active {
    color: #1a1a1a;
    background: linear-gradient(135deg, rgba(201,184,255,0.3), rgba(255,184,217,0.2));
    border: 1.5px solid rgba(201,184,255,0.5);
    box-shadow: 2px 2px 0px rgba(201,184,255,0.4);
  }
  .nav-link.admin { color: #c4006e; }
  .nav-link.admin:hover { background: rgba(255,184,217,0.2); color: #a00057; }
  .nav-link.admin.active {
    background: rgba(255,184,217,0.3);
    border-color: rgba(255,61,154,0.4);
    box-shadow: 2px 2px 0px rgba(255,61,154,0.3);
  }

  /* ── Right section ── */
  .nav-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  /* ── GYATE balance pill — light, matches connect button family ── */
  .gyate-balance-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    border-radius: 15px 255px 15px 225px / 225px 15px 255px 15px;
    background: linear-gradient(135deg, #f3e8ff, #fce7f3);
    border: 2px solid #1a1a1a;
    box-shadow: 3px 3px 0px #ffb8d9;
    font-family: 'Nunito', sans-serif;
    transition: all 0.2s cubic-bezier(0.175,0.885,0.32,1.275);
    cursor: default;
  }
  .gyate-balance-pill:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 5px 5px 0px #ffb8d9;
    background: linear-gradient(135deg, #e9d5ff, #fce7f3);
  }
  .gyate-balance-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #c026d3;
    box-shadow: 0 0 5px rgba(192,38,211,0.5);
    animation: balancePulse 2s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes balancePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.75)} }
  .gyate-balance-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
  }
  .gyate-balance-amount {
    font-size: 13px;
    font-weight: 800;
    color: #7e22ce;
    line-height: 1;
  }
  .gyate-balance-label {
    font-size: 8px;
    font-weight: 900;
    color: #c084fc;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    line-height: 1;
  }

  /* ── Connect button — doodle border, same family as balance pill ── */
  .gyate-connect-wrap button,
  .gyate-connect-wrap [data-testid],
  .gyate-connect-wrap [role="button"] {
    background: linear-gradient(135deg, #f3e8ff, #fce7f3) !important;
    color: #1a1a1a !important;
    border: 2px solid #1a1a1a !important;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px !important;
    font-family: 'Nunito', sans-serif !important;
    font-weight: 800 !important;
    font-size: 13px !important;
    padding: 9px 18px !important;
    box-shadow: 3px 3px 0px #c9b8ff !important;
    transition: all 0.2s cubic-bezier(0.175,0.885,0.32,1.275) !important;
    white-space: nowrap !important;
    cursor: pointer !important;
    line-height: 1.2 !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
  }
  .gyate-connect-wrap button:hover,
  .gyate-connect-wrap [data-testid]:hover,
  .gyate-connect-wrap [role="button"]:hover {
    transform: scale(1.02) translateY(-2px) !important;
    box-shadow: 5px 5px 0px #c9b8ff !important;
    background: linear-gradient(135deg, #e9d5ff, #fce7f3) !important;
  }
  .gyate-connect-wrap button:active,
  .gyate-connect-wrap [data-testid]:active,
  .gyate-connect-wrap [role="button"]:active {
    transform: translateY(1px) !important;
    box-shadow: 1px 1px 0px #c9b8ff !important;
  }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .nav-link-label { display: none; }
    .nav-logo-text { display: none; }
    .nav-links { gap: 0; }
    .nav-link { padding: 8px 10px; }
    .gyate-balance-text { display: none; }
    .gyate-balance-pill { padding: 8px 10px; }
  }
`;

export function Navigation() {
  const pathname = usePathname();
  const account = useCurrentAccount();
  const suiClient = useSuiClient();

  const [gyateBalance, setGyateBalance] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const winScroll = document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      setScrollPct(height > 0 ? (winScroll / height) * 100 : 0);
      setScrolled(winScroll > 50);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const fetchGyateBalance = useCallback(async () => {
    if (!account) { setGyateBalance(null); return; }
    setIsFetching(true);
    try {
      const gyateType = `${PACKAGE_ID}::${MODULE_NAMES.GYATE_COIN}::GYATE_COIN`;
      const balance = await suiClient.getBalance({ owner: account.address, coinType: gyateType });
      setGyateBalance(Number(BigInt(balance.totalBalance)).toLocaleString());
    } catch {
      setGyateBalance("0");
    } finally {
      setIsFetching(false);
    }
  }, [account, suiClient]);

  useEffect(() => {
    fetchGyateBalance();
    const interval = setInterval(fetchGyateBalance, 10000);
    return () => clearInterval(interval);
  }, [fetchGyateBalance]);

  const isAdmin = account?.address === "0x262da71b77b62fe106c8a0b7ffa6e3ad6bb2898ffda5db074107bf0bf5e6aa7a";

  const navItems = [
    { href: "/",            label: "Home",      icon: LayoutDashboard },
    { href: "/shop",        label: "Shop",      icon: Store           },
    { href: "/inventory",   label: "Inventory", icon: ShoppingBag     },
    { href: "/marketplace", label: "Market",    icon: Coins           },
    { href: "/profile",     label: "Account",   icon: User            },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: NAV_STYLES }} />

      <nav className={cn("gyate-nav", scrolled && "scrolled")}>
        <div className="nav-progress" style={{ width: `${scrollPct}%` }} />

        <div className="gyate-nav-inner">

          {/* Logo */}
          <Link href="/" className="nav-logo">
            <div className="nav-logo-icon">
              <span style={{ fontSize: 18 }}>📦</span>
              <span className="nav-logo-star">✦</span>
            </div>
            <span className="nav-logo-text">GyateGyate</span>
          </Link>

          {/* Nav Links */}
          <div className="nav-links">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn("nav-link", pathname === href && "active")}
              >
                <Icon size={15} />
                <span className="nav-link-label">{label}</span>
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className={cn("nav-link admin", pathname === "/admin" && "active")}
              >
                <ShieldAlert size={15} />
                <span className="nav-link-label">Admin</span>
              </Link>
            )}
          </div>

          {/* Right */}
          <div className="nav-right">

            {/* $GYATE pill — only when wallet is connected */}
            {account && (
              <div className="gyate-balance-pill hidden lg:flex items-center">
                {isFetching && !gyateBalance ? (
                  <RefreshCw size={13} className="animate-spin" style={{ color: "#c026d3" }} />
                ) : (
                  <>
                    <div className="gyate-balance-dot" />
                    <div className="gyate-balance-text" style={{ marginLeft: 8 }}>
                      <span className="gyate-balance-amount">{gyateBalance ?? "0"}</span>
                      <span className="gyate-balance-label">$GYATE</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Connect button */}
            <div className="gyate-connect-wrap">
              <ConnectButton />
            </div>

          </div>
        </div>
      </nav>

      <div style={{ height: 72 }} />
    </>
  );
}