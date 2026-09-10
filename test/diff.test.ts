import { describe, expect, test } from "bun:test";
import { diffPlayers, hasChanges, normalizePlayer, normalizePlayers } from "../src/diff";
import { isInitialState } from "../src/index";

describe("player normalization and diff", () => {
	test("空白を正規化する", () => {
		expect(normalizePlayer({ name: "  山田\n\t 太郎　", number: " 1 " })).toEqual({ name: "山田 太郎", number: "1" });
	});

	test("追加を検出する", () => {
		const diff = diffPlayers([{ name: "選手A", number: "1" }], [{ name: "選手A", number: "1" }, { name: "選手B", number: "2" }]);
		expect(diff.added).toEqual([{ name: "選手B", number: "2" }]);
		expect(diff.removed).toEqual([]);
	});

	test("削除を検出する", () => {
		const diff = diffPlayers([{ name: "選手A" }, { name: "選手B" }], [{ name: "選手A" }]);
		expect(diff.removed).toEqual([{ name: "選手B" }]);
	});

	test("並び順と空白だけの変更は無視する", () => {
		const diff = diffPlayers([{ name: "選手 A", number: "1" }, { name: "選手B", number: "2" }], [{ name: " 選手B ", number: "2" }, { name: "選手\nA", number: "1" }]);
		expect(hasChanges(diff)).toBe(false);
	});

	test("重複を除いて安定ソートする", () => {
		expect(normalizePlayers([{ name: "B" }, { name: "A" }, { name: "A" }])).toEqual([{ name: "A" }, { name: "B" }]);
	});

	test("状態がない場合だけ初回と判定する", () => {
		expect(isInitialState(null)).toBe(true);
		expect(isInitialState({ version: 1, teamName: "A", url: "https://example.com", players: [], updatedAt: "2026-01-01" })).toBe(false);
	});
});
