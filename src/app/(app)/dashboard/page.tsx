"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useViewMode } from "@/app/(app)/layout";
import { Copy07, CheckCircle, Link01, Trophy01, Zap, TrendingUp } from "@untitledui/icons";

interface PlayerStats {
    goals: number;
    assists: number;
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    potm: number;
}

export default function DashboardPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isAdmin, isSuperAdmin } = useViewMode();
    const [view, setView] = useState<"player" | "admin">("player");
    const [linkedPlayerId, setLinkedPlayerId] = useState<string | null>(null);
    const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
    const [playerName, setPlayerName] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [linkingCode, setLinkingCode] = useState<string | null>(null);
    const [showCopySuccess, setShowCopySuccess] = useState(false);
    const [accountLinked, setAccountLinked] = useState(false);
    const supabase = createClient();

    // Check if user is accessing via linking URL
    const linkToken = searchParams.get("link");

    useEffect(() => {
        const initDashboard = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/login");
                return;
            }

            // If link token provided, handle account linking
            if (linkToken) {
                // In a real app, verify the token and link the player
                // For now, this is a placeholder for the linking flow
                setAccountLinked(true);
            }

            // Get user profile and linked player
            const { data: profile } = await supabase
                .from("user_profiles")
                .select("player_id, full_name")
                .eq("id", user.id)
                .single();

            if (profile?.player_id) {
                setLinkedPlayerId(profile.player_id);
                setPlayerName(profile.full_name || "Player");
                await loadPlayerStats(profile.player_id);
            }

            setLoading(false);
        };
        initDashboard();
    }, [linkToken]);

    const loadPlayerStats = async (playerId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get all goals scored by this player
        const { data: goalsData } = await supabase
            .from("goals")
            .select("id, event_id")
            .eq("scorer_id", playerId);

        // Get all assists by this player
        const { data: assistsData } = await supabase
            .from("goals")
            .select("id")
            .eq("assister_id", playerId);

        // Get match events where player participated
        const { data: allEvents } = await supabase
            .from("match_events")
            .select("id, team_blue_ids, team_orange_ids, score_blue, score_orange, status")
            .eq("status", "completed");

        let matches = 0;
        let wins = 0;
        let draws = 0;
        let losses = 0;

        allEvents?.forEach((event) => {
            const isBlue = event.team_blue_ids?.includes(playerId);
            const isOrange = event.team_orange_ids?.includes(playerId);

            if (isBlue || isOrange) {
                matches++;
                const blueWin = event.score_blue > event.score_orange;
                const orangeWin = event.score_orange > event.score_blue;
                const isDraw = event.score_blue === event.score_orange;

                if (isBlue && blueWin) wins++;
                else if (isOrange && orangeWin) wins++;
                else if (isDraw) draws++;
                else losses++;
            }
        });

        setPlayerStats({
            goals: goalsData?.length ?? 0,
            assists: assistsData?.length ?? 0,
            matches,
            wins,
            draws,
            losses,
            potm: 0, // Would need to query POTM votes separately
        });
    };

    const generateLinkingCode = () => {
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        setLinkingCode(code);
    };

    const copyLinkingCode = () => {
        if (linkingCode) {
            const linkUrl = `${window.location.origin}/dashboard?link=${linkingCode}`;
            navigator.clipboard.writeText(linkUrl);
            setShowCopySuccess(true);
            setTimeout(() => setShowCopySuccess(false), 2000);
        }
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
            {/* Header with View Toggle */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-primary">
                        Welcome back, {playerName}!
                    </h1>
                    <p className="text-sm text-tertiary mt-1">Your football stats and activity</p>
                </div>

                {/* View Toggle for Admins */}
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

            {/* Player View */}
            {!showAdminView && (
                <>
                    {/* Account Linking Section */}
                    {!linkedPlayerId && (
                        <div className="bg-primary rounded-2xl border border-secondary p-6">
                            <div className="flex items-start gap-4">
                                <div className="size-12 rounded-lg bg-brand-secondary flex items-center justify-center flex-shrink-0">
                                    <Link01 className="size-6 text-brand-primary" />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-lg font-semibold text-primary mb-1">Link Your Player Account</h2>
                                    <p className="text-sm text-tertiary mb-4">
                                        Ask your admin for a linking URL to connect your account to a player profile.
                                    </p>
                                    <p className="text-xs text-quaternary">
                                        Once linked, you'll see your stats, match history, and team information here.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Player Stats Section */}
                    {linkedPlayerId && playerStats && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <StatCard
                                icon={Trophy01}
                                label="Goals"
                                value={playerStats.goals}
                                color="brand"
                            />
                            <StatCard
                                icon={Zap}
                                label="Assists"
                                value={playerStats.assists}
                                color="success"
                            />
                            <StatCard
                                icon={TrendingUp}
                                label="Matches Played"
                                value={playerStats.matches}
                                color="warning"
                            />
                        </div>
                    )}

                    {/* Win/Loss Record */}
                    {linkedPlayerId && playerStats && (
                        <div className="bg-primary rounded-2xl border border-secondary p-6">
                            <h3 className="text-base font-semibold text-primary mb-4">Match Record</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-success-primary">{playerStats.wins}</p>
                                    <p className="text-xs text-tertiary mt-1">Wins</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-warning-primary">{playerStats.draws}</p>
                                    <p className="text-xs text-tertiary mt-1">Draws</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-error-primary">{playerStats.losses}</p>
                                    <p className="text-xs text-tertiary mt-1">Losses</p>
                                </div>
                            </div>
                            {playerStats.matches > 0 && (
                                <div className="mt-4 pt-4 border-t border-secondary">
                                    <p className="text-sm text-tertiary text-center">
                                        Win Rate: {((playerStats.wins / playerStats.matches) * 100).toFixed(1)}%
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Quick Info */}
                    <div className="bg-secondary rounded-2xl border border-tertiary p-6">
                        <h3 className="text-base font-semibold text-primary mb-3">Quick Tips</h3>
                        <ul className="space-y-2 text-sm text-tertiary">
                            <li className="flex gap-2">
                                <span className="text-brand-primary">•</span>
                                <span>Check the <strong>Events</strong> tab to see upcoming and past matches</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-brand-primary">•</span>
                                <span>Browse <strong>Players</strong> to see other team members and their stats</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-brand-primary">•</span>
                                <span>View league-wide <strong>Stats</strong> and rankings</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-brand-primary">•</span>
                                <span>Log goals during matches in the <strong>Events</strong> section</span>
                            </li>
                        </ul>
                    </div>
                </>
            )}

            {/* Admin View */}
            {showAdminView && (
                <div className="bg-primary rounded-2xl border border-secondary p-6">
                    <h2 className="text-lg font-semibold text-primary mb-4">Player Account Linking</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">Generate Linking URL</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={generateLinkingCode}
                                    className="px-4 py-2 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear"
                                >
                                    Generate Link
                                </button>
                                {linkingCode && (
                                    <div className="flex-1 flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={`${window.location.origin}/dashboard?link=${linkingCode}`}
                                            readOnly
                                            className="flex-1 px-3.5 py-2.5 rounded-lg border border-primary bg-secondary text-primary text-sm font-mono focus:outline-none truncate"
                                        />
                                        <button
                                            onClick={copyLinkingCode}
                                            className="px-3 py-2 bg-secondary hover:bg-secondary_hover text-primary rounded-lg transition duration-100 ease-linear"
                                        >
                                            {showCopySuccess ? (
                                                <CheckCircle className="size-5 text-success-primary" />
                                            ) : (
                                                <Copy07 className="size-5" />
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                            {linkingCode && (
                                <p className="text-xs text-tertiary mt-2">Share this URL with players to link their account</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">Or Manually Link Player</label>
                            <p className="text-xs text-tertiary">
                                Go to the <strong>Players</strong> section to manually link players to user accounts
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({
    icon: Icon,
    label,
    value,
    color,
}: {
    icon: React.FC<any>;
    label: string;
    value: number;
    color: "brand" | "success" | "warning";
}) {
    const colorMap = {
        brand: "bg-brand-secondary text-brand-primary",
        success: "bg-success-secondary text-success-primary",
        warning: "bg-warning-secondary text-warning-primary",
    };

    return (
        <div className="bg-primary rounded-xl border border-secondary p-4">
            <div className={`size-10 rounded-lg ${colorMap[color]} flex items-center justify-center mb-3`}>
                <Icon className="size-5" />
            </div>
            <p className="text-2xl font-bold text-primary">{value}</p>
            <p className="text-sm text-tertiary mt-1">{label}</p>
        </div>
    );
}
