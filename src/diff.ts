export type Player = { name: string; number?: string };
export type PlayerDiff = { added: Player[]; removed: Player[] };

export function normalizeText(value: string): string {
	return value.replace(/[\s\u3000]+/gu, " ").trim();
}

export function normalizePlayer(player: Player): Player {
	const name = normalizeText(player.name);
	const number = player.number ? normalizeText(player.number) : "";
	return number ? { name, number } : { name };
}

export function playerKey(player: Player): string {
	return `${player.name}\u0000${player.number ?? ""}`;
}

export function normalizePlayers(players: Player[]): Player[] {
	const unique = new Map<string, Player>();
	for (const raw of players) {
		const player = normalizePlayer(raw);
		if (player.name) unique.set(playerKey(player), player);
	}
	return [...unique.values()].sort((a, b) => playerKey(a).localeCompare(playerKey(b), "ja"));
}

export function diffPlayers(previous: Player[], current: Player[]): PlayerDiff {
	const before = new Map(normalizePlayers(previous).map((p) => [playerKey(p), p]));
	const after = new Map(normalizePlayers(current).map((p) => [playerKey(p), p]));
	return {
		added: [...after].filter(([key]) => !before.has(key)).map(([, p]) => p),
		removed: [...before].filter(([key]) => !after.has(key)).map(([, p]) => p),
	};
}

export function hasChanges(diff: PlayerDiff): boolean {
	return diff.added.length > 0 || diff.removed.length > 0;
}
