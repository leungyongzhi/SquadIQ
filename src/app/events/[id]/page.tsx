"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Player, MatchEvent, EventEnrollment, Goal, FormRating } from "@/lib/football/types";
import { generateBalancedTeams } from "@/lib/football/team-generator";
import {
    Users01, Shuffle01, Target01, Trophy01, CreditCard01,
    Plus, Trash01, ChevronLeft, Star01, Lightning01,
    Shield01, Snowflake01, Check, CreditCardCheck,
    UserPlus01, Zap,
} from "@untitledui/icons";
import { cx } from "@/utils/cx";

type PlayerWithForm = Player & { form: FormRating; enrollment_id: string };

const FORM_OPTIONS: { value: FormRating; label: string; icon: React.FC<any>; color: string }[] = [
    { value: "hot", label: "Hot", icon: Lightning01, color: "text-error-primary" },
    { value: "neutral", label: "Neutral", icon: Zap, color: "text-tertiary" },
    { value: "cold", label: "Cold", icon: Snowflake01, color: "text-brand-secondary" },
];

function TeamCard({ title, color, players, gkId, isAdmin, showRatings }: {
    title: string;
    color: "blue" | "orange";
    players: Player[];
    gkId: string | null;
    isAdmin: boolean;
    showRatings: boolean;
}) {
    const colorCls = color === "blue"
        ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30"
        : "border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30";
    const headerCls = color === "blue"
        ? "text-blue-700 dark:text-blue-400"
        : "text-orange-700 dark:text-orange-400";
    const dotCls = color === "blue" ? "bg-blue-500" : "bg-orange-500";

    return (
        <div className={cx("rounded-xl border-2 p-4", colorCls)}>
            <div className="flex items-center gap-2 mb-3">
                <div className={cx("size-2.5 rounded-full", dotCls)} />
                <h3 className={cx("text-sm font-bold", headerCls)}>{title}</h3>
                <span className="text-xs text-tertiary ml-auto">{players.length} players</span>
            </div>
            <div className="space-y-1.5">
                {players.map((p) => {
                    const isGK = p.id === gkId;
                    return (
                        <div key={p.id} className="flex items-center gap-2 bg-primary/60 rounded-lg px-3 py-2">
                            <div className="size-7 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-secondary flex-shrink-0">
                                {p.name[0]}
                            </div>
                            <span className="flex-1 text-sm font-medium text-primary truncate">{p.name}</span>
                            {isGK && <span className="text-xs font-bold text-warning-primary bg-warning-primary rounded px-1.5 py-0.5">GK</span>}
                            {isAdmin && showRatings && (
                                <span className="text-xs font-semibold text-tertiary">
                                    {isGK ? (p.gk_rating ?? p.rating) : (p.is_goalkeeper ? (p.outfield_rating ?? p.rating) : p.rating)}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const supabase = createClient();

    const [event, setEvent] = useState<MatchEvent | null>(null);
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [enrollments, setEnrollments] = useState<PlayerWithForm[]>([]);
    const [goals, setGoals] = useState<(Goal & { scorer: Player; assister: Player | null })[]>([]);
    const [potmVotes, setPotmVotes] = useState<{ nominee_id: string; count: number }[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
    const [myVote, setMyVote] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [showPayments, setShowPayments] = useState(false);
    const [showPotmModal, setShowPotmModal] = useState(false);

    // Goal form
    const [goalForm, setGoalForm] = useState({ scorer_id: "", assister_id: "", team: "blue" as "blue" | "orange", minute: "" });

    const loadData = async () => {
        const [eventRes, enrollRes, goalsRes] = await Promise.all([
            supabase.from("match_events").select("*").eq("id", id).single(),
            supabase.from("event_enrollments").select("*, player:players(*)").eq("event_id", id),
            supabase.from("goals").select("*, scorer:players!goals_scorer_id_fkey(*), assister:players!goals_assister_id_fkey(*)").eq("event_id", id).order("created_at"),
        ]);

        setEvent(eventRes.data);
        setEnrollments(
            (enrollRes.data ?? []).map((e: any) => ({
                ...e.player,
                form: e.form,
                enrollment_id: e.id,
            })),
        );
        setGoals(goalsRes.data ?? []);
    };

    const loadVotes = async () => {
        const { data } = await supabase
            .from("potm_votes")
            .select("nominee_id")
            .eq("event_id", id);
        const counts: Record<string, number> = {};
        (data ?? []).forEach((v: any) => {
            counts[v.nominee_id] = (counts[v.nominee_id] ?? 0) + 1;
        });
        setPotmVotes(Object.entries(counts).map(([nominee_id, count]) => ({ nominee_id, count })).sort((a, b) => b.count - a.count));
    };

    useEffect(() => {
        async function init() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [profileRes, playersRes] = await Promise.all([
                supabase.from("user_profiles").select("role, player_id").eq("id", user.id).single(),
                supabase.from("players").select("*").eq("is_active", true).order("name"),
            ]);

            setIsAdmin(profileRes.data?.role === "admin");
            setMyPlayerId(profileRes.data?.player_id ?? null);
            setAllPlayers(playersRes.data ?? []);

            await loadData();

            // Check my vote
            if (profileRes.data?.player_id) {
                const { data: vote } = await supabase
                    .from("potm_votes")
                    .select("nominee_id")
                    .eq("event_id", id)
                    .eq("voter_id", profileRes.data.player_id)
                    .single();
                setMyVote(vote?.nominee_id ?? null);
            }

            await loadVotes();
            setLoading(false);
        }
        init();
    }, [id]);

    const handleEnroll = async (playerId: string, enroll: boolean) => {
        if (enroll) {
            await supabase.from("event_enrollments").insert({ event_id: id, player_id: playerId, form: "neutral" });
        } else {
            await supabase.from("event_enrollments").delete().eq("event_id", id).eq("player_id", playerId);
        }
        await loadData();
    };

    const handleFormChange = async (enrollmentId: string, form: FormRating) => {
        await supabase.from("event_enrollments").update({ form }).eq("id", enrollmentId);
        await loadData();
    };

    const handleGenerateTeams = async () => {
        if (!confirm(`Generate teams for ${enrollments.length} enrolled players?`)) return;

        const teams = generateBalancedTeams(enrollments);

        await supabase.from("match_events").update({
            team_blue_ids: teams.blue.map((p) => p.id),
            team_orange_ids: teams.orange.map((p) => p.id),
            gk_blue_id: teams.gkBlue?.id ?? null,
            gk_orange_id: teams.gkOrange?.id ?? null,
            status: "in_progress",
        }).eq("id", id);

        await loadData();
    };

    const handleAddGoal = async (e: React.FormEvent) => {
        e.preventDefault();
        await supabase.from("goals").insert({
            event_id: id,
            scorer_id: goalForm.scorer_id,
            assister_id: goalForm.assister_id || null,
            team: goalForm.team,
            minute: goalForm.minute ? +goalForm.minute : null,
        });

        // Update score
        const blueGoals = goals.filter((g) => g.team === "blue").length + (goalForm.team === "blue" ? 1 : 0);
        const orangeGoals = goals.filter((g) => g.team === "orange").length + (goalForm.team === "orange" ? 1 : 0);
        await supabase.from("match_events").update({ score_blue: blueGoals, score_orange: orangeGoals }).eq("id", id);

        setShowGoalModal(false);
        setGoalForm({ scorer_id: "", assister_id: "", team: "blue", minute: "" });
        await loadData();
    };

    const handleDeleteGoal = async (goalId: string, team: string) => {
        await supabase.from("goals").delete().eq("id", goalId);
        const remaining = goals.filter((g) => g.id !== goalId);
        await supabase.from("match_events").update({
            score_blue: remaining.filter((g) => g.team === "blue").length,
            score_orange: remaining.filter((g) => g.team === "orange").length,
        }).eq("id", id);
        await loadData();
    };

    const handleCompleteMatch = async () => {
        if (!confirm("Mark this match as completed? This will open POTM voting.")) return;
        await supabase.from("match_events").update({ status: "completed", voting_open: true }).eq("id", id);
        await loadData();
    };

    const handleSetPotm = async (playerId: string) => {
        await supabase.from("match_events").update({ player_of_match_id: playerId, voting_open: false }).eq("id", id);
        setShowPotmModal(false);
        await loadData();
    };

    const handleVotePotm = async (nomineeId: string) => {
        if (!myPlayerId || myPlayerId === nomineeId) return;
        await supabase.from("potm_votes").upsert({ event_id: id, voter_id: myPlayerId, nominee_id: nomineeId });
        setMyVote(nomineeId);
        await loadVotes();
    };

    const handlePaymentToggle = async (enrollmentId: string, has_paid: boolean) => {
        await supabase.from("event_enrollments").update({ has_paid }).eq("id", enrollmentId);
        await loadData();
    };

    if (loading || !event) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="size-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const teamBluePlayers = allPlayers.filter((p) => (event.team_blue_ids ?? []).includes(p.id));
    const teamOrangePlayers = allPlayers.filter((p) => (event.team_orange_ids ?? []).includes(p.id));
    const teamsGenerated = teamBluePlayers.length > 0 || teamOrangePlayers.length > 0;
    const isEnrolled = myPlayerId ? enrollments.some((e) => e.id === myPlayerId) : false;
    const potmPlayer = event.player_of_match_id ? allPlayers.find((p) => p.id === event.player_of_match_id) : null;

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div>
                <button
                    onClick={() => router.push("/events")}
                    className="flex items-center gap-1 text-sm text-tertiary hover:text-primary mb-3 transition duration-100 ease-linear"
                >
                    <ChevronLeft className="size-4" />
                    Back to events
                </button>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-primary">{event.title}</h1>
                        <p className="text-sm text-tertiary mt-1">
                            {new Date(event.event_date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {event.event_time?.slice(0, 5)}
                            {event.location && ` · ${event.location}`}
                        </p>
                    </div>
                    <span className={cx(
                        "text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0",
                        event.status === "completed" ? "bg-success-primary text-success-primary" :
                        event.status === "in_progress" ? "bg-warning-primary text-warning-primary" :
                        "bg-brand-secondary text-brand-primary"
                    )}>
                        {event.status === "in_progress" ? "In Progress" : event.status === "completed" ? "Completed" : "Scheduled"}
                    </span>
                </div>
            </div>

            {/* Score display */}
            {teamsGenerated && (
                <div className="bg-primary rounded-xl border border-secondary p-5">
                    <div className="flex items-center justify-center gap-6">
                        <div className="text-center">
                            <div className="size-3 rounded-full bg-blue-500 mx-auto mb-1" />
                            <p className="text-sm font-semibold text-primary">Team Blue</p>
                            {isAdmin && (
                                <p className="text-xs text-tertiary">
                                    Rating: {teamBluePlayers.reduce((s, p) => s + p.rating, 0)}
                                </p>
                            )}
                        </div>
                        <div className="text-center">
                            <p className="text-5xl font-bold text-primary">{event.score_blue}</p>
                        </div>
                        <div className="text-3xl font-light text-quaternary">—</div>
                        <div className="text-center">
                            <p className="text-5xl font-bold text-primary">{event.score_orange}</p>
                        </div>
                        <div className="text-center">
                            <div className="size-3 rounded-full bg-orange-500 mx-auto mb-1" />
                            <p className="text-sm font-semibold text-primary">Team Orange</p>
                            {isAdmin && (
                                <p className="text-xs text-tertiary">
                                    Rating: {teamOrangePlayers.reduce((s, p) => s + p.rating, 0)}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Admin action bar */}
            {isAdmin && (
                <div className="flex flex-wrap gap-2">
                    {event.status === "scheduled" && (
                        <button
                            onClick={handleGenerateTeams}
                            className="flex items-center gap-2 px-4 py-2 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear"
                        >
                            <Shuffle01 className="size-4" />
                            Generate Teams
                        </button>
                    )}
                    {teamsGenerated && event.status !== "completed" && (
                        <>
                            <button
                                onClick={() => setShowGoalModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-success-solid hover:bg-success-solid text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear opacity-90 hover:opacity-100"
                            >
                                <Target01 className="size-4" />
                                Record Goal
                            </button>
                            <button
                                onClick={() => setShowPotmModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-warning-solid text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear opacity-90 hover:opacity-100"
                            >
                                <Star01 className="size-4" />
                                Set POTM
                            </button>
                            <button
                                onClick={() => setShowPayments(true)}
                                className="flex items-center gap-2 px-4 py-2 border border-primary text-sm font-semibold text-secondary hover:bg-primary_hover rounded-lg transition duration-100 ease-linear"
                            >
                                <CreditCard01 className="size-4" />
                                Payments
                            </button>
                            <button
                                onClick={handleCompleteMatch}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-solid hover:opacity-90 text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear"
                            >
                                <Trophy01 className="size-4" />
                                Complete Match
                            </button>
                        </>
                    )}
                    {event.status === "completed" && (
                        <>
                            <button
                                onClick={() => setShowGoalModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-success-solid text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear opacity-90 hover:opacity-100"
                            >
                                <Target01 className="size-4" />
                                Edit Goals
                            </button>
                            <button
                                onClick={() => setShowPotmModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-warning-solid text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear opacity-90 hover:opacity-100"
                            >
                                <Star01 className="size-4" />
                                POTM Tally
                            </button>
                            <button
                                onClick={() => setShowPayments(true)}
                                className="flex items-center gap-2 px-4 py-2 border border-primary text-sm font-semibold text-secondary hover:bg-primary_hover rounded-lg transition duration-100 ease-linear"
                            >
                                <CreditCard01 className="size-4" />
                                Payments
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Player self-enroll (non-admin) */}
            {!isAdmin && myPlayerId && event.status === "scheduled" && (
                <div className="bg-primary rounded-xl border border-secondary p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-primary">
                                {isEnrolled ? "You're signed up!" : "Want to play?"}
                            </p>
                            <p className="text-xs text-tertiary mt-0.5">
                                {isEnrolled ? "Tap to opt out of this match." : "Tap to join this match day."}
                            </p>
                        </div>
                        <button
                            onClick={() => handleEnroll(myPlayerId, !isEnrolled)}
                            className={cx(
                                "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition duration-100 ease-linear",
                                isEnrolled
                                    ? "border border-error text-error-primary hover:bg-error-primary"
                                    : "bg-brand-solid hover:bg-brand-solid_hover text-white",
                            )}
                        >
                            <UserPlus01 className="size-4" />
                            {isEnrolled ? "Opt Out" : "I'm In!"}
                        </button>
                    </div>
                </div>
            )}

            {/* Player payment info (non-admin) */}
            {!isAdmin && event.payment_link && (
                <div className="bg-brand-secondary rounded-xl border border-brand_alt p-4">
                    {event.payment_message && <p className="text-sm text-secondary mb-3">{event.payment_message}</p>}
                    <a
                        href={event.payment_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear"
                    >
                        <CreditCardCheck className="size-4" />
                        Pay Now
                    </a>
                    {myPlayerId && (() => {
                        const myEnrollment = enrollments.find((e) => e.id === myPlayerId) as any;
                        const rawEnrollments = enrollments as any[];
                        const fullE = rawEnrollments.find((e) => e.id === myPlayerId);
                        return fullE?.has_paid ? (
                            <span className="ml-3 text-sm text-success-primary flex items-center gap-1 inline-flex">
                                <Check className="size-4" /> Paid ✓
                            </span>
                        ) : null;
                    })()}
                </div>
            )}

            {/* POTM display */}
            {potmPlayer && (
                <div className="bg-warning-primary rounded-xl border border-warning p-4 flex items-center gap-3">
                    <Star01 className="size-5 text-warning-primary flex-shrink-0" />
                    <div>
                        <p className="text-xs font-medium text-warning-primary">Player of the Match</p>
                        <p className="text-base font-bold text-primary">{potmPlayer.name} ⭐</p>
                    </div>
                </div>
            )}

            {/* POTM voting (players, after match completed) */}
            {!isAdmin && myPlayerId && event.status === "completed" && event.voting_open && (
                <div className="bg-primary rounded-xl border border-secondary p-5">
                    <h3 className="text-sm font-semibold text-primary mb-3">⭐ Vote for Player of the Match</h3>
                    <p className="text-xs text-tertiary mb-3">You can't vote for yourself.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {enrollments
                            .filter((p) => p.id !== myPlayerId)
                            .map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => handleVotePotm(p.id)}
                                    className={cx(
                                        "py-2 px-3 rounded-lg border text-sm font-medium transition duration-100 ease-linear",
                                        myVote === p.id
                                            ? "border-warning bg-warning-primary text-warning-primary"
                                            : "border-secondary text-secondary hover:bg-primary_hover",
                                    )}
                                >
                                    {p.name}
                                    {myVote === p.id && " ⭐"}
                                </button>
                            ))}
                    </div>
                </div>
            )}

            {/* Teams */}
            {teamsGenerated && (
                <div className="grid sm:grid-cols-2 gap-4">
                    <TeamCard
                        title="🔵 Team Blue"
                        color="blue"
                        players={teamBluePlayers}
                        gkId={event.gk_blue_id}
                        isAdmin={isAdmin}
                        showRatings={isAdmin}
                    />
                    <TeamCard
                        title="🟠 Team Orange"
                        color="orange"
                        players={teamOrangePlayers}
                        gkId={event.gk_orange_id}
                        isAdmin={isAdmin}
                        showRatings={isAdmin}
                    />
                </div>
            )}

            {/* Enrollment manager */}
            {isAdmin && (
                <div className="bg-primary rounded-xl border border-secondary p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-semibold text-primary flex items-center gap-2">
                            <Users01 className="size-5 text-tertiary" />
                            Players ({enrollments.length} enrolled)
                        </h2>
                    </div>
                    <div className="space-y-2">
                        {allPlayers.map((player) => {
                            const enrollment = enrollments.find((e) => e.id === player.id);
                            const enrolled = !!enrollment;
                            return (
                                <div key={player.id} className={cx(
                                    "flex items-center gap-3 p-3 rounded-lg border transition duration-100 ease-linear",
                                    enrolled ? "border-brand bg-brand-primary_alt" : "border-secondary hover:bg-primary_hover",
                                )}>
                                    <button
                                        onClick={() => handleEnroll(player.id, !enrolled)}
                                        className={cx(
                                            "size-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition duration-100 ease-linear",
                                            enrolled ? "bg-brand-solid border-brand-solid" : "border-secondary",
                                        )}
                                    >
                                        {enrolled && <Check className="size-3 text-white" />}
                                    </button>
                                    <span className="flex-1 text-sm font-medium text-primary">{player.name}</span>
                                    {enrolled && (
                                        <div className="flex gap-1">
                                            {FORM_OPTIONS.map(({ value, label, icon: Icon, color }) => (
                                                <button
                                                    key={value}
                                                    onClick={() => handleFormChange(enrollment!.enrollment_id, value)}
                                                    className={cx(
                                                        "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition duration-100 ease-linear",
                                                        enrollment?.form === value
                                                            ? "border-current bg-current/10"
                                                            : "border-transparent hover:border-secondary text-quaternary",
                                                        enrollment?.form === value ? color : "",
                                                    )}
                                                >
                                                    <Icon className="size-3" />
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Goals list */}
            {goals.length > 0 && (
                <div className="bg-primary rounded-xl border border-secondary p-5">
                    <h2 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
                        <Target01 className="size-5 text-tertiary" />
                        Goals
                    </h2>
                    <div className="space-y-2">
                        {goals.map((g) => (
                            <div key={g.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary">
                                <div className={cx("size-2.5 rounded-full flex-shrink-0", g.team === "blue" ? "bg-blue-500" : "bg-orange-500")} />
                                <div className="flex-1">
                                    <span className="text-sm font-semibold text-primary">{g.scorer?.name}</span>
                                    {g.assister && (
                                        <span className="text-xs text-tertiary ml-1.5">(assist: {g.assister.name})</span>
                                    )}
                                </div>
                                <span className="text-xs text-tertiary capitalize">{g.team === "blue" ? "🔵" : "🟠"}</span>
                                {g.minute && <span className="text-xs text-quaternary">{g.minute}'</span>}
                                {isAdmin && (
                                    <button onClick={() => handleDeleteGoal(g.id, g.team)} className="text-error-primary hover:opacity-80 transition duration-100 ease-linear">
                                        <Trash01 className="size-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Payment panel (admin) */}
            {showPayments && isAdmin && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-overlay" onClick={() => setShowPayments(false)} />
                    <div className="relative bg-primary rounded-2xl border border-secondary shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
                        <div className="p-6">
                            <h2 className="text-base font-semibold text-primary mb-4">Payment Tracker</h2>
                            <div className="space-y-2">
                                {enrollments.map((p: any) => (
                                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-secondary">
                                        <div className="flex items-center gap-2">
                                            <div className={cx("size-2 rounded-full", p.has_paid ? "bg-success-solid" : "bg-error-primary")} />
                                            <span className="text-sm font-medium text-primary">{p.name}</span>
                                        </div>
                                        <button
                                            onClick={() => handlePaymentToggle(p.enrollment_id, !p.has_paid)}
                                            className={cx(
                                                "text-xs font-semibold px-3 py-1 rounded-full transition duration-100 ease-linear",
                                                p.has_paid
                                                    ? "bg-success-primary text-success-primary hover:bg-error-secondary hover:text-error-primary"
                                                    : "bg-secondary text-tertiary hover:bg-success-primary hover:text-success-primary",
                                            )}
                                        >
                                            {p.has_paid ? "✓ Paid" : "Mark paid"}
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setShowPayments(false)} className="w-full mt-4 py-2.5 bg-brand-solid hover:bg-brand-solid_hover text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear">
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Goal modal */}
            {showGoalModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-overlay" onClick={() => setShowGoalModal(false)} />
                    <div className="relative bg-primary rounded-2xl border border-secondary shadow-xl w-full max-w-sm">
                        <div className="p-6">
                            <h2 className="text-base font-semibold text-primary mb-4">Record Goal</h2>
                            <form onSubmit={handleAddGoal} className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-1.5">Team</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(["blue", "orange"] as const).map((t) => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setGoalForm((f) => ({ ...f, team: t }))}
                                                className={cx(
                                                    "py-2 rounded-lg border text-sm font-semibold transition duration-100 ease-linear",
                                                    goalForm.team === t
                                                        ? t === "blue" ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400" : "border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400"
                                                        : "border-primary text-secondary hover:bg-primary_hover",
                                                )}
                                            >
                                                {t === "blue" ? "🔵 Team Blue" : "🟠 Team Orange"}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-1.5">Scorer *</label>
                                    <select
                                        value={goalForm.scorer_id}
                                        onChange={(e) => setGoalForm((f) => ({ ...f, scorer_id: e.target.value }))}
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear"
                                    >
                                        <option value="">Select scorer...</option>
                                        {enrollments.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-1.5">Assister (optional)</label>
                                    <select
                                        value={goalForm.assister_id}
                                        onChange={(e) => setGoalForm((f) => ({ ...f, assister_id: e.target.value }))}
                                        className="w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear"
                                    >
                                        <option value="">No assist</option>
                                        {enrollments
                                            .filter((p) => p.id !== goalForm.scorer_id)
                                            .map((p) => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-1.5">Minute (optional)</label>
                                    <input
                                        type="number"
                                        value={goalForm.minute}
                                        onChange={(e) => setGoalForm((f) => ({ ...f, minute: e.target.value }))}
                                        placeholder="e.g. 23"
                                        min={1}
                                        max={120}
                                        className="w-full px-3.5 py-2.5 rounded-lg border border-primary bg-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand transition duration-100 ease-linear"
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setShowGoalModal(false)} className="flex-1 py-2.5 border border-primary text-sm font-semibold text-secondary rounded-lg hover:bg-primary_hover transition duration-100 ease-linear">
                                        Cancel
                                    </button>
                                    <button type="submit" className="flex-1 py-2.5 bg-success-solid text-white text-sm font-semibold rounded-lg transition duration-100 ease-linear opacity-90 hover:opacity-100">
                                        Add Goal
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* POTM modal (admin) */}
            {showPotmModal && isAdmin && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-overlay" onClick={() => setShowPotmModal(false)} />
                    <div className="relative bg-primary rounded-2xl border border-secondary shadow-xl w-full max-w-sm max-h-[80vh] overflow-y-auto">
                        <div className="p-6">
                            <h2 className="text-base font-semibold text-primary mb-2">Player of the Match</h2>
                            {potmVotes.length > 0 && (
                                <div className="mb-4">
                                    <p className="text-xs font-medium text-tertiary mb-2">Vote tally</p>
                                    {potmVotes.map(({ nominee_id, count }) => {
                                        const p = allPlayers.find((pl) => pl.id === nominee_id);
                                        return p ? (
                                            <div key={nominee_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-primary_hover">
                                                <span className="text-sm font-medium text-primary">{p.name}</span>
                                                <span className="text-sm font-bold text-warning-primary">{count} vote{count !== 1 ? "s" : ""}</span>
                                            </div>
                                        ) : null;
                                    })}
                                </div>
                            )}
                            <p className="text-xs font-medium text-tertiary mb-2">Select POTM</p>
                            <div className="space-y-1">
                                {enrollments.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleSetPotm(p.id)}
                                        className={cx(
                                            "w-full text-left px-3 py-2 rounded-lg text-sm transition duration-100 ease-linear",
                                            event.player_of_match_id === p.id
                                                ? "bg-warning-primary text-warning-primary font-semibold"
                                                : "text-secondary hover:bg-primary_hover",
                                        )}
                                    >
                                        {p.name} {event.player_of_match_id === p.id ? "⭐" : ""}
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => setShowPotmModal(false)} className="w-full mt-4 py-2.5 border border-primary text-sm font-semibold text-secondary rounded-lg hover:bg-primary_hover transition duration-100 ease-linear">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
