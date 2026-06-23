"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Player, MatchEvent } from "@/lib/football/types";
import { Target01, Users01, Trophy01, Star01, TrendUp01, Zap } from "@untitledui/icons";
import { cx } from "@/utils/cx";

interface PlayerStat {
    player: Player;
    goals: number;
    assists: number;
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    potm: number;
}

interface ChemistryPair {
    playerA: Player;
    playerB: Player;
    wins: number;
    matches: number;
}

const TABS = ["Overview", "W/D/L", "Chemistry", "Goals & Assists"] as const;
type Tab = (typeof TABS)[number];

export default function StatsPage() {
    const [tab, setTab] = useState<Tab>("Overview");
    const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
    const [chemistry, setChemistry] = useState<ChemistryPair[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function load() {
            const [playersRes, eventsRes, goalsRes, potmVotesRes] = await Promise.all([
                supabase.from("players").select("*").eq("is_active", true),
                supabase.from("match_events").select("*").eq("status", "completed"),
                supabase.from("goals").select("*"),
                supabase.from("match_events").select("id, player_of_match_id").not("player_of_match_id", "is", null),
            ]);

            const players: Player[] = playersRes.data ?? [];
            const events: MatchEvent[] = eventsRes.data ?? [];
            const goals = goalsRes.data ?? [];

            // Build stats per player
            const statsMap: Record<string, PlayerStat> = {};
            players.forEach((p) => {
                statsMap[p.id] = { player: p, goals: 0, assists: 0, matches: 0, wins: 0, draws: 0, losses: 0, potm: 0 };
            });

            // Goals & assists
            goals.forEach((g: any) => {
                if (statsMap[g.scorer_id]) statsMap[g.scorer_id].goals++;
                if (g.assister_id && statsMap[g.assister_id]) statsMap[g.assister_id].assists++;
            });

            // POTM awards
            (potmVotesRes.data ?? []).forEach((e: any) => {
                if (e.player_of_match_id && statsMap[e.player_of_match_id]) {
                    statsMap[e.player_of_match_id].potm++;
                }
            });

            // Match W/D/L
            events.forEach((event) => {
                const blueWin = event.score_blue > event.score_orange;
                const orangeWin = event.score_orange > event.score_blue;
                const draw = event.score_blue === event.score_orange;

                event.team_blue_ids?.forEach((pid: string) => {
                    if (!statsMap[pid]) return;
                    statsMap[pid].matches++;
                    if (blueWin) statsMap[pid].wins++;
                    else if (draw) statsMap[pid].draws++;
                    else statsMap[pid].losses++;
                });
                event.team_orange_ids?.forEach((pid: string) => {
                    if (!statsMap[pid]) return;
                    statsMap[pid].matches++;
                    if (orangeWin) statsMap[pid].wins++;
                    else if (draw) statsMap[pid].draws++;
                    else statsMap[pid].losses++;
                });
            });

            const statsArr = Object.values(statsMap).filter((s) => s.matches > 0 || s.goals > 0);
            setPlayerStats(statsArr);

            // Chemistry: pairs who played together and their win rate
            const pairMap: Record<string, ChemistryPair> = {};
            events.forEach((event) => {
                const blueWin = event.score_blue > event.score_orange;
                const orangeWin = event.score_orange > event.score_blue;

                const processSide = (teamIds: string[], won: boolean) => {
                    for (let i = 0; i < teamIds.length; i++) {
                        for (let j = i + 1; j < teamIds.length; j++) {
                            const key = [teamIds[i], teamIds[j]].sort().join("|");
                            if (!pairMap[key]) {
                                const pA = players.find((p) => p.id === teamIds[i]);
                                const pB = players.find((p) => p.id === teamIds[j]);
                                if (!pA || !pB) continue;
                                pairMap[key] = { playerA: pA, playerB: pB, wins: 0, matches: 0 };
                            }
                            pairMap[key].matches++;
                            if (won) pairMap[key].wins++;
                        }
                    }
                };

                processSide(event.team_blue_ids ?? [], blueWin);
                processSide(event.team_orange_ids ?? [], orangeWin);
            });

            const chemArr = Object.values(pairMap)
                .filter((p) => p.matches >= 2)
                .sort((a, b) => (b.wins / b.matches) - (a.wins / a.matches));
            setChemistry(chemArr.slice(0, 20));
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

    const topScorers = [...playerStats].sort((a, b) => b.goals - a.goals).slice(0, 10);
    const topAssisters = [...playerStats].sort((a, b) => b.assists - a.assists).slice(0, 10);
    const topAttendance = [...playerStats].sort((a, b) => b.matches - a.matches).slice(0, 10);
    const topPotm = [...playerStats].sort((a, b) => b.potm - a.potm).filter((s) => s.potm > 0).slice(0, 5);
    const topWinRate = [...playerStats]
        .filter((s) => s.matches >= 3)
        .sort((a, b) => b.wins / b.matches - a.wins / a.matches)
        .slice(0, 10);
    const topGA = [...playerStats]
        .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))
        .slice(0, 10);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-primary">Stats</h1>
                <p className="text-sm text-tertiary mt-1">Performance analytics across all completed matches</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-secondary rounded-lg p-1 w-fit overflow-x-auto">
                {TABS.map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={cx(
                            "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition duration-100 ease-linear",
                            tab === t ? "bg-primary text-primary shadow-sm" : "text-tertiary hover:text-secondary",
                        )}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {tab === "Overview" && (
                <div className="grid sm:grid-cols-2 gap-6">
                    <StatTable
                        title="Top Scorers"
                        icon={Target01}
                        rows={topScorers.map((s) => ({
                            name: s.player.name,
                            value: s.goals,
                            label: "goals",
                        }))}
                    />
                    <StatTable
                        title="Top Assisters"
                        icon={Zap}
                        rows={topAssisters.map((s) => ({
                            name: s.player.name,
                            value: s.assists,
                            label: "assists",
                        }))}
                    />
                    <StatTable
                        title="Most Appearances"
                        icon={Users01}
                        rows={topAttendance.map((s) => ({
                            name: s.player.name,
                            value: s.matches,
                            label: "matches",
                        }))}
                    />
                    <StatTable
                        title="POTM Awards"
                        icon={Star01}
                        rows={topPotm.map((s) => ({
                            name: s.player.name,
                            value: s.potm,
                            label: "awards",
                        }))}
                        emptyText="No POTM awarded yet"
                    />
                </div>
            )}

            {tab === "W/D/L" && (
                <div className="bg-primary rounded-xl border border-secondary overflow-hidden">
                    <div className="p-4 border-b border-secondary">
                        <h2 className="text-base font-semibold text-primary flex items-center gap-2">
                            <TrendUp01 className="size-5 text-tertiary" />
                            Win / Draw / Loss
                        </h2>
                        <p className="text-xs text-tertiary mt-1">Min. 3 matches to appear</p>
                    </div>
                    <div className="divide-y divide-secondary">
                        {topWinRate.map((s, i) => {
                            const winPct = s.matches > 0 ? (s.wins / s.matches) * 100 : 0;
                            return (
                                <div key={s.player.id} className="flex items-center gap-4 px-4 py-3">
                                    <span className="text-sm text-quaternary w-5 font-semibold">{i + 1}</span>
                                    <span className="flex-1 text-sm font-medium text-primary">{s.player.name}</span>
                                    <div className="flex items-center gap-3 text-xs">
                                        <span className="text-success-primary font-semibold">{s.wins}W</span>
                                        <span className="text-quaternary">{s.draws}D</span>
                                        <span className="text-error-primary">{s.losses}L</span>
                                        <span className="text-tertiary w-8 text-right">{s.matches}M</span>
                                    </div>
                                    <div className="w-24">
                                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-success-solid rounded-full"
                                                style={{ width: `${winPct}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-tertiary text-right mt-0.5">{Math.round(winPct)}%</p>
                                    </div>
                                </div>
                            );
                        })}
                        {topWinRate.length === 0 && (
                            <p className="text-sm text-tertiary text-center py-12">Not enough data yet</p>
                        )}
                    </div>
                </div>
            )}

            {tab === "Chemistry" && (
                <div className="space-y-4">
                    <div className="bg-primary rounded-xl border border-secondary overflow-hidden">
                        <div className="p-4 border-b border-secondary">
                            <h2 className="text-base font-semibold text-primary">Best Chemistry Pairs</h2>
                            <p className="text-xs text-tertiary mt-1">Players who win the most when on the same team (min. 2 matches together)</p>
                        </div>
                        <div className="divide-y divide-secondary">
                            {chemistry.map((pair, i) => {
                                const winPct = pair.matches > 0 ? (pair.wins / pair.matches) * 100 : 0;
                                return (
                                    <div key={i} className="flex items-center gap-4 px-4 py-3">
                                        <span className="text-sm text-quaternary w-5 font-semibold">{i + 1}</span>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-primary">
                                                {pair.playerA.name} & {pair.playerB.name}
                                            </p>
                                            <p className="text-xs text-tertiary">{pair.wins}W / {pair.matches - pair.wins}L in {pair.matches} matches</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-success-primary">{Math.round(winPct)}%</p>
                                            <p className="text-xs text-tertiary">win rate</p>
                                        </div>
                                    </div>
                                );
                            })}
                            {chemistry.length === 0 && (
                                <p className="text-sm text-tertiary text-center py-12">Not enough match data yet</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {tab === "Goals & Assists" && (
                <div className="bg-primary rounded-xl border border-secondary overflow-hidden">
                    <div className="p-4 border-b border-secondary">
                        <h2 className="text-base font-semibold text-primary">Goals + Assists Leaderboard</h2>
                    </div>
                    <div className="divide-y divide-secondary">
                        {topGA.map((s, i) => {
                            const ga = s.goals + s.assists;
                            const gpg = s.matches > 0 ? (s.goals / s.matches).toFixed(2) : "0.00";
                            return (
                                <div key={s.player.id} className="flex items-center gap-4 px-4 py-3">
                                    <span className="text-sm text-quaternary w-5 font-semibold">{i + 1}</span>
                                    <span className="flex-1 text-sm font-medium text-primary">{s.player.name}</span>
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="text-center">
                                            <p className="font-bold text-primary">{s.goals}</p>
                                            <p className="text-xs text-quaternary">G</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="font-bold text-primary">{s.assists}</p>
                                            <p className="text-xs text-quaternary">A</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="font-bold text-brand-secondary">{ga}</p>
                                            <p className="text-xs text-quaternary">G+A</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="font-semibold text-tertiary">{gpg}</p>
                                            <p className="text-xs text-quaternary">G/M</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {topGA.length === 0 && (
                            <p className="text-sm text-tertiary text-center py-12">No goals recorded yet</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatTable({ title, icon: Icon, rows, emptyText }: {
    title: string;
    icon: React.FC<any>;
    rows: { name: string; value: number; label: string }[];
    emptyText?: string;
}) {
    return (
        <div className="bg-primary rounded-xl border border-secondary overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-secondary">
                <Icon className="size-4 text-tertiary" />
                <h3 className="text-sm font-semibold text-primary">{title}</h3>
            </div>
            <div className="divide-y divide-secondary">
                {rows.length === 0 ? (
                    <p className="text-sm text-tertiary text-center py-8">{emptyText ?? "No data yet"}</p>
                ) : (
                    rows.map((row, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                            <span className="text-sm text-quaternary w-4 font-semibold">{i + 1}</span>
                            <span className="flex-1 text-sm font-medium text-primary">{row.name}</span>
                            <span className="text-sm font-bold text-primary">{row.value}</span>
                            <span className="text-xs text-tertiary">{row.label}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
