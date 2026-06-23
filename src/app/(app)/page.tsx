"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useViewMode } from "@/app/(app)/layout";
import type { MatchEvent, Player } from "@/lib/football/types";
import {
    Users01,
    Calendar,
    Trophy01,
    Target01,
    ChevronRight,
    Clock,
    Shield01,
    BarChart01,
    CheckCircle,
    PlusCircle,
    Star01,
} from "@untitledui/icons";
import { cx } from "@/utils/cx";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.FC<any>; color: string }) {
    return (
        <div className="bg-primary rounded-xl border border-secondary p-5">
            <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-secondary">{label}</p>
                <div className={cx("flex size-9 items-center justify-center rounded-lg", color)}>
                    <Icon className="size-5 text-white" />
                </div>
            </div>
            <p className="text-3xl font-semibold text-primary">{value}</p>
        </div>
    );
}

function CalendarView({ events }: { events: MatchEvent[] }) {
    const [month, setMonth] = useState(new Date());
    const year = month.getFullYear();
    const mon = month.getMonth();
    const firstDay = new Date(year, mon, 1).getDay();
    const daysInMonth = new Date(year, mon + 1, 0).getDate();
    const today = new Date();
    const eventsByDay: Record<number, MatchEvent[]> = {};
    events.forEach((e) => {
        const d = new Date(e.event_date);
        if (d.getFullYear() === year && d.getMonth() === mon) {
            const day = d.getDate();
            if (!eventsByDay[day]) eventsByDay[day] = [];
            eventsByDay[day].push(e);
        }
    });
    const monthLabel = month.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    return (
        <div className="bg-primary rounded-xl border border-secondary p-5">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-primary">{monthLabel}</h2>
                <div className="flex gap-1">
                    <button onClick={() => setMonth(new Date(year, mon - 1))} className="p-1.5 rounded-lg text-tertiary hover:bg-primary_hover hover:text-primary transition duration-100 ease-linear">&#8249;</button>
                    <button onClick={() => setMonth(new Date(year, mon + 1))} className="p-1.5 rounded-lg text-tertiary hover:bg-primary_hover hover:text-primary transition duration-100 ease-linear">&#8250;</button>
                </div>
            </div>
            <div className="grid grid-cols-7 gap-px">
                {days.map((d) => <div key={d} className="text-center text-xs font-medium text-quaternary py-1">{d}</div>)}
                {cells.map((day, i) => {
                    const isToday = day === today.getDate() && mon === today.getMonth() && year === today.getFullYear();
                    const hasEvents = day !== null && eventsByDay[day];
                    return (
                        <div key={i} className={cx("aspect-square flex flex-col items-center justify-start pt-1 rounded-lg text-xs", day === null ? "" : "hover:bg-primary_hover cursor-default", isToday ? "bg-brand-primary_alt" : "")}>
                            {day !== null && (<>
                                <span className={cx("font-medium", isToday ? "text-brand-primary" : "text-secondary")}>{day}</span>
                                {hasEvents && <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">{eventsByDay[day].slice(0, 2).map((ev) => <div key={ev.id} className={cx("size-1.5 rounded-full", ev.status === "completed" ? "bg-success-solid" : ev.status === "in_progress" ? "bg-warning-solid" : "bg-brand-solid")} />)}</div>}
                            </>)}
                        </div>
                    );
                })}
            </div>
            <div className="flex gap-4 mt-3 pt-3 border-t border-secondary">
                {[{ color: "bg-brand-solid", label: "Scheduled" }, { color: "bg-warning-solid", label: "In Progress" }, { color: "bg-success-solid", label: "Completed" }].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5"><div className={cx("size-2 rounded-full", color)} /><span className="text-xs text-tertiary">{label}</span></div>
                ))}
            </div>
        </div>
    );
}

interface AdminStats { totalPlayers: number; upcomingEvents: number; completedMatches: number; topScorers: { player: Player; goals: number }[]; }

