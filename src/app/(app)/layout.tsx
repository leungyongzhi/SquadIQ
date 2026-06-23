"use client";

import { useEffect, useState, createContext, useContext } from "react";
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
    Shield01,
    Eye,
    EyeOff,
    PieChart01,
} from "@untitledui/icons";
import { cx } from "@/utils/cx";

// Context so any page can read the current view mode
export const ViewModeContext = createContext<{
    isAdmin: boolean;
    isSuperAdmin: boolean;
    // community IDs where this user is admin (empty = not an admin anywhere)
    adminCommunityIds: string[];
}>({
    isAdmin: false,
    isSuperAdmin: false,
    adminCommunityIds: [],
});
export const useViewMode = () => useContext(ViewModeContext);

const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutGrid01, exact: true },
    { href: "/communities", label: "Communities", icon: Shield01 },
    { href: "/players", label: "Players", icon: Users01 },
    { href: "/events", label: "Match Days", icon: Calendar },
    { href: "/stats", label: "Stats", icon: BarChart01 },
];

const adminNavItems = [
    { href: "/reports", label: "Reports", icon: PieChart01 },
    { href: "/linking-requests", label: "Linking Requests", icon: Users01 },
];

export default function FootballLayout({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminCommunityIds, setAdminCommunityIds] = useState<string[]>([]);
    const [previewAsPlayer, setPreviewAsPlayer] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createClient();

    useEffect(() => {
        if (pathname === "/login") return;
        supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (!user) { router.push("/login"); return; }
            setUser(user);

            const { data: profile } = await supabase
                .from("user_profiles")
                .select("role, player_id")
                .eq("id", user.id)
                .single();

            const role = profile?.role;
            const superAdmin = role === "super_admin";
            const admin = role === "admin" || superAdmin;
            setIsSuperAdmin(superAdmin);
            setIsAdmin(admin);

            // Fetch which communities this user admins
            if (profile?.player_id && !superAdmin) {
                const { data: memberships } = await supabase
                    .from("community_members")
                    .select("community_id")
                    .eq("player_id", profile.player_id)
                    .eq("role", "admin");
                setAdminCommunityIds((memberships ?? []).map((m) => m.community_id));
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
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

    // Effective admin state: super_admin can toggle to player preview
    const effectiveAdmin = isAdmin && !(isSuperAdmin && previewAsPlayer);
    const displayRole = isSuperAdmin
        ? previewAsPlayer ? "Previewing as Player" : "Super Admin"
        : isAdmin ? "Admin" : "Player";

    return (
        <ViewModeContext.Provider value={{
            isAdmin: effectiveAdmin,
            isSuperAdmin: isSuperAdmin && !previewAsPlayer,
            adminCommunityIds: previewAsPlayer ? [] : adminCommunityIds,
        }}>
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
                            <p className="text-xs text-tertiary">{displayRole}</p>
                        </div>
                    </div>

                    {/* Nav */}
                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                        {navItems.map(({ href, label, icon: Icon, exact }) => (
                            <Link
                                key={href}
                                href={href}
                                onClick={() => setMobileOpen(false)}
                                className={cx(
                                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition duration-100 ease-linear",
                                    isActive(href, exact ?? false)
                                        ? "bg-brand-primary_alt text-brand-primary"
                                        : "text-tertiary hover:text-primary hover:bg-primary_hover",
                                )}
                            >
                                <Icon className={cx("size-5", isActive(href, exact ?? false) ? "text-brand-primary" : "text-quaternary")} />
                                {label}
                            </Link>
                        ))}
                        {isAdmin && (
                            <>
                                <div className="pt-3 pb-1 px-3">
                                    <p className="text-xs font-semibold text-quaternary uppercase tracking-wider">Admin</p>
                                </div>
                                {adminNavItems.map(({ href, label, icon: Icon }) => (
                                    <Link
                                        key={href}
                                        href={href}
                                        onClick={() => setMobileOpen(false)}
                                        className={cx(
                                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition duration-100 ease-linear",
                                            isActive(href, false)
                                                ? "bg-brand-primary_alt text-brand-primary"
                                                : "text-tertiary hover:text-primary hover:bg-primary_hover",
                                        )}
                                    >
                                        <Icon className={cx("size-5", isActive(href, false) ? "text-brand-primary" : "text-quaternary")} />
                                        {label}
                                    </Link>
                                ))}
                            </>
                        )}
                    </nav>

                    {/* Super admin preview toggle */}
                    {isSuperAdmin && (
                        <div className="px-4 pb-2">
                            <button
                                onClick={() => setPreviewAsPlayer((v) => !v)}
                                className={cx(
                                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium border transition duration-100 ease-linear",
                                    previewAsPlayer
                                        ? "bg-warning-primary border-warning text-warning-primary"
                                        : "border-secondary text-tertiary hover:bg-primary_hover hover:text-secondary"
                                )}
                            >
                                {previewAsPlayer
                                    ? <><EyeOff className="size-4" /> Exit Player Preview</>
                                    : <><Eye className="size-4" /> Preview as Player</>
                                }
                            </button>
                        </div>
                    )}

                    {/* User footer */}
                    <div className="p-4 border-t border-secondary">
                        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
                            <div className="size-8 rounded-full bg-brand-secondary flex items-center justify-center text-xs font-semibold text-brand-primary">
                                {user?.email?.[0]?.toUpperCase() ?? "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-primary truncate">{user?.email}</p>
                                <p className="text-xs text-tertiary">{displayRole}</p>
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

                    {/* Player preview banner */}
                    {previewAsPlayer && (
                        <div className="bg-warning-primary border-b border-warning px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Eye className="size-4 text-warning-primary" />
                                <span className="text-sm font-medium text-warning-primary">Player preview mode — admin controls hidden</span>
                            </div>
                            <button
                                onClick={() => setPreviewAsPlayer(false)}
                                className="text-xs font-semibold text-warning-primary hover:underline transition duration-100 ease-linear"
                            >
                                Exit
                            </button>
                        </div>
                    )}

                    <main className="flex-1 overflow-y-auto p-4 lg:p-8">
                        {children}
                    </main>
                </div>
            </div>
        </ViewModeContext.Provider>
    );
}
