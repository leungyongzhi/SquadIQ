import type { Player, FormRating, GeneratedTeams } from "./types";

type PlayerWithForm = Player & { form: FormRating };

function effectiveRating(player: PlayerWithForm, asGK = false): number {
    const base = asGK ? (player.gk_rating ?? player.rating) : (player.is_goalkeeper ? (player.outfield_rating ?? player.rating) : player.rating);
    const formBonus = player.form === "hot" ? 0.5 : player.form === "cold" ? -0.5 : 0;
    return base + formBonus;
}

// Is player primarily attacking (bias 4-5)
function isAttacker(player: Player): boolean {
    return player.position_bias >= 4;
}

// Is player primarily defending (bias 1-2)
function isDefender(player: Player): boolean {
    return player.position_bias <= 2;
}

function totalRating(team: PlayerWithForm[]): number {
    return team.reduce((sum, p) => sum + effectiveRating(p), 0);
}

function scoreBalance(blue: PlayerWithForm[], orange: PlayerWithForm[]): number {
    const diff = Math.abs(totalRating(blue) - totalRating(orange));
    // Penalise if smaller team has lower rating
    if (blue.length !== orange.length) {
        const smaller = blue.length < orange.length ? blue : orange;
        const larger = blue.length < orange.length ? orange : blue;
        if (totalRating(smaller) < totalRating(larger)) {
            return diff + 100; // heavy penalty
        }
    }
    return diff;
}

export function generateBalancedTeams(players: PlayerWithForm[]): GeneratedTeams {
    // Separate goalkeepers
    const goalkeepers = players.filter((p) => p.is_goalkeeper);
    const outfield = players.filter((p) => !p.is_goalkeeper);

    // Assign GKs to teams
    let gkBlue: PlayerWithForm | null = null;
    let gkOrange: PlayerWithForm | null = null;
    const extraGKs: PlayerWithForm[] = [];

    if (goalkeepers.length === 1) {
        gkBlue = goalkeepers[0];
    } else if (goalkeepers.length === 2) {
        // Best GK (by gk_rating) to team blue, other to orange
        const sorted = [...goalkeepers].sort(
            (a, b) => (b.gk_rating ?? b.rating) - (a.gk_rating ?? a.rating),
        );
        gkBlue = sorted[0];
        gkOrange = sorted[1];
    } else if (goalkeepers.length >= 3) {
        const sorted = [...goalkeepers].sort(
            (a, b) => (b.gk_rating ?? b.rating) - (a.gk_rating ?? a.rating),
        );
        gkBlue = sorted[0];
        gkOrange = sorted[1];
        // Extras play outfield
        extraGKs.push(...sorted.slice(2));
    }

    // All outfield players (including extra GKs playing outfield)
    const allOutfield: PlayerWithForm[] = [...outfield, ...extraGKs];

    // Split outfield by position type
    const attackers = allOutfield.filter(isAttacker);
    const defenders = allOutfield.filter(isDefender);
    const balanced = allOutfield.filter((p) => !isAttacker(p) && !isDefender(p));

    // Build initial teams by alternating sorted players
    const sortedAll = [...allOutfield].sort((a, b) => effectiveRating(b) - effectiveRating(a));

    let blue: PlayerWithForm[] = [];
    let orange: PlayerWithForm[] = [];

    // Snake draft for initial balance
    sortedAll.forEach((p, i) => {
        if (i % 2 === 0) blue.push(p);
        else orange.push(p);
    });

    // Position balance: ensure each team has roughly equal attackers/defenders
    // Swap optimisation passes
    const MAX_PASSES = 200;
    let bestScore = scoreBalance(blue, orange);

    for (let pass = 0; pass < MAX_PASSES; pass++) {
        let improved = false;

        for (let i = 0; i < blue.length; i++) {
            for (let j = 0; j < orange.length; j++) {
                // Try swap
                const newBlue = [...blue];
                const newOrange = [...orange];
                [newBlue[i], newOrange[j]] = [newOrange[j], newBlue[i]];

                const newScore = scoreBalance(newBlue, newOrange);
                if (newScore < bestScore) {
                    blue = newBlue;
                    orange = newOrange;
                    bestScore = newScore;
                    improved = true;
                }
            }
        }

        if (!improved) break;
    }

    // Add GKs back to teams
    const blueTeam: Player[] = [...(gkBlue ? [gkBlue] : []), ...blue];
    const orangeTeam: Player[] = [...(gkOrange ? [gkOrange] : []), ...orange];

    const blueRating = blue.reduce((s, p) => s + effectiveRating(p), 0) +
        (gkBlue ? effectiveRating(gkBlue, true) : 0);
    const orangeRating = orange.reduce((s, p) => s + effectiveRating(p), 0) +
        (gkOrange ? effectiveRating(gkOrange, true) : 0);

    return {
        blue: blueTeam,
        orange: orangeTeam,
        gkBlue,
        gkOrange,
        blueRating: Math.round(blueRating * 10) / 10,
        orangeRating: Math.round(orangeRating * 10) / 10,
    };
}