function AdminDashboard() {
    const [stats, setStats] = useState<AdminStats>({ totalPlayers: 0, upcomingEvents: 0, completedMatches: 0, topScorers: [] });
    const [allEvents, setAllEvents] = useState<MatchEvent[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<MatchEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function load() {
            const [playersRes, eventsRes, goalsRes] = await Promise.all([
                supabase.from("players").select("*").eq("is_active", true),
                supabase.from("match_events").select("*").order("event_date", { ascending: true }),
                supabase.from("goals").select("scorer_id, players(id, name)"),
            ]);
            const events = eventsRes.data ?? [];
            setAllEvents(events);
            setUpcomingEvents(events.filter((e: MatchEvent) => e.status === "scheduled").slice(0, 3));
            const goalCounts: Record<string, { player: Player; goals: number }> = {};
            (goalsRes.data ?? []).forEach((g: any) => {
                if (!goalCounts[g.scorer_id]) goalCounts[g.scorer_id] = { player: g.players, goals: 0 };
                goalCounts[g.scorer_id].goals++;
            });
            setStats({
                totalPlayers: (playersRes.data ?? []).length,
                upcomingEvents: events.filter((e: MatchEvent) => e.status === "scheduled").length,
                completedMatches: events.filter((e: MatchEvent) => e.status === "completed").length,
                topScorers: Object.values(goalCounts).sort((a, b) => b.goals - a.goals).slice(0, 5),
            });
            setLoading(false);
        }
        load();
    }, []);

    if (loading) return <div className="flex items-center justify-center h-64"><div className="size-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-primary">Dashboard</h1>
                <p className="text-sm text-tertiary mt-1">Welcome back! Here is what is happening.</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard label="Active Players" value={stats.totalPlayers} icon={Users01} color="bg-brand-solid" />
                <StatCard label="Upcoming Matches" value={stats.upcomingEvents} icon={Calendar} color="bg-warning-solid" />
                <StatCard label="Completed Matches" value={stats.completedMatches} icon={Trophy01} color="bg-success-solid" />
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
                <CalendarView events={allEvents} />
                <div className="bg-primary rounded-xl border border-secondary p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-semibold text-primary">Upcoming Match Days</h2>
                        <Link href="/events" className="text-sm text-brand-secondary hover:text-brand-secondary_hover transition duration-100 ease-linear flex items-center gap-1">View all <ChevronRight className="size-4" /></Link>
                    </div>
                    {upcomingEvents.length === 0 ? <p className="text-sm text-tertiary text-center py-8">No upcoming events</p> : (
                        <div className="space-y-3">
                            {upcomingEvents.map((event) => (
                                <Link key={event.id} href={`/events/${event.id}`} className="flex items-center gap-3 p-3 rounded-lg border border-secondary hover:bg-primary_hover transition duration-100 ease-linear">
                                    <div className="flex size-9 items-center justify-center rounded-lg bg-brand-secondary flex-shrink-0"><Calendar className="size-4 text-brand-primary" /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-primary truncate">{event.title}</p>
                                        <p className="text-xs text-tertiary flex items-center gap-1 mt-0.5"><Clock className="size-3" />{new Date(event.event_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at {event.event_time?.slice(0, 5)}</p>
                                    </div>
                                    <ChevronRight className="size-4 text-quaternary flex-shrink-0" />
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
                <div className="bg-primary rounded-xl border border-secondary p-5">
                    <h2 className="text-base font-semibold text-primary mb-4">Top Scorers</h2>
                    {stats.topScorers.length === 0 ? <p className="text-sm text-tertiary text-center py-8">No goals recorded yet</p> : (
                        <div className="space-y-3">
                            {stats.topScorers.map(({ player, goals }, i) => (
                                <div key={player?.id} className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-quaternary w-5">{i + 1}</span>
                                    <div className="size-8 rounded-full bg-brand-secondary flex items-center justify-center text-xs font-semibold text-brand-primary flex-shrink-0">{player?.name?.[0] ?? "?"}</div>
                                    <span className="flex-1 text-sm font-medium text-primary truncate">{player?.name ?? "Unknown"}</span>
                                    <div className="flex items-center gap-1"><Target01 className="size-3.5 text-brand-secondary" /><span className="text-sm font-semibold text-primary">{goals}</span></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

type MatchResult = "W" | "L" | "D";
interface CommunityStats { communityId: string; communityName: string; gp: number; goals: number; assists: number; potm: number; wins: number; losses: number; draws: number; }
interface UpcomingEvent extends MatchEvent { communityName: string; isEnrolled: boolean; }
interface LastMatch { title: string; communityName: string; event_date: string; goals: number; assists: number; wasPotm: boolean; played: boolean; result: MatchResult | null; }

function PlayerDashboard() {
    const [playerName, setPlayerName] = useState("");
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [communityStats, setCommunityStats] = useState<CommunityStats[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
    const [lastMatch, setLastMatch] = useState<LastMatch | null>(null);
    const [last5, setLast5] = useState<MatchResult[]>([]);
    const [enrollingId, setEnrollingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: profile } = await supabase.from("user_profiles").select("player_id").eq("id", user.id).single();
            if (!profile?.player_id) { setLoading(false); return; }
            const pid = profile.player_id;
            setPlayerId(pid);

            const [{ data: playerData }, { data: memberships }] = await Promise.all([
                supabase.from("players").select("name").eq("id", pid).single(),
                supabase.from("community_members").select("community_id, communities(id, name)").eq("player_id", pid),
            ]);
            setPlayerName((playerData as any)?.name ?? user.email ?? "");

            const communities = (memberships ?? []).map((m: any) => ({ id: m.community_id as string, name: (m.communities?.name ?? "Unknown") as string }));
            if (communities.length === 0) { setLoading(false); return; }
            const communityIds = communities.map((c) => c.id);

            const [{ data: events }, { data: goalsData }, { data: enrollData }] = await Promise.all([
                supabase.from("match_events").select("id, community_id, team_blue_ids, team_orange_ids, player_of_match_id, status, title, event_date, event_time, location, score_blue, score_orange").in("community_id", communityIds).order("event_date", { ascending: false }),
                supabase.from("goals").select("event_id, scorer_id, assister_id"),
                supabase.from("event_enrollments").select("event_id, is_enrolled").eq("player_id", pid).eq("is_enrolled", true),
            ]);

            const allEvents = (events ?? []) as any[];
            const allGoals = goalsData ?? [];
            const enrolledEventIds = new Set((enrollData ?? []).map((e: any) => e.event_id));

            const statsMap: Record<string, CommunityStats> = {};
            communities.forEach((c) => { statsMap[c.id] = { communityId: c.id, communityName: c.name, gp: 0, goals: 0, assists: 0, potm: 0, wins: 0, losses: 0, draws: 0 }; });

            const getResult = (ev: any, pid: string): MatchResult | null => {
                if (ev.status !== "completed") return null;
                const inBlue = ev.team_blue_ids?.includes(pid);
                const inOrange = ev.team_orange_ids?.includes(pid);
                if (!inBlue && !inOrange) return null;
                const sb = ev.score_blue ?? 0, so = ev.score_orange ?? 0;
                if (sb === so) return "D";
                if (inBlue) return sb > so ? "W" : "L";
                return so > sb ? "W" : "L";
            };

            const eventCommunityMap: Record<string, string> = {};
            const playedCompleted: { date: string; result: MatchResult }[] = [];
            allEvents.forEach((ev: any) => {
                if (!ev.community_id) return;
                eventCommunityMap[ev.id] = ev.community_id;
                const stat = statsMap[ev.community_id];
                if (!stat) return;
                const inTeam = ev.team_blue_ids?.includes(pid) || ev.team_orange_ids?.includes(pid);
                if (inTeam) {
                    stat.gp++;
                    const result = getResult(ev, pid);
                    if (result) {
                        if (result === "W") stat.wins++;
                        else if (result === "L") stat.losses++;
                        else stat.draws++;
                        playedCompleted.push({ date: ev.event_date, result });
                    }
                }
                if (ev.player_of_match_id === pid) stat.potm++;
            });

            // Last 5 completed played matches (already sorted desc by date)
            setLast5(playedCompleted.slice(0, 5).map((r) => r.result));
            allGoals.forEach((g: any) => {
                const commId = eventCommunityMap[g.event_id];
                if (!commId) return;
                const stat = statsMap[commId];
                if (!stat) return;
                if (g.scorer_id === pid) stat.goals++;
                if (g.assister_id === pid) stat.assists++;
            });

            // Last match: most recent completed event the player was in a team for
            const lastCompleted = allEvents.find((e: any) =>
                e.status === "completed" && (e.team_blue_ids?.includes(pid) || e.team_orange_ids?.includes(pid))
            );
            if (lastCompleted) {
                const matchGoals = allGoals.filter((g: any) => g.event_id === lastCompleted.id && g.scorer_id === pid).length;
                const matchAssists = allGoals.filter((g: any) => g.event_id === lastCompleted.id && g.assister_id === pid).length;
                setLastMatch({
                    title: lastCompleted.title,
                    communityName: communities.find((c) => c.id === lastCompleted.community_id)?.name ?? "",
                    event_date: lastCompleted.event_date,
                    goals: matchGoals,
                    assists: matchAssists,
                    wasPotm: lastCompleted.player_of_match_id === pid,
                    played: true,
                    result: getResult(lastCompleted, pid),
                });
            }

            const upcoming: UpcomingEvent[] = allEvents
                .filter((e: any) => e.status === "scheduled")
                .slice(0, 5)
                .map((e: any) => ({ ...e, communityName: communities.find((c) => c.id === e.community_id)?.name ?? "", isEnrolled: enrolledEventIds.has(e.id) }));
            setCommunityStats(Object.values(statsMap));
            setUpcomingEvents(upcoming);
            setLoading(false);
        }
        load();
    }, []);

    const toggleEnroll = async (event: UpcomingEvent) => {
        if (!playerId || enrollingId) return;
        setEnrollingId(event.id);
        const nowEnrolled = !event.isEnrolled;
        if (nowEnrolled) {
            await supabase.from("event_enrollments").upsert({ event_id: event.id, player_id: playerId, is_enrolled: true }, { onConflict: "event_id,player_id" });
        } else {
            await supabase.from("event_enrollments").update({ is_enrolled: false }).eq("event_id", event.id).eq("player_id", playerId);
        }
        setUpcomingEvents((prev) => prev.map((e) => e.id === event.id ? { ...e, isEnrolled: nowEnrolled } : e));
        setEnrollingId(null);
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="size-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;

    const totals = communityStats.reduce((acc, s) => ({ gp: acc.gp + s.gp, goals: acc.goals + s.goals, assists: acc.assists + s.assists, potm: acc.potm + s.potm, wins: acc.wins + s.wins, losses: acc.losses + s.losses, draws: acc.draws + s.draws }), { gp: 0, goals: 0, assists: 0, potm: 0, wins: 0, losses: 0, draws: 0 });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-primary">{playerName ? `Welcome, ${playerName}` : "Dashboard"}</h1>
                <p className="text-sm text-tertiary mt-1">Your stats and upcoming matches.</p>
            </div>

            {/* Last match result + last 5 */}
            {(lastMatch || last5.length > 0) && (
                <div className="rounded-2xl border border-secondary bg-primary p-5 space-y-4">
                    {lastMatch && (
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold text-quaternary uppercase tracking-wide mb-1">Last Match</p>
                                <p className="text-base font-semibold text-primary">{lastMatch.title}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-tertiary">
                                    <span className="flex items-center gap-1"><Clock className="size-3" />{new Date(lastMatch.event_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
                                    <span className="flex items-center gap-1"><Shield01 className="size-3" />{lastMatch.communityName}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {lastMatch.result && (
                                    <span className={cx("w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white",
                                        lastMatch.result === "W" ? "bg-success-solid" : lastMatch.result === "L" ? "bg-error-solid" : "bg-secondary text-secondary")}>
                                        {lastMatch.result}
                                    </span>
                                )}
                                {lastMatch.wasPotm && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning-solid text-white text-xs font-semibold">
                                        <Star01 className="size-3.5" /> POTM
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {lastMatch && (
                        <div className="flex gap-4 pt-4 border-t border-secondary">
                            {[{ label: "Goals", value: lastMatch.goals, icon: Target01 }, { label: "Assists", value: lastMatch.assists, icon: Star01 }].map(({ label, value, icon: Icon }) => (
                                <div key={label} className="flex items-center gap-2">
                                    <div className="flex size-8 items-center justify-center rounded-lg bg-secondary"><Icon className="size-4 text-tertiary" /></div>
                                    <div><p className="text-lg font-bold text-primary leading-none">{value}</p><p className="text-xs text-tertiary">{label}</p></div>
                                </div>
                            ))}
                        </div>
                    )}
                    {last5.length > 0 && (
                        <div className="flex items-center gap-3 pt-4 border-t border-secondary">
                            <p className="text-xs font-medium text-tertiary flex-shrink-0">Last {last5.length}</p>
                            <div className="flex gap-1.5">
                                {last5.map((r, i) => (
                                    <span key={i} className={cx("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                                        r === "W" ? "bg-success-solid text-white" : r === "L" ? "bg-error-solid text-white" : "bg-secondary text-secondary")}>
                                        {r}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Stats table */}
            <div className="bg-primary rounded-2xl border border-secondary overflow-hidden">
                <div className="flex items-center gap-2 px-6 py-4 border-b border-secondary">
                    <BarChart01 className="size-4 text-brand-primary" />
                    <h2 className="text-base font-semibold text-primary">My Stats</h2>
                </div>
                {communityStats.length === 0 ? (
                    <div className="text-center py-12">
                        <Shield01 className="size-10 mx-auto mb-3 text-quaternary" />
                        <p className="text-sm text-tertiary">You are not in any communities yet.</p>
                        <Link href="/communities" className="text-sm text-brand-secondary hover:text-brand-secondary_hover mt-2 inline-block transition duration-100 ease-linear">Browse communities</Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-medium text-quaternary text-left">
                                    <th className="px-6 py-3">Community</th>
                                    <th className="px-4 py-3 text-center">GP</th>
                                    <th className="px-4 py-3 text-center text-success-primary">W</th>
                                    <th className="px-4 py-3 text-center text-tertiary">D</th>
                                    <th className="px-4 py-3 text-center text-error-primary">L</th>
                                    <th className="px-4 py-3 text-center">G</th>
                                    <th className="px-4 py-3 text-center">A</th>
                                    <th className="px-4 py-3 text-center">POTM</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary">
                                {communityStats.map((s) => (
                                    <tr key={s.communityId} className="hover:bg-primary_hover transition duration-100 ease-linear">
                                        <td className="px-6 py-3">
                                            <Link href={`/communities/${s.communityId}`} className="flex items-center gap-2 text-primary font-medium hover:text-brand-primary transition duration-100 ease-linear">
                                                <div className="flex size-6 items-center justify-center rounded-md bg-brand-secondary flex-shrink-0"><Shield01 className="size-3.5 text-brand-primary" /></div>
                                                {s.communityName}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-center font-semibold text-primary">{s.gp}</td>
                                        <td className="px-4 py-3 text-center font-semibold text-success-primary">{s.wins || "-"}</td>
                                        <td className="px-4 py-3 text-center font-semibold text-tertiary">{s.draws || "-"}</td>
                                        <td className="px-4 py-3 text-center font-semibold text-error-primary">{s.losses || "-"}</td>
                                        <td className="px-4 py-3 text-center font-semibold text-primary">{s.goals}</td>
                                        <td className="px-4 py-3 text-center font-semibold text-primary">{s.assists}</td>
                                        <td className="px-4 py-3 text-center">{s.potm > 0 ? <span className="inline-flex items-center gap-1 text-warning-primary font-semibold"><Trophy01 className="size-3.5" />{s.potm}</span> : <span className="text-quaternary">-</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                            {communityStats.length > 1 && (
                                <tfoot>
                                    <tr className="bg-secondary border-t-2 border-secondary">
                                        <td className="px-6 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">Total</td>
                                        <td className="px-4 py-3 text-center text-sm font-bold text-primary">{totals.gp}</td>
                                        <td className="px-4 py-3 text-center text-sm font-bold text-success-primary">{totals.wins || "-"}</td>
                                        <td className="px-4 py-3 text-center text-sm font-bold text-tertiary">{totals.draws || "-"}</td>
                                        <td className="px-4 py-3 text-center text-sm font-bold text-error-primary">{totals.losses || "-"}</td>
                                        <td className="px-4 py-3 text-center text-sm font-bold text-primary">{totals.goals}</td>
                                        <td className="px-4 py-3 text-center text-sm font-bold text-primary">{totals.assists}</td>
                                        <td className="px-4 py-3 text-center text-sm font-bold text-primary">{totals.potm || "-"}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                )}
            </div>

            {/* Upcoming match days */}
            <div className="bg-primary rounded-2xl border border-secondary p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-primary flex items-center gap-2"><Calendar className="size-4 text-quaternary" />Upcoming Match Days</h2>
                    <Link href="/events" className="text-sm text-brand-secondary hover:text-brand-secondary_hover transition duration-100 ease-linear flex items-center gap-1">View all <ChevronRight className="size-4" /></Link>
                </div>
                {upcomingEvents.length === 0 ? <p className="text-sm text-tertiary text-center py-8">No upcoming events</p> : (
                    <div className="space-y-3">
                        {upcomingEvents.map((event) => (
                            <div key={event.id} className="flex items-center gap-3 p-3 rounded-lg border border-secondary hover:bg-primary_hover transition duration-100 ease-linear">
                                <Link href={`/events/${event.id}`} className="flex size-10 items-center justify-center rounded-lg bg-brand-secondary flex-shrink-0">
                                    <Calendar className="size-4 text-brand-primary" />
                                </Link>
                                <Link href={`/events/${event.id}`} className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-primary truncate">{event.title}</p>
                                    <div className="flex items-center gap-3 mt-0.5 text-xs text-tertiary">
                                        <span className="flex items-center gap-1"><Clock className="size-3" />{new Date(event.event_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · {event.event_time?.slice(0, 5)}</span>
                                        <span className="flex items-center gap-1"><Shield01 className="size-3" />{event.communityName}</span>
                                    </div>
                                </Link>
                                <button
                                    onClick={() => toggleEnroll(event)}
                                    disabled={enrollingId === event.id}
                                    className={cx(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition duration-100 ease-linear flex-shrink-0 disabled:opacity-50",
                                        event.isEnrolled
                                            ? "bg-success-primary border-success text-success-primary hover:bg-error-primary hover:border-error hover:text-error-primary"
                                            : "border-secondary text-tertiary hover:bg-brand-secondary hover:border-brand hover:text-brand-primary",
                                    )}
                                >
                                    {enrollingId === event.id ? (
                                        <div className="size-3 border border-current border-t-transparent rounded-full animate-spin" />
                                    ) : event.isEnrolled ? (
                                        <><CheckCircle className="size-3.5" /> In</>
                                    ) : (
                                        <><PlusCircle className="size-3.5" /> Join</>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function FootballDashboard() {
    const { isAdmin } = useViewMode();
    const [viewAsPlayer, setViewAsPlayer] = useState(false);

    if (!isAdmin) return <PlayerDashboard />;

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <div className="flex rounded-lg border border-secondary overflow-hidden text-xs font-semibold">
                    <button
                        onClick={() => setViewAsPlayer(false)}
                        className={cx("px-3 py-1.5 transition duration-100 ease-linear", !viewAsPlayer ? "bg-brand-solid text-white" : "bg-primary text-tertiary hover:bg-primary_hover")}>
                        Admin View
                    </button>
                    <button
                        onClick={() => setViewAsPlayer(true)}
                        className={cx("px-3 py-1.5 transition duration-100 ease-linear border-l border-secondary", viewAsPlayer ? "bg-brand-solid text-white" : "bg-primary text-tertiary hover:bg-primary_hover")}>
                        Player View
                    </button>
                </div>
            </div>
            {viewAsPlayer ? <PlayerDashboard /> : <AdminDashboard />}
        </div>
    );
}
