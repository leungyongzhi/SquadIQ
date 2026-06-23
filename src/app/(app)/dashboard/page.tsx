"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useViewMode } from "@/app/(app)/layout";
import { Copy07, CheckCircle, Link01, Users01, BarChart01, Calendar } from "@untitledui/icons";

export default function DashboardPage() {
    const router = useRouter();
    const { isAdmin, isSuperAdmin } = useViewMode();
    const [view, setView] = useState<"player" | "admin">("player");
    const [linkedPlayerId, setLinkedPlayerId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [linkingCode, setLinkingCode] = useState<string | null>(null);
    const [showCopy07Success, setShowCopy07Success] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        const checkPlayerLink = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/login");
                return;
            }

            const { data: profile } = await supabase
                .from("user_profiles")
                .select("player_id")
                .eq("id", user.id)
                .single();

            setLinkedPlayerId(profile?.player_id ?? null);
            setLoading(false);
        };
        checkPlayerLink();
    }, []);

    const generateLinkingCode = () => {
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        setLinkingCode(code);
    };

    const copyLinkingCode = () => {
        if (linkingCode) {
            navigator.clipboard.writeText(linkingCode);
            setShowCopy07Success(true);
            setTimeout(() => setShowCopy07Success(false), 2000);
        }
    };

    const navigateTo = (path: string) => {
        router.push(path);
    };

    const showAdminView = (isAdmin || isSuperAdmin) && view === "admin";

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-primary">SquadIQ</h1>
                    <p className="text-sm text-tertiary mt-1">Football Match Management</p>
                </div>

                {/* View Toggle */}
                {(isAdmin || isSuperAdmin) && (
                    <div className="flex items-center gap-2 bg-secondary rounded-lg p-1">
                        <button
                            onClick={() => setView("player")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition duration-100 ease-linear ${
                                view === "player"
                                    ? "bg-primary text-primary shadow-sm"
                                    : "text-tertiary hover:text-secondary"
                            }`}
                        >
                            Player View
                        </button>
                        <button
                            onClick={() => setView("admin")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition duration-100 ease-linear ${
                                view === "admin"
                                    ? "bg-primary text-primary shadow-sm"
                                    : "text-tertiary hover:text-secondary"
                            }`}
                        >
                            Admin View
                        </button>
                    </div>
                )}
            </div>

            {/* Account Linking Section */}
            {!linkedPlayerId && !showAdminView && (
                <div className="bg-primary rounded-2xl border border-secondary p-6">
                    <div className="flex items-start gap-4">
                        <div className="size-12 rounded-lg bg-brand-secondary flex items-center justify-center flex-shrink-0">
                            <Link01 className="size-6 text-brand-primary" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-semibold text-primary mb-1">Link Your Player Account</h2>
                            <p className="text-sm text-tertiary mb-4">
                                To get started, you need to link your user account to a player profile. Ask your admin for a linking code.
                            </p>
                            <input
                                type="text"
                                placeholder="Enter linking code from admin"
                                className="w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear"
                            />
                            <button className="mt-3 px-4 py-2 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear">
                                Link Account
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin Linking Section */}
            {showAdminView && (
                <div className="bg-primary rounded-2xl border border-secondary p-6">
                    <h2 className="text-lg font-semibold text-primary mb-4">Player Account Linking</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">Generate Linking Code</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={generateLinkingCode}
                                    className="px-4 py-2 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear"
                                >
                                    Generate Code
                                </button>
                                {linkingCode && (
                                    <div className="flex-1 flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={linkingCode}
                                            readOnly
                                            className="flex-1 px-3.5 py-2.5 rounded-lg border border-primary bg-secondary text-primary text-sm font-mono focus:outline-none"
                                        />
                                        <button
                                            onClick={copyLinkingCode}
                                            className="px-3 py-2 bg-secondary hover:bg-secondary_hover text-primary rounded-lg transition duration-100 ease-linear"
                                        >
                                            {showCopy07Success ? (
                                                <CheckCircle className="size-5 text-success-primary" />
                                            ) : (
                                                <Copy07 className="size-5" />
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                            {linkingCode && (
                                <p className="text-xs text-tertiary mt-2">Share this code with players to link their account</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">Manually Link Player</label>
                            <button
                                onClick={() => router.push("/players")}
                                className="px-4 py-2 bg-secondary hover:bg-secondary_hover text-primary text-sm font-semibold rounded-lg transition duration-100 ease-linear"
                            >
                                Go to Players List
                            </button>
                            <p className="text-xs text-tertiary mt-2">Select a player and link them to a user account</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <QuickActionCard
                    icon={Calendar}
                    title="Match Days"
                    description="View and manage upcoming matches"
                    onClick={() => navigateTo("/events")}
                />
                <QuickActionCard
                    icon={Users01}
                    title="Players"
                    description="Browse player profiles and stats"
                    onClick={() => navigateTo("/players")}
                />
                <QuickActionCard
                    icon={BarChart01}
                    title="Statistics"
                    description="View league stats and rankings"
                    onClick={() => navigateTo("/stats")}
                />
                {(isAdmin || isSuperAdmin) && (
                    <QuickActionCard
                        icon={Users01}
                        title="Communities"
                        description="Manage your communities"
                        onClick={() => navigateTo("/communities")}
                    />
                )}
            </div>

            {/* Info Section */}
            {!linkedPlayerId && !showAdminView && (
                <div className="bg-secondary rounded-2xl border border-tertiary p-6">
                    <h3 className="text-base font-semibold text-primary mb-3">Getting Started</h3>
                    <ul className="space-y-2 text-sm text-tertiary">
                        <li className="flex gap-2">
                            <span className="text-brand-primary">•</span>
                            <span>Contact your admin to get a linking code</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-brand-primary">•</span>
                            <span>Enter the code above to link your account</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-brand-primary">•</span>
                            <span>Start tracking your matches and stats</span>
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
}

function QuickActionCard({
    icon: Icon,
    title,
    description,
    onClick,
}: {
    icon: React.FC<any>;
    title: string;
    description: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="bg-primary rounded-xl border border-secondary p-4 text-left hover:border-brand transition duration-100 ease-linear"
        >
            <div className="flex items-start gap-3">
                <div className="size-10 rounded-lg bg-brand-secondary flex items-center justify-center flex-shrink-0">
                    <Icon className="size-5 text-brand-primary" />
                </div>
                <div>
                    <p className="font-semibold text-primary">{title}</p>
                    <p className="text-sm text-tertiary">{description}</p>
                </div>
            </div>
        </button>
    );
}
