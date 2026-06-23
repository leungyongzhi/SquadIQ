"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useViewMode } from "@/app/(app)/layout";
import { cx } from "@/utils/cx";
import {
    Users01, Shield01, Calendar, Trophy01, BarChart01,
    CheckCircle, XCircle, PieChart01, Star01, TrendUp01,
} from "@untitledui/icons";

interface Overview {
    totalPlayers: number;
    activePlayers: number;
    totalCommunities: number;
    totalEvents: number;
    completedEvents: number;
    scheduledEvents: number;
    totalGoals: number;
    totalAssists: number;
    totalEnrollments: number;
    paidEnrollments: number;
    lateCount: number;
    noShowCount: number;
}

interface PlayerStat {
    id: string;
    name: string;
    avatar: string | null;
    goals: number;
    assists: number;
    potm: number;
    enrollments: number;
}

interface CommunityStat {
    id: string;
    name: string;
    sport_type: string | null;
    members: number;
    events: number;
    completed: number;
    goals: number;
    enrolled: number;
    paid: number;
    late: number;
    noShow: number;
}

function StatCard({ icon: Icon, label, value, sub, color = "brand" }: {
    icon: React.FC<any>;
    label: string;
    value: number | string;
    sub?: string;
    color?: "brand" | "success" | "warning" | "error" | "gray";
}) {
    const colors = {
        brand: "bg-brand-secondary text-brand-primary",
        success: "bg-success-secondary text-success-primary",
        warning: "bg-warning-secondary text-warning-primary",
        error: "bg-error-secondary text-error-primary",
        gray: "bg-secondary text-tertiary",
    };
    return (
        <div className="bg-primary rounded-2xl border border-secondary p-5">
            <div className={cx("size-10 rounded-xl flex items-center justify-center mb-4", colors[color])}>
                <Icon className="size-5" />
            </div>
            <p className="text-2xl font-bold text-primary">{value}</p>
            <p className="text-sm font-medium text-secondary mt-0.5">{label}</p>
            {sub && <p className="text-xs text-tertiary mt-1">{sub}</p>}
        </div>
    );
}

function MiniBar({ value, max }: { value: number; max: number }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-brand-solid rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-medium text-secondary w-6 text-right">{value}</span>
        </div>
    );
}

type LeaderboardTab = "goals" | "assists" | "potm";

