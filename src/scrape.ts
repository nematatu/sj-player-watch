import { normalizePlayers, normalizeText, type Player } from "./diff";

export const TEAM_LIST_URLS = [
	"https://www.badminton.or.jp/sj-league/team/sj",
	"https://www.badminton.or.jp/sj-league/team/sj?gender=female",
] as const;
export type Team = { id: string; name: string; url: string };
const TIMEOUT_MS = 15_000;

async function consume(response: Response, rewriter: HTMLRewriter): Promise<void> {
	await rewriter.transform(response).arrayBuffer();
}

class TeamCardHandler {
	name = "";
	constructor(readonly teams: Team[]) {}
	start(): void { this.name = ""; }
	text(text: Text): void { this.name += text.text; }
	link(element: Element): void {
		const href = element.getAttribute("href");
		const match = href?.match(/^https:\/\/www\.badminton\.or\.jp\/sj-league\/team\/sj\/(\d+)\/?$/);
		if (match) this.teams.push({ id: match[1], name: normalizeText(this.name), url: href! });
	}
}

export async function extractTeams(response: Response): Promise<Team[]> {
	const teams: Team[] = [];
	const cards = new TeamCardHandler(teams);
	await consume(response, new HTMLRewriter()
		.on(".v-team__card", { element: () => cards.start() })
		.on(".v-team__card .v-team__name", { text: (text) => cards.text(text) })
		.on(".v-team__card a.v-team__link-link", { element: (element) => cards.link(element) }));
	return teams.filter((team) => team.name);
}

export class PlayerHandler {
	current?: Player;
	constructor(readonly players: Player[]) {}
	start(element: Element): void {
		this.current = { name: "" };
		element.onEndTag(() => { if (this.current) this.players.push(this.current); this.current = undefined; });
	}
	name(text: Text): void { if (this.current) this.current.name += text.text; }
	number(text: Text): void { if (this.current) this.current.number = (this.current.number ?? "") + text.text; }
}

export async function extractPlayers(response: Response): Promise<Player[]> {
	const players: Player[] = [];
	let sectionFound = false;
	const handler = new PlayerHandler(players);
	await consume(response, new HTMLRewriter()
		.on(".v-player-list__player-area", { element: () => { sectionFound = true; } })
		.on(".v-player-list__player-area .p-player__item", { element: (element) => handler.start(element) })
		.on(".v-player-list__player-area .p-player__item .p-player__name", { text: (text) => handler.name(text) })
		.on(".v-player-list__player-area .p-player__item .v-player-list__player__number", { text: (text) => handler.number(text) }));
	const normalized = normalizePlayers(players);
	if (!sectionFound) throw new Error("player section not found");
	if (normalized.length === 0) throw new Error("player list is unexpectedly empty");
	return normalized;
}

export async function fetchHtml(url: string): Promise<Response> {
	const response = await fetch(url, {
		headers: { "User-Agent": "sj-player-watch/1.0 (+Cloudflare Workers)" },
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
	return response;
}

export async function discoverTeams(): Promise<Team[]> {
	const lists = await Promise.all(TEAM_LIST_URLS.map(async (url) => extractTeams(await fetchHtml(url))));
	const unique = new Map<string, Team>();
	for (const team of lists.flat()) unique.set(team.id, team);
	if (unique.size === 0) throw new Error("no S/J League teams found");
	return [...unique.values()];
}
