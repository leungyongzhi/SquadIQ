"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useViewMode } from "@/app/(app)/layout";
import type { MatchEvent, PlayerForTeam, GeneratedTeams } from "@/lib/football/types";
import { generateBalancedTeams } from "@/lib/football/team-generator";
import {
    ArrowLeft, Calendar, MarkerPin01, Clock, Users01, Trophy01,
    RefreshCw04, CheckCircle, XCircle, Lightning01, Star01, Edit01, Check, SearchMd,
    Plus, Minus, Target01, ChevronDown,
} from "@untitledui/icons";
import { cx } from "@/utils/cx";

type AttendanceStatus = "late" | "no_show" | null;
type Enrollment = {
    id: string; player_id: string; is_enrolled: boolean;
    form_rating: "hot" | "neutral" | "cold"; has_paid: boolean;
    attendance_status: AttendanceStatus;
    player: { id: string; name: string; avatar_url: string | null };
};
type CommunityMemberBasic = {
    player_id: string; rating: number; position_bias: number;
    is_goalkeeper: boolean; gk_rating: number | null; outfield_rating: number | null;
    player: { id: string; name: string; avatar_url: string | null };
};
type GoalRow = { id: string; scorer_id: string | null; assister_id: string | null; team: "blue" | "orange" | null; is_own_goal: boolean };
type PlayerGoalStats = { goals: number; assists: number };

// Sentinel for a goal that counts toward the score but is credited to no player
const UNCLAIMED = "__unclaimed__";