export default function ReportsPage() {
    const { isAdmin, isSuperAdmin, adminCommunityIds } = useViewMode();
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState<Overview | null>(null);
    const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
    const [communityStats, setCommunityStats] = useState<CommunityStat[]>([]);
    const [activeTab, setActiveTab] = useState<LeaderboardTab>("goals");

    useEffect(() => {
        if (isAdmin === false) { router.push("/"); return; }
        if (isAdmin) load();
    }, [isAdmin, isSuperAdmin, adminCommunityIds.join(",")]);

    const load = async () => {
        // Community admins are scoped to their community IDs; super admins see all
        const scopedIds = isSuperAdmin ? null : adminCommunityIds;

        const eventsQuery = supabase.from("match_events").select("id, community_id, status, player_of_match_id, event_date, team_blue_ids, team_orange_ids");
        const membersQuery = supabase.from("community_members").select("community_id, player_id, player:players(id, name, avatar_url)");
        const communitiesQuery = supabase.from("communities").select("id, name, sport_type");

        const [
            { data: players },
            { data: communities },
            { data: events },
            { data: goals },
            { data: enrollments },
            { data: members },
        ] = await Promise.all([
            isSuperAdmin ? supabase.from("players").select("id, name, avatar_url, is_active") : Promise.resolve({ data: [] }),
            scopedIds ? communitiesQuery.in("id", scopedIds) : communitiesQuery,
            scopedIds ? eventsQuery.in("community_id", scopedIds) : eventsQuery,
            supabase.from("goals").select("scorer_id, assister_id, event_id"),
            supabase.from("event_enrollments").select("player_id, has_paid, event_id, is_enrolled, attendance_status"),
            scopedIds ? membersQuery.in("community_id", scopedIds) : membersQuery,
        ]);

        const evList = (events ?? []) as any[];
        const goalList = (goals ?? []) as any[];
        const enrollList = (enrollments ?? []) as any[];
        const memberList = (members ?? []) as any[];
        const playerList = (players ?? []) as any[];
        const communityList = (communities ?? []) as any[];

        const completedEvIds = new Set(evList.filter((e) => e.status === "completed").map((e) => e.id));

        // ── Overview ─────────────────────────────────────────────────────────
        const paidCount = enrollList.filter((e) => e.has_paid && completedEvIds.has(e.event_id)).length;
        const totalEnrolled = enrollList.filter((e) => e.is_enrolled !== false && completedEvIds.has(e.event_id)).length;
        const lateCount = enrollList.filter((e) => e.attendance_status === "late").length;
        const noShowCount = enrollList.filter((e) => e.attendance_status === "no_show").length;

        const uniqueMembers = new Set(memberList.map((m: any) => m.player_id));
        setOverview({
            totalPlayers: isSuperAdmin ? playerList.length : uniqueMembers.size,
            activePlayers: isSuperAdmin ? playerList.filter((p: any) => p.is_active).length : uniqueMembers.size,
            totalCommunities: communityList.length,
            totalEvents: evList.length,
            completedEvents: evList.filter((e) => e.status === "completed").length,
            scheduledEvents: evList.filter((e) => e.status === "scheduled").length,
            totalGoals: goalList.length,
            totalAssists: goalList.filter((g) => g.assister_id).length,
            totalEnrollments: totalEnrolled,
            paidEnrollments: paidCount,
            lateCount,
            noShowCount,
        });

        // ── Player leaderboard ────────────────────────────────────────────────
        // Build player seed: super admins use the global players list; admins use community members
        const playerMap: Record<string, PlayerStat> = {};
        if (isSuperAdmin) {
            playerList.forEach((p: any) => {
                playerMap[p.id] = { id: p.id, name: p.name, avatar: p.avatar_url, goals: 0, assists: 0, potm: 0, enrollments: 0 };
            });
        } else {
            memberList.forEach((m: any) => {
                if (!playerMap[m.player_id]) {
                    playerMap[m.player_id] = { id: m.player_id, name: (m.player as any)?.name ?? "Unknown", avatar: (m.player as any)?.avatar_url ?? null, goals: 0, assists: 0, potm: 0, enrollments: 0 };
                }
            });
        }

        goalList.forEach((g) => {
            if (playerMap[g.scorer_id]) playerMap[g.scorer_id].goals++;
            if (g.assister_id && playerMap[g.assister_id]) playerMap[g.assister_id].assists++;
        });
        evList.forEach((e) => {
            if (e.player_of_match_id && playerMap[e.player_of_match_id]) playerMap[e.player_of_match_id].potm++;
        });
        enrollList.forEach((e) => {
            if (e.is_enrolled !== false && playerMap[e.player_id]) playerMap[e.player_id].enrollments++;
        });

        setPlayerStats(Object.values(playerMap).filter((p) => p.goals + p.assists + p.potm > 0));

        // ── Community breakdown ───────────────────────────────────────────────
        const commEvMap: Record<string, { events: Set<string>; completed: Set<string>; goals: number; enrolled: number; paid: number; late: number; noShow: number }> = {};
        communityList.forEach((c) => {
            commEvMap[c.id] = { events: new Set(), completed: new Set(), goals: 0, enrolled: 0, paid: 0, late: 0, noShow: 0 };
        });

        evList.forEach((e) => {
            if (e.community_id && commEvMap[e.community_id]) {
                commEvMap[e.community_id].events.add(e.id);
                if (e.status === "completed") commEvMap[e.community_id].completed.add(e.id);
            }
        });

        const evCommMap: Record<string, string> = {};
        evList.forEach((e) => { if (e.community_id) evCommMap[e.id] = e.community_id; });

        goalList.forEach((g) => {
            const cid = evCommMap[g.event_id];
            if (cid && commEvMap[cid]) commEvMap[cid].goals++;
        });
        enrollList.forEach((e) => {
            const cid = evCommMap[e.event_id];
            if (cid && commEvMap[cid]) {
                if (e.is_enrolled !== false) commEvMap[cid].enrolled++;
                if (e.has_paid) commEvMap[cid].paid++;
                if (e.attendance_status === "late") commEvMap[cid].late++;
                if (e.attendance_status === "no_show") commEvMap[cid].noShow++;
            }
        });

        const memberCountMap: Record<string, number> = {};
        memberList.forEach((m) => { memberCountMap[m.community_id] = (memberCountMap[m.community_id] ?? 0) + 1; });

        setCommunityStats(
            communityList.map((c) => ({
                id: c.id,
                name: c.name,
                sport_type: c.sport_type,
                members: memberCountMap[c.id] ?? 0,
                events: commEvMap[c.id]?.events.size ?? 0,
                completed: commEvMap[c.id]?.completed.size ?? 0,
                goals: commEvMap[c.id]?.goals ?? 0,
                enrolled: commEvMap[c.id]?.enrolled ?? 0,
                paid: commEvMap[c.id]?.paid ?? 0,
                late: commEvMap[c.id]?.late ?? 0,
                noShow: commEvMap[c.id]?.noShow ?? 0,
            })).sort((a, b) => b.members - a.members)
        );

        setLoading(false);
    };

    const sortedPlayers = [...playerStats].sort((a, b) => {
        if (activeTab === "goals") return b.goals - a.goals || b.assists - a.assists;
        if (activeTab === "assists") return b.assists - a.assists || b.goals - a.goals;
        return b.potm - a.potm;
    }).slice(0, 10);

    const maxStat = sortedPlayers.length > 0
        ? Math.max(...sortedPlayers.map((p) => activeTab === "goals" ? p.goals : activeTab === "assists" ? p.assists : p.potm))
        : 1;

    if (!isAdmin && !loading) return null;

    return (
        <div className="max-w-5xl space-y-8">
            <div>
                <h1 className="text-2xl font-semibold text-primary">Reports</h1>
                <p className="text-sm text-tertiary mt-1">
                    {isSuperAdmin ? "App-wide data across all communities, players, and match days." : "Stats and insights for your community."}
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="size-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
            ) : overview && (<>

                {/* ── Overview cards ─────────────────────────────────────── */}
                <div className={cx("grid gap-4", isSuperAdmin ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" : "grid-cols-2 sm:grid-cols-3")}>
                    {isSuperAdmin && <StatCard icon={Users01} label="Active Players" value={overview.activePlayers} sub={`${overview.totalPlayers} total`} color="brand" />}
                    {isSuperAdmin
                        ? <StatCard icon={Shield01} label="Communities" value={overview.totalCommunities} color="gray" />
                        : <StatCard icon={Users01} label="Members" value={overview.totalPlayers} color="brand" />
                    }
                    <StatCard icon={Calendar} label="Match Days" value={overview.totalEvents} sub={`${overview.completedEvents} completed · ${overview.scheduledEvents} upcoming`} color="success" />
                    <StatCard icon={Trophy01} label="Goals Scored" value={overview.totalGoals} sub={`${overview.totalAssists} assists`} color="warning" />
                    <StatCard
                        icon={CheckCircle}
                        label="Payments"
                        value={overview.totalEnrollments > 0 ? `${Math.round((overview.paidEnrollments / overview.totalEnrollments) * 100)}%` : "—"}
                        sub={`${overview.paidEnrollments} of ${overview.totalEnrollments} paid`}
                        color={overview.paidEnrollments / Math.max(overview.totalEnrollments, 1) >= 0.8 ? "success" : "error"}
                    />
                    <StatCard icon={XCircle} label="Attendance Issues" value={overview.lateCount + overview.noShowCount} sub={`${overview.lateCount} late · ${overview.noShowCount} no-show`} color={overview.lateCount + overview.noShowCount > 0 ? "error" : "gray"} />
                </div>

                {/* ── Player leaderboard ────────────────────────────────── */}
                <div className="bg-primary rounded-2xl border border-secondary p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h2 className="text-base font-semibold text-primary">Player Leaderboard</h2>
                            <p className="text-sm text-tertiary mt-0.5">Top 10 across all communities</p>
                        </div>
                        <div className="flex gap-1 bg-secondary rounded-lg p-1">
                            {(["goals", "assists", "potm"] as LeaderboardTab[]).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setActiveTab(t)}
                                    className={cx("px-3 py-1.5 rounded-md text-xs font-semibold transition duration-100 ease-linear capitalize", activeTab === t ? "bg-primary text-primary shadow-sm" : "text-tertiary hover:text-secondary")}
                                >
                                    {t === "potm" ? "POTM" : t.charAt(0).toUpperCase() + t.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    {sortedPlayers.length === 0 ? (
                        <p className="text-sm text-tertiary text-center py-8">No data yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {sortedPlayers.map((p, i) => {
                                const stat = activeTab === "goals" ? p.goals : activeTab === "assists" ? p.assists : p.potm;
                                const rankColor = i === 0 ? "text-warning-primary" : i === 1 ? "text-quaternary" : i === 2 ? "text-tertiary" : "text-quaternary";
                                return (
                                    <div key={p.id} className="flex items-center gap-4">
                                        <span className={cx("w-5 text-sm font-bold text-right flex-shrink-0", rankColor)}>{i + 1}</span>
                                        <div className="size-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-secondary flex-shrink-0 overflow-hidden">
                                            {p.avatar ? <img src={p.avatar} className="size-8 object-cover" alt="" /> : p.name[0]}
                                        </div>
                                        <span className="text-sm font-medium text-primary w-36 truncate flex-shrink-0">{p.name}</span>
                                        <div className="flex-1">
                                            <MiniBar value={stat} max={maxStat} />
                                        </div>
                                        <div className="flex gap-4 text-xs text-tertiary flex-shrink-0 w-32 justify-end">
                                            <span><span className="font-semibold text-primary">{p.goals}</span> G</span>
                                            <span><span className="font-semibold text-primary">{p.assists}</span> A</span>
                                            {p.potm > 0 && <span className="text-warning-primary"><span className="font-semibold">{p.potm}</span>★</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Community breakdown (super admin only) ────────────── */}
                {isSuperAdmin && <div className="bg-primary rounded-2xl border border-secondary overflow-hidden">
                    <div className="p-6 border-b border-secondary">
                        <h2 className="text-base font-semibold text-primary">Community Breakdown</h2>
                        <p className="text-sm text-tertiary mt-0.5">Stats per community</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-secondary bg-secondary">
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-tertiary">Community</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-tertiary">Members</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-tertiary">Events</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-tertiary">Goals</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-tertiary">Late</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-tertiary">No Show</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-tertiary">Payment Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary">
                                {communityStats.map((c) => {
                                    const payRate = c.enrolled > 0 ? Math.round((c.paid / c.enrolled) * 100) : null;
                                    return (
                                        <tr key={c.id} className="hover:bg-primary_hover transition duration-100 ease-linear">
                                            <td className="px-6 py-3.5">
                                                <p className="font-medium text-primary">{c.name}</p>
                                                {c.sport_type && <p className="text-xs text-tertiary mt-0.5">{c.sport_type}</p>}
                                            </td>
                                            <td className="px-4 py-3.5 text-center font-medium text-primary">{c.members}</td>
                                            <td className="px-4 py-3.5 text-center">
                                                <span className="font-medium text-primary">{c.events}</span>
                                                {c.completed > 0 && <span className="text-xs text-tertiary ml-1">({c.completed} done)</span>}
                                            </td>
                                            <td className="px-4 py-3.5 text-center font-medium text-primary">{c.goals}</td>
                                            <td className="px-4 py-3.5 text-center">
                                                {c.late > 0 ? <span className="text-sm font-semibold text-warning-primary">{c.late}</span> : <span className="text-quaternary text-xs">—</span>}
                                            </td>
                                            <td className="px-4 py-3.5 text-center">
                                                {c.noShow > 0 ? <span className="text-sm font-semibold text-error-primary">{c.noShow}</span> : <span className="text-quaternary text-xs">—</span>}
                                            </td>
                                            <td className="px-4 py-3.5 text-center">
                                                {payRate !== null ? (
                                                    <span className={cx("inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full", payRate >= 80 ? "bg-success-primary text-success-primary" : payRate >= 50 ? "bg-warning-primary text-warning-primary" : "bg-error-secondary text-error-primary")}>
                                                        {payRate}%
                                                    </span>
                                                ) : <span className="text-quaternary text-xs">—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>}

                {/* ── Payment detail ────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-primary rounded-2xl border border-secondary p-6">
                        <h2 className="text-sm font-semibold text-secondary mb-4 flex items-center gap-2">
                            <CheckCircle className="size-4 text-success-primary" />Payment Summary
                        </h2>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-tertiary">Total enrollments</span>
                                <span className="text-sm font-semibold text-primary">{overview.totalEnrollments}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-success-primary flex items-center gap-1.5"><CheckCircle className="size-3.5" />Paid</span>
                                <span className="text-sm font-semibold text-success-primary">{overview.paidEnrollments}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-error-primary flex items-center gap-1.5"><XCircle className="size-3.5" />Unpaid</span>
                                <span className="text-sm font-semibold text-error-primary">{overview.totalEnrollments - overview.paidEnrollments}</span>
                            </div>
                            <div className="pt-2 border-t border-secondary">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-success-solid rounded-full"
                                            style={{ width: overview.totalEnrollments > 0 ? `${(overview.paidEnrollments / overview.totalEnrollments) * 100}%` : "0%" }}
                                        />
                                    </div>
                                    <span className="text-xs font-semibold text-success-primary">
                                        {overview.totalEnrollments > 0 ? `${Math.round((overview.paidEnrollments / overview.totalEnrollments) * 100)}%` : "—"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-primary rounded-2xl border border-secondary p-6">
                        <h2 className="text-sm font-semibold text-secondary mb-4 flex items-center gap-2">
                            <BarChart01 className="size-4 text-quaternary" />{isSuperAdmin ? "App Totals" : "Community Totals"}
                        </h2>
                        <div className="space-y-3">
                            {[
                                { label: isSuperAdmin ? "Total players registered" : "Total members", value: overview.totalPlayers },
                                { label: "Active players", value: overview.activePlayers, hidden: !isSuperAdmin },
                                { label: "Total match days", value: overview.totalEvents },
                                { label: "Completed match days", value: overview.completedEvents },
                                { label: "Goals recorded", value: overview.totalGoals },
                                { label: "Assists recorded", value: overview.totalAssists },
                                { label: "Late arrivals", value: overview.lateCount },
                                { label: "No shows", value: overview.noShowCount },
                            ].filter((r: any) => !r.hidden).map(({ label, value }) => (
                                <div key={label} className="flex justify-between items-center">
                                    <span className="text-sm text-tertiary">{label}</span>
                                    <span className="text-sm font-semibold text-primary">{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </>)}
        </div>
    );
}
