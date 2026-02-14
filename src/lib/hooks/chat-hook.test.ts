import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("chat-hook export naming", () => {
	it("should not contain misspelled afterChatFinshed export", () => {
		const filePath = path.resolve(process.cwd(), "src/lib/hooks/chat-hook.svelte.ts");
		const source = readFileSync(filePath, "utf-8");

		expect(source).not.toContain("afterChatFinshed");
	});
});
