export type Position = "attack" | "defense" | "goalkeeper";
export type FormRating = "hot" | "neutral" | "cold";
export type MatchStatus = "scheduled" | "in_progress" | "completed";
export type TeamColor = "blue" | "orange";

export interface Player {
    id: string;
    created_at: string;
    name: string;
    rating: number; // 1–6, admin only
    position_bias: number; // 1=Pure DEF, 3=Balanced, 5=Pure ATK
    is_goalkeeper: boolean;
    gk_rating: number | null; // 1–6
    outfield_rating: number | null; // 1–6 (used when is_goalkeeper=true for outfield play)
    is_active: boolean;
    user_id: string | null; // linked auth user
    avatar_url: string | null;
    intended_role: "admin" | "player" | null;
}

export interface MatchEvent {
    id: string;
    created_at: string;
    title: string;
    event_date: string; // ISO date string
    event_time: string; // HH:MM
    location: string | null;
    status: MatchStatus;
    team_blue_ids: string[];
    team_orange_ids: string[];
    gk_blue_id: string | null;
    gk_orange_id: string | null;
    score_blue: number;
    score_orange: number;
    payment_link: string | null;
    payment_message: string | null;
    player_of_match_id: string | null;
    voting_open: boolean;
}

export interface EventEnrollment {
    id: string;
    created_at: string;
    event_id: string;
    player_id: string;
    form: FormRating;
    has_paid: boolean;
}

export interface Goal {
    id: string;
    created_at: string;
    event_id: string;
    scorer_id: string;
    assister_id: string | null;
    team: TeamColor;
    minute: number | null;
}

export interface PotmVote {
    id: string;
    created_at: string;
    event_id: string;
    voter_id: string;
    nominee_id: string;
}

// Extended types with joins
export interface EnrollmentWithPlayer extends EventEnrollment {
    player: Player;
}

export interface GoalWithPlayers extends Goal {
    scorer: Player;
    assister: Player | null;
}

// Team generation types
export interface TeamGenerationInput {
    players: (Player & { form: FormRating })[];
}

export interface GeneratedTeams {
    blue: Player[];
    orange: Player[];
    gkBlue: Player | null;
    gkOrange: Player | null;
    blueRating: number;
    orangeRating: number;
}

// Stats types
export interface PlayerStats {
    player: Player;
    goals: number;
    assists: number;
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    potm_awards: number;
    win_rate: number;
}

export interface ChemistryPair {
    player_a: Player;
    player_b: Player;
    wins_together: number;
    matches_together: number;
    win_rate: number;
}
