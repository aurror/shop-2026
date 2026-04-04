"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";
import { useCart } from "@/components/shop/CartContext";

interface HeaderProps {
  userName: string | null;
  isLoggedIn: boolean;
}

export function Header({ userName, isLoggedIn }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { cartCount } = useCart();
  const userMenuRef = useRef<HTMLDivElement>(null);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery.trim()) {
        router.push(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
        setSearchOpen(false);
        setSearchQuery("");
        setMobileMenuOpen(false);
      }
    },
    [searchQuery, router]
  );

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [userMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: "/products", label: "Produkte" },
    { href: "/custom-print", label: "Maßanfertigung" },
    { href: "/team", label: "Team" },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-black transition-opacity hover:opacity-70"
          >
            3DPrintIt
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? "text-black"
                    : "text-neutral-500 hover:text-black"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right: Search, Cart, Account */}
        <div className="flex items-center gap-2">
          {/* Search - Desktop */}
          <div className="hidden md:block">
            {searchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Suchen..."
                  className="h-8 w-48 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-black placeholder-neutral-400 outline-none transition-all focus:w-64 focus:border-neutral-400 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery("");
                  }}
                  className="ml-1 rounded-lg p-1.5 text-neutral-400 transition-colors hover:text-black"
                  aria-label="Suche schließen"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-black"
                aria-label="Suche öffnen"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </button>
            )}
          </div>

          {/* Cart */}
          <Link
            href="/cart"
            className="relative rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-black"
            aria-label={`Warenkorb (${cartCount} Artikel)`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-medium text-white">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>

          {/* Account / Login */}
          {isLoggedIn ? (
            <div ref={userMenuRef} className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-1.5 rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-black"
                aria-label="Benutzermenu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                {userName && (
                  <span className="max-w-24 truncate text-xs font-medium">
                    {userName}
                  </span>
                )}
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-1 w-48 rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
                  <Link
                    href="/account"
                    className="block px-4 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Mein Konto
                  </Link>
                  <Link
                    href="/account/orders"
                    className="block px-4 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Bestellungen
                  </Link>
                  <div className="my-1 border-t border-neutral-100" />
                  <Link
                    href="/api/auth/signout"
                    className="block px-4 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Abmelden
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="hidden rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-black md:block"
              aria-label="Anmelden"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </Link>
          )}

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-black md:hidden"
            aria-label={mobileMenuOpen ? "Menü schließen" : "Menü öffnen"}
          >
            {mobileMenuOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t border-neutral-100 bg-white md:hidden">
          <div className="space-y-1 px-4 py-3">
            {/* Mobile search */}
            <form onSubmit={handleSearch} className="mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Suchen..."
                className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-black placeholder-neutral-400 outline-none focus:border-neutral-400 focus:bg-white"
              />
            </form>

            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? "bg-neutral-100 text-black"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-black"
                }`}
              >
                {link.label}
              </Link>
            ))}

            <div className="my-2 border-t border-neutral-100" />

            {isLoggedIn ? (
              <>
                <Link
                  href="/account"
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-black"
                >
                  Mein Konto
                </Link>
                <Link
                  href="/api/auth/signout"
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-black"
                >
                  Abmelden
                </Link>
              </>
            ) : (
              <Link
                href="/auth/login"
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-black"
              >
                Anmelden
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
