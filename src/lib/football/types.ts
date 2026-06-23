export type FormRating = "hot" | "neutral" | "cold";
export type MatchStatus = "scheduled" | "in_progress" | "completed";
export type TeamColor = "blue" | "orange";
export type UserRole = "super_admin" | "admin" | "player";
export type CommunityRole = "admin" | "player";

// 1=DEF+, 2=DEF, 3=BAL, 4=ATK, 5=ATK+
export const POSITION_LABELS = ["DEF+", "DEF", "BAL", "ATK", "ATK+"] as const;

export interface Player {
    id: string;
    created_at: string;
    name: string;
    is_active: boolean;
    user_id: string | null;
    avatar_url: string | null;
    intended_role: UserRole | null;
    rating: number;
    position_bias: number;
    is_goalkeeper: boolean;
    gk_rating: number | null;
    outfield_rating: number | null;
    form_rating: FormRating | null;
}

export interface Community {
    id: string;
    created_at: string;
    name: string;
    description: string | null;
    sport_type: string | null;
    created_by: string | null;
    default_payment_link: string | null;
    default_payment_amount: number | null;
    default_payment_message: string | null;
    payment_currency: string;
    bank_details: string | null;
    info: string | null;
    community_details: Record<string, any> | null;
    is_active: boolean;
}

export interface CommunityMember {
    id: string;
    created_at: string;
    community_id: string;
    player_id: string;
    role: CommunityRole;
    rating: number;
    position_bias: number;
    is_goalkeeper: boolean;
    gk_rating: number | null;
    outfield_rating: number | null;
}

export interface CommunityMemberWithPlayer extends CommunityMember {
    player: Player;
}

export interface MatchEvent {
    id: string;
    created_at: string;
    community_id: string | null;
    title: string;
    event_date: string;
    event_time: string;
    location: string | null;
    maps_link: string | null;
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

export interface UserProfile {
    id: string;
    full_name: string | null;
    role: UserRole;
    player_id: string | null;
}

export type PlayerForTeam = CommunityMember & {
    name: string;
    avatar_url: string | null;
    form: FormRating;
};

export interface GeneratedTeams {
    blue: PlayerForTeam[];
    orange: PlayerForTeam[];
    gkBlueId: string | null;
    gkOrangeId: string | null;
    blueRating: number;
    orangeRating: number;
}