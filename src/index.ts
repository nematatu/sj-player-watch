import { diffPlayers, hasChanges, type Player } from "./diff";
import { notify } from "./notify";
import { discoverTeams, extractPlayers, fetchHtml, type Team } from "./scrape";

export type StoredState = { version: 1; teamName: string; url: string; players: Player[]; updatedAt: string };
export function isInitialState(state: StoredState | null): state is null { return state === null; }

async function monitorTeam(team: Team, env: Env): Promise<void> {
	try {
		const players = await extractPlayers(await fetchHtml(team.url));
		const key = `team:${team.id}`;
		const previous = await env.WATCH_STATE.get<StoredState>(key, "json");
		const state: StoredState = { version: 1, teamName: team.name, url: team.url, players, updatedAt: new Date().toISOString() };
		if (isInitialState(previous)) {
			await env.WATCH_STATE.put(key, JSON.stringify(state));
			console.log("baseline saved", { teamName: team.name, url: team.url, players: players.length });
			return;
		}
		const diff = diffPlayers(previous.players, players);
		if (!hasChanges(diff)) return;
		await notify(env.NTFY_TOPIC, team.name, team.url, diff);
		await env.WATCH_STATE.put(key, JSON.stringify(state));
		console.log("change notified", { teamName: team.name, url: team.url, added: diff.added.length, removed: diff.removed.length });
	} catch (error) {
		console.error("team monitoring failed", { teamName: team.name, url: team.url, error: error instanceof Error ? error.message : String(error) });
	}
}

async function runWithConcurrency<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
	let next = 0;
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) await task(items[next++]);
	}));
}

async function runMonitor(env: Env): Promise<void> {
	const teams = await discoverTeams();
	console.log("teams discovered", { count: teams.length });
	await runWithConcurrency(teams, 3, (team) => monitorTeam(team, env));
}

export default {
	async fetch(request): Promise<Response> {
		if (request.method !== "GET" || new URL(request.url).pathname !== "/") return new Response("Not Found", { status: 404 });
		return Response.json({ status: "ok", service: "sj-league-watch" });
	},
	async scheduled(_controller, env, ctx): Promise<void> {
		ctx.waitUntil(runMonitor(env).catch((error) => console.error("monitoring run failed", { error: error instanceof Error ? error.message : String(error) })));
	},
} satisfies ExportedHandler<Env>;
