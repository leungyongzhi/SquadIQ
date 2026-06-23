"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
    LayoutGrid01,
    Users01,
    Calendar,
    BarChart01,
    LogOut01,
    Trophy01,
    Menu01,
    X,
} from "@untitledui/icons";
import { cx } from "@/utils/cx";

const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutGrid01, exact: true },
    { href: "/players", label: "Players", icon: Users01 },
    { href: "/events", label: "Match Days", icon: Calendar },
    { href: "/stats", label: "Stats", icon: BarChart01 },
];

export default function FootballLayout({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createClient();

    useEffect(() => {
        if (pathname === "/login") return;
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) {
                router.push("/login");
                return;
            }
            setUser(user);
            supabase
                .from("user_profiles")
                .select("role")
                .eq("id", user.id)
                .single()
                .then(({ data }) => {
                    setIsAdmin(data?.role === "admin");
                });
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_OUT") router.push("/login");
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    if (pathname === "/login") return <>{children}</>;

    const isActive = (href: string, exact: boolean) =>
        exact ? pathname === href : pathname.startsWith(href);

    return (
        <div className="flex h-screen bg-secondary overflow-hidden">
            {/* Sidebar */}
            <aside
                className={cx(
                    "fixed inset-y-0 left-0 z-50 w-64 bg-primary border-r border-secondary flex flex-col transition-transform duration-200",
                    mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
                )}
            >
                {/* Logo */}
                <div className="flex items-center gap-3 p-6 border-b border-secondary">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-success-solid">
                        <Trophy01 className="size-5 text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-primary">Football</p>
                        <p className="text-xs text-tertiary">{isAdmin ? "Admin" : "Player"}</p>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map(({ href, label, icon: Icon, exact }) => (
                        <Link
                            key={href}
                            href={href}
                            onClick={() => setMobileOpen(false)}
                            className={cx(
                                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition duration-100 ease-linear",
                                isActive(href, exact ?? false)
                                    ? "bg-brand-primary_alt text-brand-primary fg-brand-primary"
                                    : "text-tertiary hover:text-primary hover:bg-primary_hover",
                            )}
                        >
                            <Icon className={cx("size-5", isActive(href, exact ?? false) ? "text-brand-primary" : "text-quaternary")} />
                            {label}
                        </Link>
                    ))}
                </nav>

                {/* User footer */}
                <div className="p-4 border-t border-secondary">
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
                        <div className="size-8 rounded-full bg-brand-secondary flex items-center justify-center text-xs font-semibold text-brand-primary">
                            {user?.email?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-primary truncate">{user?.email}</p>
                            <p className="text-xs text-tertiary capitalize">{isAdmin ? "Admin" : "Player"}</p>
                        </div>
                        <button
                            onClick={handleSignOut}
                            className="text-quaternary hover:text-secondary transition duration-100 ease-linear"
                        >
                            <LogOut01 className="size-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-overlay lg:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Main content */}
            <div className="flex-1 flex flex-col lg:ml-64 overflow-hidden">
                {/* Mobile top bar */}
                <header className="lg:hidden flex items-center gap-3 p-4 bg-primary border-b border-secondary">
                    <button onClick={() => setMobileOpen(true)} className="text-secondary">
                        <Menu01 className="size-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <Trophy01 className="size-4 text-success-primary" />
                        <span className="text-sm font-semibold text-primary">Football</span>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
