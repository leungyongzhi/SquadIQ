"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { MatchEvent, Player } from "@/lib/football/types";
import {
    Users01,
    Calendar,
    Trophy01,
    Target01,
    ChevronRight,
    Clock,
} from "@untitledui/icons";
import { cx } from "@/utils/cx";

interface Stats {
    totalPlayers: number;
    upcomingEvents: number;
    completedMatches: number;
    topScorers: { player: Player; goals: number }[];
}

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

    const cells: (number | null)[] = [
        ...Array(firstDay).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];

    return (
        <div className="bg-primary rounded-xl border border-secondary p-5">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-primary">{monthLabel}</h2>
                <div className="flex gap-1">
                    <button
                        onClick={() => setMonth(new Date(year, mon - 1))}
                        className="p-1.5 rounded-lg text-tertiary hover:bg-primary_hover hover:text-primary transition duration-100 ease-linear"
                    >
                        ‹
                    </button>
                    <button
                        onClick={() => setMonth(new Date(year, mon + 1))}
                        className="p-1.5 rounded-lg text-tertiary hover:bg-primary_hover hover:text-primary transition duration-100 ease-linear"
                    >
                        ›
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-7 gap-px">
                {days.map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-quaternary py-1">{d}</div>
                ))}
                {cells.map((day, i) => {
                    const isToday = day === today.getDate() && mon === today.getMonth() && year === today.getFullYear();
                    const hasEvents = day !== null && eventsByDay[day];
                    return (
                        <div
                            key={i}
                            className={cx(
                                "aspect-square flex flex-col items-center justify-start pt-1 rounded-lg text-xs",
                                day === null ? "" : "hover:bg-primary_hover cursor-default",
                                isToday ? "bg-brand-primary_alt" : "",
                            )}
                        >
                            {day !== null && (
                                <>
                                    <span className={cx("font-medium", isToday ? "text-brand-primary" : "text-secondary")}>
                                        {day}
                                    </span>
                                    {hasEvents && (
                                        <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                                            {eventsByDay[day].slice(0, 2).map((ev) => (
                                                <div
                                                    key={ev.id}
                                                    className={cx(
                                                        "size-1.5 rounded-full",
                                                        ev.status === "completed" ? "bg-success-solid" :
                                                        ev.status === "in_progress" ? "bg-warning-solid" :
                                                        "bg-brand-solid"
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="flex gap-4 mt-3 pt-3 border-t border-secondary">
                {[
                    { color: "bg-brand-solid", label: "Scheduled" },
                    { color: "bg-warning-solid", label: "In Progress" },
                    { color: "bg-success-solid", label: "Completed" },
                ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                        <div className={cx("size-2 rounded-full", color)} />
                        <span className="text-xs text-tertiary">{label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function FootballDashboard() {
    const [stats, setStats] = useState<Stats>({
        totalPlayers: 0,
        upcomingEvents: 0,
        completedMatches: 0,
        topScorers: [],
    });
    const [allEvents, setAllEvents] = useState<MatchEvent[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<MatchEvent[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from("user_profiles").select("role").eq("id", user.id).single();
            const admin = profile?.role === "admin";
            setIsAdmin(admin);

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
            const topScorers = Object.values(goalCounts).sort((a, b) => b.goals - a.goals).slice(0, 5);

            setStats({
                totalPlayers: (playersRes.data ?? []).length,
                upcomingEvents: events.filter((e: MatchEvent) => e.status === "scheduled").length,
                completedMatches: events.filter((e: MatchEvent) => e.status === "completed").length,
                topScorers,
            });
            setLoading(false);
        }
        load();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="size-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-primary">Dashboard</h1>
                <p className="text-sm text-tertiary mt-1">Welcome back! Here's what's happening.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard label="Active Players" value={stats.totalPlayers} icon={Users01} color="bg-brand-solid" />
                <StatCard label="Upcoming Matches" value={stats.upcomingEvents} icon={Calendar} color="bg-warning-solid" />
                <StatCard label="Completed Matches" value={stats.completedMatches} icon={Trophy01} color="bg-success-solid" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Calendar — admin only */}
                {isAdmin && <CalendarView events={allEvents} />}

                {/* Upcoming events */}
                <div className="bg-primary rounded-xl border border-secondary p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-semibold text-primary">Upcoming Match Days</h2>
                        <Link href="/events" className="text-sm text-brand-secondary hover:text-brand-secondary_hover transition duration-100 ease-linear flex items-center gap-1">
                            View all <ChevronRight className="size-4" />
                        </Link>
                    </div>
                    {upcomingEvents.length === 0 ? (
                        <p className="text-sm text-tertiary text-center py-8">No upcoming events</p>
                    ) : (
                        <div className="space-y-3">
                            {upcomingEvents.map((event) => (
                                <Link
                                    key={event.id}
                                    href={`/football/events/${event.id}`}
                                    className="flex items-center gap-3 p-3 rounded-lg border border-secondary hover:bg-primary_hover transition duration-100 ease-linear"
                                >
                                    <div className="flex size-9 items-center justify-center rounded-lg bg-brand-secondary flex-shrink-0">
                                        <Calendar className="size-4 text-brand-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-primary truncate">{event.title}</p>
                                        <p className="text-xs text-tertiary flex items-center gap-1 mt-0.5">
                                            <Clock className="size-3" />
                                            {new Date(event.event_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at {event.event_time?.slice(0, 5)}
                                        </p>
                                    </div>
                                    <ChevronRight className="size-4 text-quaternary flex-shrink-0" />
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Top scorers */}
                <div className="bg-primary rounded-xl border border-secondary p-5">
                    <h2 className="text-base font-semibold text-primary mb-4">Top Scorers</h2>
                    {stats.topScorers.length === 0 ? (
                        <p className="text-sm text-tertiary text-center py-8">No goals recorded yet</p>
                    ) : (
                        <div className="space-y-3">
                            {stats.topScorers.map(({ player, goals }, i) => (
                                <div key={player?.id} className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-quaternary w-5">{i + 1}</span>
                                    <div className="size-8 rounded-full bg-brand-secondary flex items-center justify-center text-xs font-semibold text-brand-primary flex-shrink-0">
                                        {player?.name?.[0] ?? "?"}
                                    </div>
                                    <span className="flex-1 text-sm font-medium text-primary truncate">{player?.name ?? "Unknown"}</span>
                                    <div className="flex items-center gap-1">
                                        <Target01 className="size-3.5 text-brand-secondary" />
                                        <span className="text-sm font-semibold text-primary">{goals}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
