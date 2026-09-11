import type { Player, PlayerDiff } from "./diff";

function playerLine(player: Player): string {
	return player.number ? `${player.name}（${player.number}）` : player.name;
}

export function notificationBody(teamName: string, diff: PlayerDiff): string {
	const added = diff.added.length ? diff.added.map((p) => `+ ${playerLine(p)}`).join("\n") : "なし";
	const removed = diff.removed.length ? diff.removed.map((p) => `- ${playerLine(p)}`).join("\n") : "なし";
	return `${teamName}\n\n追加:\n${added}\n\n削除:\n${removed}`;
}

export async function notify(topic: string, teamName: string, url: string, diff: PlayerDiff): Promise<void> {
	const response = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
		method: "POST",
		headers: { Title: encodeURIComponent("S/Jリーグ 選手情報更新"), Click: url, "Content-Type": "text/plain; charset=utf-8" },
		body: notificationBody(teamName, diff),
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) {
		const body = (await response.text()).slice(0, 500);
		const retryAfter = response.headers.get("Retry-After");
		throw new Error(`ntfy HTTP ${response.status} ${response.statusText}; body=${body || "empty"}; retryAfter=${retryAfter || "none"}`);
	}
}