function AvatarCircle({ src, name, size = 8 }: { src: string | null; name: string; size?: number }) {
    const sz = `size-${size}`;
    return (
        <div className={cx(sz, "rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-secondary flex-shrink-0")}>
            {src ? <img src={src} className={cx(sz, "rounded-full object-cover")} alt="" /> : name[0]}
        </div>
    );
}
function PositionBadge({ bias, isGK }: { bias: number; isGK?: boolean }) {
    if (isGK) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-tertiary whitespace-nowrap">GK</span>;
    const labels = ["DEF+", "DEF", "BAL", "ATK", "ATK+"];
    const label = labels[Math.min(Math.max(bias - 1, 0), 4)];
    const cls = bias <= 2 ? "bg-brand-secondary text-brand-primary" : bias === 3 ? "bg-secondary text-tertiary" : "bg-error-secondary text-error-primary";
    return <span className={cx("text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap", cls)}>{label}</span>;
}
function PayBadge({ hasPaid, isAdmin, onClick, loading }: { hasPaid: boolean; isAdmin: boolean; onClick?: () => void; loading?: boolean }) {
    return (
        <button onClick={isAdmin ? onClick : undefined} disabled={!isAdmin || loading}
            className={cx("flex items-center gap-1 text-xs font-medium whitespace-nowrap transition duration-100 ease-linear", hasPaid ? "text-success-primary" : "text-quaternary", isAdmin ? "cursor-pointer hover:opacity-70" : "cursor-default", loading && "opacity-50")}>
            {hasPaid ? <><CheckCircle className="size-3.5 flex-shrink-0" /> Paid</> : <><XCircle className="size-3.5 flex-shrink-0" /> Not paid</>}
        </button>
    );
}
function StatCounter({ value, onInc, onDec, label }: { value: number; onInc: () => void; onDec: () => void; label: string }) {
    return (
        <div className="flex items-center gap-1 border border-secondary rounded-lg px-1.5 py-1 bg-primary">
            <span className="text-xs font-semibold text-quaternary w-3.5">{label}</span>
            <button onClick={onDec} disabled={value <= 0} className="size-5 rounded flex items-center justify-center text-tertiary hover:bg-primary_hover disabled:opacity-30 transition duration-100 ease-linear">
                <Minus className="size-3" />
            </button>
            <span className="text-sm font-semibold text-primary w-4 text-center">{value}</span>
            <button onClick={onInc} className="size-5 rounded flex items-center justify-center text-tertiary hover:bg-primary_hover transition duration-100 ease-linear">
                <Plus className="size-3" />
            </button>
        </div>
    );
}
function TeamListVertical({ title, color, players, gkId }: { title: string; color: "blue" | "orange"; players: PlayerForTeam[]; gkId: string | null }) {
    const accent = color === "blue" ? "bg-brand-secondary text-brand-primary" : "bg-warning-primary text-warning-primary";
    return (
        <div className="border-b border-secondary last:border-b-0">
            <div className={cx("px-4 py-2 text-xs font-semibold", accent)}>{title}</div>
            <div className="divide-y divide-secondary">
                {players.map((p) => (
                    <div key={p.player_id} className="flex items-center gap-2.5 px-4 py-2">
                        <AvatarCircle src={p.avatar_url} name={p.name} size={6} />
                        <span className="text-sm text-primary flex-1 truncate">{p.name}</span>
                        <PositionBadge bias={p.position_bias} isGK={p.player_id === gkId} />
                    </div>
                ))}
            </div>
        </div>
    );
}
function TeamColumn({ title, color, players, gkId }: { title: string; color: "blue" | "orange"; players: PlayerForTeam[]; gkId: string | null }) {
    const accent = color === "blue" ? "bg-brand-secondary text-brand-primary border-brand" : "bg-warning-primary text-warning-primary border-warning";
    return (
        <div className="flex-1 min-w-0">
            <div className={cx("text-sm font-semibold px-3 py-2 rounded-t-lg border border-b-0", accent)}>{title} ({players.length})</div>
            <div className="border border-secondary rounded-b-lg divide-y divide-secondary">
                {players.map((p) => (
                    <div key={p.player_id} className="flex items-center gap-2.5 px-3 py-2">
                        <AvatarCircle src={p.avatar_url} name={p.name} size={7} />
                        <span className="text-sm text-primary flex-1 truncate">{p.name}</span>
                        <PositionBadge bias={p.position_bias} isGK={p.player_id === gkId} />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function EventDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const supabase = createClient();
    const [event, setEvent] = useState<MatchEvent | null>(null);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [communityMembers, setCommunityMembers] = useState<CommunityMemberBasic[]>([]);
    const { isAdmin } = useViewMode();
    const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [teams, setTeams] = useState<GeneratedTeams | null>(null);
    const [savingTeams, setSavingTeams] = useState(false);
    const [editScore, setEditScore] = useState(false);
    const [score, setScore] = useState({ blue: 0, orange: 0 });
    const [votingForPotm, setVotingForPotm] = useState(false);
    const [myEnrollment, setMyEnrollment] = useState<Enrollment | null>(null);
    const [actionInProgress, setActionInProgress] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [goalRows, setGoalRows] = useState<GoalRow[]>([]);
    const [enrolledExpanded, setEnrolledExpanded] = useState(false);
    const [attendanceCounts, setAttendanceCounts] = useState<Record<string, number>>({});
    const [addingGoal, setAddingGoal] = useState(false);
    const [newGoalTeam, setNewGoalTeam] = useState<"blue" | "orange" | null>(null);
    const [newGoalScorer, setNewGoalScorer] = useState("");
    const [newGoalAssister, setNewGoalAssister] = useState("");
    const [savingGoal, setSavingGoal] = useState(false);
    const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
    const [editGoalAssister, setEditGoalAssister] = useState("");
    const [newGoalIsOwnGoal, setNewGoalIsOwnGoal] = useState(false);

    const load = async () => {
        const [{ data: ev }, { data: authData }] = await Promise.all([
            supabase.from("match_events").select("*").eq("id", id).single(),
            supabase.auth.getUser(),
        ]);
        if (!ev) { router.push("/events"); return; }
        setEvent(ev); setScore({ blue: ev.score_blue ?? 0, orange: ev.score_orange ?? 0 });
        const user = authData?.user;
        if (!user) { setLoading(false); return; }
        const [{ data: profile }, { data: enr }, { data: goals }] = await Promise.all([
            supabase.from("user_profiles").select("role, player_id").eq("id", user.id).single(),
            supabase.from("event_enrollments").select("id, player_id, is_enrolled, form_rating, has_paid, attendance_status, player:players(id, name, avatar_url)").eq("event_id", id),
            supabase.from("goals").select("id, scorer_id, assister_id, team, is_own_goal").eq("event_id", id),
        ]);
        setMyPlayerId(profile?.player_id ?? null);
        const enrList = (enr as unknown as Enrollment[]) ?? [];
        setEnrollments(enrList);
        setMyEnrollment(enrList.find((e) => e.player_id === profile?.player_id) ?? null);
        setGoalRows((goals ?? []) as GoalRow[]);
        if (ev.community_id) {
            const [{ data: members }, { data: recentEvents }] = await Promise.all([
                supabase.from("community_members")
                    .select("player_id, rating, position_bias, is_goalkeeper, gk_rating, outfield_rating, player:players(id, name, avatar_url)")
                    .eq("community_id", ev.community_id),
                supabase.from("match_events")
                    .select("team_blue_ids, team_orange_ids")
                    .eq("community_id", ev.community_id)
                    .neq("id", id)
                    .in("status", ["completed", "in_progress"])
                    .order("event_date", { ascending: false })
                    .limit(3),
            ]);
            setCommunityMembers((members as unknown as CommunityMemberBasic[]) ?? []);
            // build attendance counts from last 3 events
            const counts: Record<string, number> = {};
            (recentEvents ?? []).forEach((ev: any) => {
                [...(ev.team_blue_ids ?? []), ...(ev.team_orange_ids ?? [])].forEach((pid: string) => {
                    counts[pid] = (counts[pid] ?? 0) + 1;
                });
            });
            setAttendanceCounts(counts);
        }
        setLoading(false);
    };
    useEffect(() => { load(); }, [id]);

    // Derive goal/assist counts per player from goalRows
    const goalStats = (playerId: string): PlayerGoalStats => ({
        goals: goalRows.filter((g) => g.scorer_id === playerId && !g.is_own_goal).length,
        assists: goalRows.filter((g) => g.assister_id === playerId).length,
    });


    const toggleEnroll = async () => {
        if (!myPlayerId) return;
        if (myEnrollment) { await supabase.from("event_enrollments").update({ is_enrolled: !myEnrollment.is_enrolled }).eq("id", myEnrollment.id); }
        else { await supabase.from("event_enrollments").insert({ event_id: id, player_id: myPlayerId, is_enrolled: true, form_rating: "neutral", has_paid: false }); }
        await load();
    };
    const adminToggleEnroll = async (playerId: string) => {
        const key = `enroll-${playerId}`; setActionInProgress(key);
        const existing = enrollments.find((e) => e.player_id === playerId);
        if (existing) { await supabase.from("event_enrollments").update({ is_enrolled: !existing.is_enrolled }).eq("id", existing.id); }
        else { await supabase.from("event_enrollments").insert({ event_id: id, player_id: playerId, is_enrolled: true, form_rating: "neutral", has_paid: false }); }
        await load(); setActionInProgress(null);
    };
    const adminTogglePaid = async (enrollmentId: string, hasPaid: boolean) => {
        const key = `paid-${enrollmentId}`; setActionInProgress(key);
        await supabase.from("event_enrollments").update({ has_paid: !hasPaid }).eq("id", enrollmentId);
        await load(); setActionInProgress(null);
    };
    const setAttendance = async (enrollmentId: string, status: AttendanceStatus, current: AttendanceStatus) => {
        const key = `att-${enrollmentId}`; setActionInProgress(key);
        await supabase.from("event_enrollments").update({ attendance_status: current === status ? null : status }).eq("id", enrollmentId);
        await load(); setActionInProgress(null);
    };
    const addGoalRow = async () => {
        if (!newGoalScorer) return;
        // For own goals, the benefiting team is opposite the scorer's team
        let benefitingTeam = newGoalTeam;
        if (newGoalIsOwnGoal) {
            const scorerInBlue = (event?.team_blue_ids ?? []).includes(newGoalScorer);
            const scorerInOrange = (event?.team_orange_ids ?? []).includes(newGoalScorer);
            benefitingTeam = scorerInBlue ? "orange" : scorerInOrange ? "blue" : newGoalTeam;
        }
        if (!benefitingTeam) return;
        const isUnclaimed = newGoalScorer === UNCLAIMED;
        setSavingGoal(true);
        const { error: goalError } = await supabase.from("goals").insert({
            event_id: id,
            scorer_id: isUnclaimed ? null : newGoalScorer,
            assister_id: (isUnclaimed || newGoalIsOwnGoal) ? null : (newGoalAssister || null),
            team: benefitingTeam,
            is_own_goal: newGoalIsOwnGoal,
        });
        if (goalError) {
            setSavingGoal(false);
            alert(`Couldn't save goal: ${goalError.message}${isUnclaimed ? "\n\nUnclaimed goals need migration 006 — run it in Supabase." : ""}`);
            return;
        }
        const blueCount = goalRows.filter((g) => g.team === "blue").length + (benefitingTeam === "blue" ? 1 : 0);
        const orangeCount = goalRows.filter((g) => g.team === "orange").length + (benefitingTeam === "orange" ? 1 : 0);
        await supabase.from("match_events").update({ score_blue: blueCount, score_orange: orangeCount, status: "in_progress" }).eq("id", id);
        setAddingGoal(false); setNewGoalTeam(null); setNewGoalScorer(""); setNewGoalAssister(""); setNewGoalIsOwnGoal(false);
        setSavingGoal(false); await load();
    };
    const saveGoalEdit = async (goalId: string) => {
        await supabase.from("goals").update({ assister_id: editGoalAssister || null }).eq("id", goalId);
        setEditingGoalId(null); setEditGoalAssister(""); await load();
    };
    const removeGoalRow = async (goalId: string) => {
        await supabase.from("goals").delete().eq("id", goalId);
        const remaining = goalRows.filter((g) => g.id !== goalId);
        const blueCount = remaining.filter((g) => g.team === "blue").length;
        const orangeCount = remaining.filter((g) => g.team === "orange").length;
        await supabase.from("match_events").update({ score_blue: blueCount, score_orange: orangeCount }).eq("id", id);
        await load();
    };
    const assignTeam = async (playerId: string, team: "blue" | "orange" | null) => {
        if (!event) return;
        const key = `team-${playerId}`; setActionInProgress(key);
        let blueIds = [...(event.team_blue_ids ?? [])].filter((pid) => pid !== playerId);
        let orangeIds = [...(event.team_orange_ids ?? [])].filter((pid) => pid !== playerId);
        if (team === "blue") blueIds.push(playerId);
        else if (team === "orange") orangeIds.push(playerId);
        await supabase.from("match_events").update({ team_blue_ids: blueIds, team_orange_ids: orangeIds }).eq("id", id);
        await load(); setActionInProgress(null);
    };
    const handleGenerateTeams = async () => {
        const enrolled = enrollments.filter((e) => e.is_enrolled !== false);
        if (enrolled.length < 2) return;
        const playerIds = enrolled.map((e) => e.player_id);
        let playerDataMap: Record<string, PlayerForTeam> = {};
        if (event?.community_id) {
            const { data: members } = await supabase.from("community_members").select("*").eq("community_id", event.community_id).in("player_id", playerIds);
            (members ?? []).forEach((m) => {
                const enr = enrolled.find((e) => e.player_id === m.player_id);
                const cm = communityMembers.find((c) => c.player_id === m.player_id);
                playerDataMap[m.player_id] = { ...m, name: enr?.player.name ?? cm?.player.name ?? "", avatar_url: enr?.player.avatar_url ?? cm?.player.avatar_url ?? null, form: enr?.form_rating ?? "neutral" };
            });
        } else {
            const { data: players } = await supabase.from("players").select("*").in("id", playerIds);
            (players ?? []).forEach((p) => {
                const enr = enrolled.find((e) => e.player_id === p.id);
                playerDataMap[p.id] = { player_id: p.id, community_id: "", id: p.id, created_at: "", role: "player", rating: p.rating, position_bias: p.position_bias ?? 3, is_goalkeeper: p.is_goalkeeper ?? false, gk_rating: p.gk_rating, outfield_rating: p.outfield_rating, name: p.name, avatar_url: p.avatar_url, form: enr?.form_rating ?? "neutral" };
            });
        }
        setTeams(generateBalancedTeams(Object.values(playerDataMap)));
    };
    const saveTeams = async () => {
        if (!teams) return; setSavingTeams(true);
        await supabase.from("match_events").update({ team_blue_ids: teams.blue.map((p) => p.player_id), team_orange_ids: teams.orange.map((p) => p.player_id), gk_blue_id: teams.gkBlueId, gk_orange_id: teams.gkOrangeId, status: "in_progress" }).eq("id", id);
        await load(); setSavingTeams(false); setTeams(null);
    };
    const saveManualTeams = async () => {
        if (!event) return; setSavingTeams(true);
        await supabase.from("match_events").update({ team_blue_ids: event.team_blue_ids ?? [], team_orange_ids: event.team_orange_ids ?? [], status: "in_progress" }).eq("id", id);
        await load(); setSavingTeams(false);
    };
    const saveScore = async () => {
        await supabase.from("match_events").update({ score_blue: score.blue, score_orange: score.orange, status: "completed" }).eq("id", id);
        setEditScore(false); await load();
    };
    const toggleVoting = async () => { await supabase.from("match_events").update({ voting_open: !event?.voting_open }).eq("id", id); await load(); };
    const markCompleted = async () => { await supabase.from("match_events").update({ status: "completed" }).eq("id", id); await load(); };
    const votePotm = async (playerId: string) => {
        if (!myPlayerId) return; setVotingForPotm(true);
        await supabase.from("potm_votes").upsert({ event_id: id, voter_player_id: myPlayerId, voted_player_id: playerId }, { onConflict: "event_id,voter_player_id" });
        setVotingForPotm(false); await load();
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="size-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
    if (!event) return null;

    const enrolledPlayers = enrollments.filter((e) => e.is_enrolled !== false);
    const declinedPlayers = enrollments.filter((e) => e.is_enrolled === false);
    const amEnrolled = myEnrollment != null && myEnrollment.is_enrolled !== false;
    const enrolledIds = new Set(enrolledPlayers.map((e) => e.player_id));

    // Which team is the current player on (if any) — lets players log their own goals
    const myTeam: "blue" | "orange" | null = myPlayerId
        ? (event.team_blue_ids ?? []).includes(myPlayerId) ? "blue"
            : (event.team_orange_ids ?? []).includes(myPlayerId) ? "orange" : null
        : null;
    const amInMatch = myTeam !== null;

    const playerName = (pid: string | null) => {
        if (!pid) return null;
        return enrollments.find((e) => e.player_id === pid)?.player.name
            ?? communityMembers.find((m) => m.player_id === pid)?.player.name
            ?? "Unknown";
    };
    const teamPlayers = (team: "blue" | "orange") => {
        const ids = team === "blue" ? (event.team_blue_ids ?? []) : (event.team_orange_ids ?? []);
        const pool = ids.length > 0 ? enrolledPlayers.filter((e) => ids.includes(e.player_id)) : enrolledPlayers;
        return pool.sort((a, b) => a.player.name.localeCompare(b.player.name));
    };
    const scorerPlayers = newGoalTeam ? teamPlayers(newGoalTeam) : [];
    const assisterPlayers = scorerPlayers.filter((p) => p.player_id !== newGoalScorer);

    const rosterWithEnrollment = communityMembers.map((m) => ({ member: m, enrollment: enrollments.find((e) => e.player_id === m.player_id) ?? null }));
    const enrolledRoster = rosterWithEnrollment
        .filter((r) => r.enrollment && r.enrollment.is_enrolled !== false)
        .sort((a, b) => a.member.player.name.localeCompare(b.member.player.name));

    // Sort available players: regulars (2-3 of last 3) → recent (1) → others (0), alpha within each group
    const notEnrolledRoster = rosterWithEnrollment
        .filter((r) => !enrolledIds.has(r.member.player_id))
        .filter((r) => !search || r.member.player.name.toLowerCase().includes(search.toLowerCase()));

    const regularRoster = notEnrolledRoster
        .filter((r) => (attendanceCounts[r.member.player_id] ?? 0) >= 2)
        .sort((a, b) => a.member.player.name.localeCompare(b.member.player.name));
    const otherRoster = notEnrolledRoster
        .filter((r) => (attendanceCounts[r.member.player_id] ?? 0) < 2)
        .sort((a, b) => a.member.player.name.localeCompare(b.member.player.name));

    const toPlayerForTeam = (e: Enrollment): PlayerForTeam => ({ player_id: e.player_id, community_id: event.community_id ?? "", id: e.player_id, created_at: "", role: "player", rating: 3, position_bias: 3, is_goalkeeper: false, gk_rating: null, outfield_rating: null, name: e.player.name, avatar_url: e.player.avatar_url, form: e.form_rating ?? "neutral" });
    const memberRating = (pid: string) => communityMembers.find((m) => m.player_id === pid)?.rating ?? 3;
    const blueRatingTotal = (event.team_blue_ids ?? []).reduce((sum, pid) => sum + memberRating(pid), 0);
    const orangeRatingTotal = (event.team_orange_ids ?? []).reduce((sum, pid) => sum + memberRating(pid), 0);
    const savedBlue = event.team_blue_ids ? enrollments.filter((e) => event.team_blue_ids!.includes(e.player_id)) : [];
    const savedOrange = event.team_orange_ids ? enrollments.filter((e) => event.team_orange_ids!.includes(e.player_id)) : [];



    return (
        <div className="max-w-6xl">
            <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-tertiary hover:text-primary transition duration-100 ease-linear mb-6"><ArrowLeft className="size-4" />Match Days</Link>

            <div className="flex gap-6 items-start">
                {/* ── Left column ── */}
                <div className="flex-1 min-w-0 space-y-6">


                    {/* ── Event card ── */}
                    <div className="bg-primary rounded-2xl border border-secondary p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={cx("text-xs font-medium px-2 py-0.5 rounded-full", event.status === "scheduled" ? "bg-brand-secondary text-brand-primary" : event.status === "in_progress" ? "bg-warning-primary text-warning-primary" : "bg-success-primary text-success-primary")}>
                                        {event.status === "in_progress" ? "In Progress" : event.status === "completed" ? "Completed" : "Scheduled"}
                                    </span>
                                </div>
                                <h1 className="text-2xl font-semibold text-primary">{event.title}</h1>
                                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-tertiary">
                                    <span className="flex items-center gap-1.5"><Calendar className="size-4" />{new Date(event.event_date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
                                    {event.event_time && <span className="flex items-center gap-1.5"><Clock className="size-4" />{event.event_time.slice(0, 5)}</span>}
                                    {event.location && <span className="flex items-center gap-1.5"><MarkerPin01 className="size-4" />{event.location}</span>}
                                </div>
                                {event.maps_link && (
                                    <a href={event.maps_link} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 mt-2 text-sm text-brand-secondary hover:text-brand-primary transition duration-100 ease-linear">
                                        <MarkerPin01 className="size-4" /> Open in Google Maps
                                    </a>
                                )}
                            </div>
                            {myPlayerId && event.status === "scheduled" && (
                                <button onClick={toggleEnroll} className={cx("flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition duration-100 ease-linear flex-shrink-0", amEnrolled ? "bg-error-secondary text-error-primary hover:bg-error-primary" : "bg-brand-solid hover:bg-brand-solid_hover text-white")}>
                                    {amEnrolled ? <><XCircle className="size-4" />Leave</> : <><CheckCircle className="size-4" />Join</>}
                                </button>
                            )}
                        </div>
                        {(event.status === "in_progress" || event.status === "completed") && (() => {
                            const blueGoals = goalRows.filter((g) => g.team === "blue");
                            const orangeGoals = goalRows.filter((g) => g.team === "orange");
                            const GoalLine = ({ g, align }: { g: GoalRow; align: "left" | "right" }) => {
                                const isEditing = editingGoalId === g.id;
                                const goalTeamPlayers = g.team
                                    ? teamPlayers(g.team).filter((p) => p.player_id !== g.scorer_id)
                                    : enrolledPlayers.filter((p) => p.player_id !== g.scorer_id);
                                const r = align === "right";
                                // Teammates (same team) and admins can edit the assist; only admins can delete
                                const canEditAssist = !g.is_own_goal && (isAdmin || (amInMatch && myTeam === g.team));
                                const toggleEdit = () => { if (isEditing) { setEditingGoalId(null); setEditGoalAssister(""); } else { setEditingGoalId(g.id); setEditGoalAssister(g.assister_id ?? ""); } };
                                const Controls = () => (
                                    <div className="flex items-center gap-0.5">
                                        {canEditAssist && <button onClick={toggleEdit} className="text-quaternary hover:text-secondary transition duration-100 ease-linear"><Edit01 className="size-3" /></button>}
                                        {isAdmin && <button onClick={() => removeGoalRow(g.id)} className="text-quaternary hover:text-error-primary transition duration-100 ease-linear"><XCircle className="size-3.5" /></button>}
                                    </div>
                                );
                                const showControls = canEditAssist || isAdmin;
                                return (
                                    <div className={cx("mb-1.5", r ? "text-right" : "text-left")}>
                                        {/* Scorer row */}
                                        <div className={cx("flex items-center gap-1", r && "justify-end")}>
                                            {showControls && !r && <Controls />}
                                            <span className={cx("text-sm font-semibold", g.scorer_id ? "text-primary" : "text-tertiary italic")}>{playerName(g.scorer_id) ?? "Unclaimed"}</span>
                                            {g.is_own_goal && <span className="text-xs font-bold text-error-primary">(OG)</span>}
                                            {showControls && r && <Controls />}
                                        </div>
                                        {/* Assister row */}
                                        {!g.is_own_goal && g.assister_id && (
                                            <p className="text-xs text-tertiary">{playerName(g.assister_id)}</p>
                                        )}
                                        {/* Edit form */}
                                        {isEditing && (
                                            <div className={cx("flex items-center gap-2 mt-1", r && "justify-end")}>
                                                <select value={editGoalAssister} onChange={(e) => setEditGoalAssister(e.target.value)}
                                                    className="text-xs rounded-lg border border-primary bg-primary text-primary px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand w-32">
                                                    <option value="">No assist</option>
                                                    {goalTeamPlayers.map((p) => <option key={p.player_id} value={p.player_id}>{p.player.name}</option>)}
                                                </select>
                                                <button onClick={() => saveGoalEdit(g.id)} className="flex items-center gap-1 px-2 py-1 bg-brand-solid text-white text-xs font-semibold rounded-lg transition duration-100 ease-linear">
                                                    <Check className="size-3" /> Save
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            };
                            return (
                                <div className="mt-6 space-y-2">
                                    {/* Scoreboard + goal lists — shared 3-column grid so names align under scores */}
                                    <div className="grid grid-cols-[1fr_auto_1fr]">
                                        {/* Score row */}
                                        <div className="flex items-center justify-end gap-3 pb-2">
                                            <p className="text-lg font-bold" style={{ color: '#1570EF' }}>BLUE</p>
                                            <p className="text-5xl font-bold text-primary">{blueGoals.length > 0 ? blueGoals.length : (event.score_blue ?? 0)}</p>
                                        </div>
                                        <p className="text-4xl font-bold text-quaternary px-4 pb-2 self-center">-</p>
                                        <div className="flex items-center justify-start gap-3 pb-2">
                                            <p className="text-5xl font-bold text-primary">{orangeGoals.length > 0 ? orangeGoals.length : (event.score_orange ?? 0)}</p>
                                            <p className="text-lg font-bold text-warning-primary">ORANGE</p>
                                        </div>
                                        {/* Goal lists */}
                                        <div className="space-y-1 text-right group pr-4">{blueGoals.map((g) => <GoalLine key={g.id} g={g} align="right" />)}</div>
                                        <div className="px-4 flex justify-center"><div className="w-px bg-secondary self-stretch" /></div>
                                        <div className="space-y-1 group pl-4">{orangeGoals.map((g) => <GoalLine key={g.id} g={g} align="left" />)}</div>
                                    </div>

                                    {/* Add Goal — admins (full control) or players in the match (their own goal) */}
                                    {(isAdmin || amInMatch) && (
                                        <div className="border-t border-secondary pt-4 space-y-3">
                                            {/* Add goal form */}
                                            {addingGoal ? (
                                                isAdmin ? (
                                                <div className="space-y-3">
                                                    {/* Own goal toggle */}
                                                    <button
                                                        onClick={() => { setNewGoalIsOwnGoal((v) => !v); setNewGoalTeam(null); setNewGoalScorer(""); setNewGoalAssister(""); }}
                                                        className={cx("w-full py-1.5 rounded-lg text-xs font-semibold border transition duration-100 ease-linear",
                                                            newGoalIsOwnGoal ? "bg-error-solid text-white border-error" : "border-secondary bg-primary text-quaternary hover:border-error hover:text-error-primary")}>
                                                        {newGoalIsOwnGoal ? "✓ Own Goal" : "Own Goal?"}
                                                    </button>
                                                    {/* Team selector */}
                                                    {!newGoalIsOwnGoal && (
                                                        <div className="flex gap-2">
                                                            {(["blue", "orange"] as const).map((t) => (
                                                                <button key={t} onClick={() => { setNewGoalTeam(t); setNewGoalScorer(""); setNewGoalAssister(""); }}
                                                                    className={cx("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border transition duration-100 ease-linear",
                                                                        t === "blue"
                                                                            ? newGoalTeam === "blue" ? "bg-[#1570EF] border-[#1570EF] text-white" : "border-[#1570EF] text-[#1570EF] bg-primary hover:bg-[#EFF4FF]"
                                                                            : newGoalTeam === "orange" ? "bg-warning-solid border-warning-solid text-white" : "border-warning text-warning-primary bg-primary hover:bg-warning-primary")}>
                                                                    <span className={cx("size-2 rounded-full flex-shrink-0", t === "orange" ? "bg-warning-solid" : "bg-[#1570EF]")} />
                                                                    {t === "blue" ? "Blue" : "Orange"}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {/* Scorer */}
                                                    {(newGoalIsOwnGoal || newGoalTeam) && (
                                                        <div>
                                                            <label className="text-xs font-medium text-tertiary block mb-1">{newGoalIsOwnGoal ? "Player (own goal)" : "Scorer *"}</label>
                                                            <select value={newGoalScorer} onChange={(e) => { setNewGoalScorer(e.target.value); setNewGoalAssister(""); }}
                                                                className="w-full text-sm rounded-lg border border-primary bg-primary text-primary px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand">
                                                                <option value="">Select player…</option>
                                                                {!newGoalIsOwnGoal && <option value={UNCLAIMED}>Unclaimed (no scorer)</option>}
                                                                {(newGoalIsOwnGoal ? enrolledPlayers : scorerPlayers).map((p) => (
                                                                    <option key={p.player_id} value={p.player_id}>{p.player.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                    {/* Assist */}
                                                    {!newGoalIsOwnGoal && newGoalTeam && newGoalScorer && newGoalScorer !== UNCLAIMED && (
                                                        <div>
                                                            <label className="text-xs font-medium text-tertiary block mb-1">Assist <span className="text-quaternary">(optional)</span></label>
                                                            <select value={newGoalAssister} onChange={(e) => setNewGoalAssister(e.target.value)}
                                                                className="w-full text-sm rounded-lg border border-primary bg-primary text-primary px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand">
                                                                <option value="">No assist</option>
                                                                {assisterPlayers.map((p) => <option key={p.player_id} value={p.player_id}>{p.player.name}</option>)}
                                                            </select>
                                                        </div>
                                                    )}
                                                    <div className="flex gap-2">
                                                        <button onClick={() => { setAddingGoal(false); setNewGoalTeam(null); setNewGoalScorer(""); setNewGoalAssister(""); setNewGoalIsOwnGoal(false); }}
                                                            className="flex-1 py-2 border border-secondary text-sm font-medium text-secondary rounded-lg hover:bg-primary_hover transition duration-100 ease-linear">
                                                            Cancel
                                                        </button>
                                                        <button onClick={addGoalRow} disabled={!newGoalScorer || (!newGoalIsOwnGoal && !newGoalTeam) || savingGoal}
                                                            className="flex-1 py-2 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear disabled:opacity-50">
                                                            {savingGoal ? "Saving…" : "Add Goal"}
                                                        </button>
                                                    </div>
                                                </div>
                                                ) : (
                                                /* Player self-goal form — scorer is fixed to themselves */
                                                <div className="space-y-3">
                                                    <p className="text-xs text-tertiary">
                                                        Logging a goal for{" "}
                                                        <span className={cx("font-semibold", myTeam === "orange" && "text-warning-primary")} style={myTeam === "blue" ? { color: "#1570EF" } : undefined}>
                                                            {myTeam === "blue" ? "Blue" : "Orange"}
                                                        </span>{" "}— scored by you.
                                                    </p>
                                                    {/* Assist */}
                                                    <div>
                                                        <label className="text-xs font-medium text-tertiary block mb-1">Assisted by <span className="text-quaternary">(optional)</span></label>
                                                        <select value={newGoalAssister} onChange={(e) => setNewGoalAssister(e.target.value)}
                                                            className="w-full text-sm rounded-lg border border-primary bg-primary text-primary px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand">
                                                            <option value="">No assist</option>
                                                            {assisterPlayers.map((p) => <option key={p.player_id} value={p.player_id}>{p.player.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => { setAddingGoal(false); setNewGoalTeam(null); setNewGoalScorer(""); setNewGoalAssister(""); setNewGoalIsOwnGoal(false); }}
                                                            className="flex-1 py-2 border border-secondary text-sm font-medium text-secondary rounded-lg hover:bg-primary_hover transition duration-100 ease-linear">
                                                            Cancel
                                                        </button>
                                                        <button onClick={addGoalRow} disabled={!newGoalScorer || !newGoalTeam || savingGoal}
                                                            className="flex-1 py-2 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear disabled:opacity-50">
                                                            {savingGoal ? "Saving…" : "Add My Goal"}
                                                        </button>
                                                    </div>
                                                </div>
                                                )
                                            ) : (
                                                <button onClick={() => {
                                                    setAddingGoal(true);
                                                    if (!isAdmin && myTeam && myPlayerId) {
                                                        setNewGoalIsOwnGoal(false);
                                                        setNewGoalTeam(myTeam);
                                                        setNewGoalScorer(myPlayerId);
                                                        setNewGoalAssister("");
                                                    }
                                                }}
                                                    className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-secondary text-sm font-medium text-tertiary rounded-lg hover:bg-primary_hover hover:text-secondary transition duration-100 ease-linear">
                                                    <Plus className="size-4" /> {isAdmin ? "Add Goal" : "Add My Goal"}
                                                </button>
                                            )}

                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                        {event.payment_link && (
                            <div className="mt-4 flex items-center justify-between bg-secondary rounded-xl p-4">
                                <div><p className="text-sm font-medium text-primary">Payment</p>{event.payment_message && <p className="text-xs text-tertiary mt-0.5">{event.payment_message}</p>}</div>
                                <a href={event.payment_link} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-brand-solid text-white text-sm font-semibold rounded-lg hover:bg-brand-solid_hover transition duration-100 ease-linear">Pay Now</a>
                            </div>
                        )}
                    </div>

                    {isAdmin && (
                        <div className="flex flex-wrap gap-2">
                            <button onClick={toggleVoting} className={cx("flex items-center gap-2 px-3 py-2 border text-sm font-medium rounded-lg transition duration-100 ease-linear", event.voting_open ? "bg-warning-primary border-warning text-warning-primary" : "bg-primary border-secondary text-secondary hover:bg-primary_hover")}>
                                <Star01 className="size-4" />{event.voting_open ? "Close POTM Voting" : "Open POTM Voting"}
                            </button>
                            {event.status === "in_progress" && (
                                <button onClick={markCompleted} className="flex items-center gap-2 px-3 py-2 border border-success-primary bg-success-primary text-success-primary text-sm font-medium rounded-lg hover:bg-success-secondary transition duration-100 ease-linear">
                                    <CheckCircle className="size-4" /> Mark as Completed
                                </button>
                            )}
                        </div>
                    )}

                    {/* ── Enrolled management (admin) ── */}
                    {isAdmin && enrolledRoster.length > 0 && (
                        <div className="bg-primary rounded-2xl border border-secondary overflow-hidden">
                            <div className="px-6 py-4 border-b border-secondary flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-sm font-semibold text-primary">Enrolled players</h2>
                                    <p className="text-xs text-tertiary mt-0.5">Assign teams, record goals & assists, mark attendance</p>
                                </div>
                                {!teams && (savedBlue.length > 0 || savedOrange.length > 0) && (
                                    <button
                                        onClick={saveManualTeams}
                                        disabled={savingTeams}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-solid hover:bg-brand-solid_hover text-white text-xs font-semibold rounded-lg transition duration-100 ease-linear disabled:opacity-50 flex-shrink-0">
                                        <Check className="size-3.5" /> {savingTeams ? "Saving…" : "Save Teams"}
                                    </button>
                                )}
                            </div>
                            {(savedBlue.length > 0 || savedOrange.length > 0) && (
                                <div className="flex items-center gap-3 px-4 py-2.5 bg-secondary border-b border-secondary text-xs font-semibold">
                                    <span className="flex items-center gap-1.5" style={{ color: '#1570EF' }}>
                                        Blue ({savedBlue.length}) · <Star01 className="size-3" /> {blueRatingTotal}
                                    </span>
                                    <span className="text-quaternary">vs</span>
                                    <span className="flex items-center gap-1.5 text-warning-primary">
                                        Orange ({savedOrange.length}) · <Star01 className="size-3" /> {orangeRatingTotal}
                                    </span>
                                </div>
                            )}
                            <div className="divide-y divide-secondary">
                                {enrolledRoster.map(({ member, enrollment }) => {
                                    if (!enrollment) return null;
                                    const pid = member.player_id;
                                    const inBlue = (event.team_blue_ids ?? []).includes(pid);
                                    const inOrange = (event.team_orange_ids ?? []).includes(pid);
                                    return (
                                        <div key={pid} className="flex flex-wrap items-center gap-2 px-4 py-3">
                                            <AvatarCircle src={member.player.avatar_url} name={member.player.name} size={8} />
                                            <span className="text-sm font-medium text-primary flex-1 min-w-0 truncate">{member.player.name}</span>
                                            <PositionBadge bias={member.position_bias} isGK={member.is_goalkeeper} />
                                            <button
                                                onClick={() => assignTeam(pid, inBlue ? null : "blue")}
                                                disabled={!!actionInProgress}
                                                className={cx("px-2.5 py-1 rounded-lg text-xs font-semibold border transition duration-100 ease-linear disabled:opacity-50",
                                                    inBlue
                                                        ? "bg-[#1570EF] border-[#1570EF] text-white"
                                                        : "border-secondary text-quaternary hover:bg-[#1570EF] hover:border-[#1570EF] hover:text-white")}>
                                                Blue
                                            </button>
                                            <button
                                                onClick={() => assignTeam(pid, inOrange ? null : "orange")}
                                                disabled={!!actionInProgress}
                                                className={cx("px-2.5 py-1 rounded-lg text-xs font-semibold border transition duration-100 ease-linear disabled:opacity-50",
                                                    inOrange ? "bg-warning-solid text-white border-warning" : "border-secondary text-quaternary hover:bg-warning-primary hover:border-warning hover:text-warning-primary")}>
                                                Orange
                                            </button>
                                            <PayBadge hasPaid={enrollment.has_paid ?? false} isAdmin={true} onClick={() => adminTogglePaid(enrollment.id, enrollment.has_paid ?? false)} loading={actionInProgress === `paid-${enrollment.id}`} />
                                            <button onClick={() => setAttendance(enrollment.id, "late", enrollment.attendance_status)} disabled={!!actionInProgress}
                                                className={cx("px-2 py-1 rounded-lg text-xs font-semibold border transition duration-100 ease-linear disabled:opacity-50",
                                                    enrollment.attendance_status === "late" ? "bg-warning-solid text-white border-warning" : "border-secondary text-quaternary hover:border-warning hover:text-warning-primary")}>
                                                Late
                                            </button>
                                            <button onClick={() => setAttendance(enrollment.id, "no_show", enrollment.attendance_status)} disabled={!!actionInProgress}
                                                className={cx("px-2 py-1 rounded-lg text-xs font-semibold border transition duration-100 ease-linear disabled:opacity-50",
                                                    enrollment.attendance_status === "no_show" ? "bg-error-solid text-white border-error" : "border-secondary text-quaternary hover:border-error hover:text-error-primary")}>
                                                No show
                                            </button>
                                            <button onClick={() => adminToggleEnroll(member.player_id)} disabled={!!actionInProgress}
                                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-secondary text-quaternary hover:bg-error-secondary hover:text-error-primary hover:border-error transition duration-100 ease-linear disabled:opacity-50">
                                                <XCircle className="size-3.5" /> Remove
                                            </button>
                                            {event.voting_open && <button onClick={() => votePotm(pid)} disabled={votingForPotm} className="text-xs p-1.5 border border-secondary text-tertiary rounded-lg hover:bg-primary_hover transition duration-100 ease-linear disabled:opacity-50"><Trophy01 className="size-3.5" /></button>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Available players (admin) ── */}
                    {isAdmin && communityMembers.length > 0 && (
                        <div className="bg-primary rounded-2xl border border-secondary overflow-hidden">
                            <div className="flex items-center gap-3 px-6 py-4 border-b border-secondary">
                                <p className="text-sm font-semibold text-primary flex-1">Add players</p>
                                <div className="relative">
                                    <SearchMd className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-quaternary pointer-events-none" />
                                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8 pr-3 py-1.5 w-44 rounded-lg border border-primary bg-primary text-primary text-xs placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear" />
                                </div>
                            </div>
                            <div className="px-6 py-4">
                                {notEnrolledRoster.length === 0 ? (
                                    <p className="text-sm text-tertiary py-2">{search ? "No players match." : "All community members are enrolled."}</p>
                                ) : (
                                    <div className="space-y-3">
                                        {[
                                            { group: regularRoster, label: "Regulars" },
                                            { group: otherRoster, label: "Others" },
                                        ].map(({ group, label }) => group.length === 0 ? null : (
                                            <div key={label}>
                                                {!search && <p className="text-xs font-medium text-quaternary mb-1.5 px-1">{label}</p>}
                                                <div className="space-y-1">
                                                    {group.map(({ member }) => (
                                                        <div key={member.player_id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-primary_hover transition duration-100 ease-linear">
                                                            <AvatarCircle src={member.player.avatar_url} name={member.player.name} size={8} />
                                                            <span className="text-sm text-secondary flex-1 truncate">{member.player.name}</span>
                                                            <PositionBadge bias={member.position_bias} isGK={member.is_goalkeeper} />
                                                            <button onClick={() => adminToggleEnroll(member.player_id)} disabled={actionInProgress === `enroll-${member.player_id}`} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-secondary text-tertiary hover:bg-brand-solid hover:text-white hover:border-brand-solid transition duration-100 ease-linear disabled:opacity-50 flex-shrink-0">+ Enroll</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Player-facing enrolled list (non-admin, no sidebar) ── */}
                    {!isAdmin && enrolledPlayers.length === 0 && (
                        <div className="bg-primary rounded-2xl border border-secondary px-6 py-8 text-center text-sm text-tertiary">No players enrolled yet.</div>
                    )}

                    {/* ── Teams visible to all players ── */}
                    {(savedBlue.length > 0 || savedOrange.length > 0) && (
                        <div className="bg-primary rounded-2xl border border-secondary overflow-hidden">
                            <p className="text-sm font-semibold text-primary px-4 py-3 border-b border-secondary">Teams</p>
                            <TeamListVertical title={`Team Blue (${savedBlue.length})`} color="blue" players={savedBlue.map(toPlayerForTeam)} gkId={event.gk_blue_id ?? null} />
                            <TeamListVertical title={`Team Orange (${savedOrange.length})`} color="orange" players={savedOrange.map(toPlayerForTeam)} gkId={event.gk_orange_id ?? null} />
                        </div>
                    )}

                    {event.player_of_match_id && (
                        <div className="bg-primary rounded-2xl border border-secondary p-6 text-center">
                            <Trophy01 className="size-8 text-warning-primary mx-auto mb-2" />
                            <p className="text-sm font-semibold text-primary">Player of the Match</p>
                            <p className="text-lg font-bold text-primary mt-1">{enrollments.find((e) => e.player_id === event.player_of_match_id)?.player.name ?? "-"}</p>
                        </div>
                    )}
                </div>

                {/* ── Right column — generate + teams ── */}
                {isAdmin && (
                        <div className="w-80 flex-shrink-0 sticky top-6 self-start space-y-4">
                            {/* Generate button */}
                            <button onClick={handleGenerateTeams} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-xl transition duration-100 ease-linear">
                                <Lightning01 className="size-4" /> Generate Teams
                            </button>

                            {/* Unsaved generated preview */}
                            {teams && (
                                <div className="bg-primary rounded-2xl border border-secondary overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-secondary">
                                        <p className="text-sm font-semibold text-primary">Preview</p>
                                        <p className="text-xs text-tertiary">Blue {teams.blueRating} · Orange {teams.orangeRating}</p>
                                    </div>
                                    <TeamListVertical title={`Team Blue (${teams.blue.length})`} color="blue" players={teams.blue} gkId={teams.gkBlueId} />
                                    <TeamListVertical title={`Team Orange (${teams.orange.length})`} color="orange" players={teams.orange} gkId={teams.gkOrangeId} />
                                    <div className="flex gap-2 p-3 border-t border-secondary">
                                        <button onClick={handleGenerateTeams} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-secondary text-sm text-secondary rounded-lg hover:bg-primary_hover transition duration-100 ease-linear"><RefreshCw04 className="size-4" /> Reshuffle</button>
                                        <button onClick={saveTeams} disabled={savingTeams} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear disabled:opacity-50"><Check className="size-4" /> {savingTeams ? "Saving…" : "Save"}</button>
                                    </div>
                                </div>
                            )}

                            {/* Saved teams */}
                            {!teams && (savedBlue.length > 0 || savedOrange.length > 0) && (
                                <div className="bg-primary rounded-2xl border border-secondary overflow-hidden">
                                    <p className="text-sm font-semibold text-primary px-4 py-3 border-b border-secondary">Teams</p>
                                    <TeamListVertical title={`Team Blue (${savedBlue.length})`} color="blue" players={savedBlue.map(toPlayerForTeam)} gkId={event.gk_blue_id ?? null} />
                                    <TeamListVertical title={`Team Orange (${savedOrange.length})`} color="orange" players={savedOrange.map(toPlayerForTeam)} gkId={event.gk_orange_id ?? null} />
                                </div>
                            )}
                        </div>
                    )}
            </div>
        </div>
    );
}
