import { expect, test } from "bun:test";
import { normalizePlayers } from "../src/diff";
import { PlayerHandler } from "../src/scrape";

test("実サイト構造を模したfixtureから選手欄だけを抽出する", async () => {
	const html = await Bun.file(new URL("fixtures/team.html", import.meta.url)).text();
	const section = html.match(/<section class="[^"]*v-player-list__player-area[^"]*">([\s\S]*?)<\/section>/)?.[1];
	expect(section).toBeDefined();
	const players: { name: string; number?: string }[] = [];
	for (const item of section!.matchAll(/<li class="p-player__item">([\s\S]*?)<\/li>/g)) {
		const handler = new PlayerHandler(players);
		const endCallbacks: Array<() => void> = [];
		handler.start({ onEndTag: (callback: () => void) => { endCallbacks.push(callback); } } as unknown as Element);
		const number = item[1].match(/v-player-list__player__number">([\s\S]*?)<\//)?.[1] ?? "";
		const name = item[1].match(/p-player__name">([\s\S]*?)<\//)?.[1] ?? "";
		handler.number({ text: number } as Text);
		handler.name({ text: name } as Text);
		endCallbacks.forEach((callback) => callback());
	}
	expect(normalizePlayers(players)).toEqual([
		{ name: "山下 恭平", number: "10" },
		{ name: "桃田 賢斗", number: "7" },
	]);
});
