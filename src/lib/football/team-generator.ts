import type { PlayerForTeam, GeneratedTeams, FormRating } from "./types";

function effectiveRating(p: PlayerForTeam, asGK = false): number {
    const base = asGK
        ? (p.gk_rating ?? p.rating)
        : p.is_goalkeeper
        ? (p.outfield_rating ?? p.rating)
        : p.rating;
    const formBonus = p.form === "hot" ? 0.5 : p.form === "cold" ? -0.5 : 0;
    return base + formBonus;
}

function totalRating(team: PlayerForTeam[]): number {
    return team.reduce((sum, p) => sum + effectiveRating(p), 0);
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function scoreBalance(blue: PlayerForTeam[], orange: PlayerForTeam[]): number {
    const rBlue = totalRating(blue);
    const rOrange = totalRating(orange);
    let diff = Math.abs(rBlue - rOrange);

    // If unequal player count, smaller team should have higher rating (+1 advantage)
    if (blue.length !== orange.length) {
        const smallerRating = blue.length < orange.length ? rBlue : rOrange;
        const largerRating = blue.length < orange.length ? rOrange : rBlue;
        if (smallerRating < largerRating + 1) {
            diff += (largerRating + 1 - smallerRating) * 10;
        }
    }

    // Positional balance: penalise when teams have different average position bias.
    // Position scale: 1=DEF+, 2=DEF, 3=BAL, 4=ATK, 5=ATK+
    // A weight of 2 means a 0.5-point avg position gap costs 1 rating point in score,
    // preventing the optimiser from trading positional imbalance for tiny rating gains.
    if (blue.length > 0 && orange.length > 0) {
        const blueAvgPos = blue.reduce((s, p) => s + p.position_bias, 0) / blue.length;
        const orangeAvgPos = orange.reduce((s, p) => s + p.position_bias, 0) / orange.length;
        diff += Math.abs(blueAvgPos - orangeAvgPos) * 2.0;
    }

    return diff;
}

export function generateBalancedTeams(players: PlayerForTeam[]): GeneratedTeams {
    // Separate GKs
    const goalkeepers = players.filter((p) => p.is_goalkeeper);
    const outfield = players.filter((p) => !p.is_goalkeeper);

    let gkBlue: PlayerForTeam | null = null;
    let gkOrange: PlayerForTeam | null = null;
    const extraGKs: PlayerForTeam[] = [];

    if (goalkeepers.length === 1) {
        gkBlue = goalkeepers[0];
    } else if (goalkeepers.length === 2) {
        const sorted = [...goalkeepers].sort(
            (a, b) => (b.gk_rating ?? b.rating) - (a.gk_rating ?? a.rating),
        );
        // Randomly assign which GK goes to which team
        if (Math.random() > 0.5) {
            gkBlue = sorted[0];
            gkOrange = sorted[1];
        } else {
            gkBlue = sorted[1];
            gkOrange = sorted[0];
        }
    } else if (goalkeepers.length >= 3) {
        const sorted = [...goalkeepers].sort(
            (a, b) => (b.gk_rating ?? b.rating) - (a.gk_rating ?? a.rating),
        );
        gkBlue = sorted[0];
        gkOrange = sorted[1];
        extraGKs.push(...sorted.slice(2));
    }

    const allOutfield: PlayerForTeam[] = [...outfield, ...extraGKs];

    // Shuffle for randomisation before balancing
    const shuffled = shuffle(allOutfield);

    // Split into attackers (bias 4-5), defenders (bias 1-2), balanced (bias 3)
    const attackers = shuffled.filter((p) => p.position_bias >= 4);
    const defenders = shuffled.filter((p) => p.position_bias <= 2);
    const balanced = shuffled.filter((p) => p.position_bias === 3);

    let blue: PlayerForTeam[] = [];
    let orange: PlayerForTeam[] = [];

    // Global turn counter shared across all position groups so team sizes stay even.
    // Without this, each group resets its own alternation and teams can end up e.g. 6v4 for 10 players.
    let turn = 0;
    const distributeGroup = (group: PlayerForTeam[]) => {
        const sorted = [...group].sort((a, b) => effectiveRating(b) - effectiveRating(a));
        sorted.forEach((p) => {
            if (turn % 2 === 0) blue.push(p);
            else orange.push(p);
            turn++;
        });
    };

    distributeGroup(attackers);
    distributeGroup(defenders);
    distributeGroup(balanced);

    // Optimisation: swap players to improve balance
    let bestScore = scoreBalance(blue, orange);
    const MAX_PASSES = 300;

    for (let pass = 0; pass < MAX_PASSES; pass++) {
        let improved = false;
        for (let i = 0; i < blue.length; i++) {
            for (let j = 0; j < orange.length; j++) {
                const nb = [...blue];
                const no = [...orange];
                [nb[i], no[j]] = [no[j], nb[i]];
                const s = scoreBalance(nb, no);
                if (s < bestScore) {
                    blue = nb;
                    orange = no;
                    bestScore = s;
                    improved = true;
                }
            }
        }
        if (!improved) break;
    }

    const blueTeam: PlayerForTeam[] = [...(gkBlue ? [gkBlue] : []), ...blue];
    const orangeTeam: PlayerForTeam[] = [...(gkOrange ? [gkOrange] : []), ...orange];

    const blueRating = totalRating(blue) + (gkBlue ? effectiveRating(gkBlue, true) : 0);
    const orangeRating = totalRating(orange) + (gkOrange ? effectiveRating(gkOrange, true) : 0);

    return {
        blue: blueTeam,
        orange: orangeTeam,
        gkBlueId: gkBlue?.player_id ?? null,
        gkOrangeId: gkOrange?.player_id ?? null,
        blueRating: Math.round(blueRating * 10) / 10,
        orangeRating: Math.round(orangeRating * 10) / 10,
    };
}