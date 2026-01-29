import katex from "katex";
import markdownIt from "markdown-it";
import texmath from "markdown-it-texmath";
import { describe, expect, it } from "vitest";

/**
 * Test suite for markdown math formula rendering.
 * Verifies that both dollar signs and bracket delimiters are supported.
 */
describe("Markdown Math Formula Rendering", () => {
	// Create renderer with the same configuration as markdown-renderer.svelte
	const createRenderer = () => {
		return markdownIt({
			html: false,
			linkify: true,
			typographer: true,
		}).use(texmath, {
			engine: katex,
			delimiters: ["dollars", "brackets"],
			katexOptions: {
				throwOnError: false,
				errorColor: "#cc0000",
				displayMode: false,
				trust: true,
				strict: false,
				output: "html",
			},
		});
	};

	describe("Dollar sign delimiters", () => {
		it("should render inline math with single dollar signs", () => {
			const md = createRenderer();
			const result = md.render("This is $x^2$ inline math");

			expect(result).toContain("katex");
			expect(result).toContain("x");
			expect(result).not.toContain("$x^2$");
		});

		it("should render display math with double dollar signs", () => {
			const md = createRenderer();
			const result = md.render("$$E = mc^2$$");

			expect(result).toContain("katex");
			expect(result).toContain("E");
			expect(result).not.toContain("$$E = mc^2$$");
		});
	});

	describe("Bracket delimiters (LaTeX style)", () => {
		it("should render inline math with \\(...\\)", () => {
			const md = createRenderer();
			const result = md.render("This is \\(\\phi_{n,k}\\) inline math");

			expect(result).toContain("katex");
			// \phi renders to Unicode ϕ
			expect(result).toContain("ϕ");
			expect(result).not.toContain("\\(\\phi_{n,k}\\)");
		});

		it("should render display math with \\[...\\]", () => {
			const md = createRenderer();
			const result = md.render("\\[ z_{t,n,k} \\triangleq \\phi_{n,k}(g_{t,n}) \\]");

			expect(result).toContain("katex");
			// \triangleq renders to Unicode ≜
			expect(result).toContain("≜");
			expect(result).not.toContain("\\[");
			expect(result).not.toContain("\\]");
		});
	});

	describe("Mixed delimiters in same document", () => {
		it("should render both dollar and bracket delimiters together", () => {
			const md = createRenderer();
			const content = `
## Math Examples

Inline with dollars: $x^2 + y^2 = z^2$

Inline with brackets: \\(\\alpha + \\beta\\)

Display with dollars:
$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$

Display with brackets:
\\[ z_{t,n,k} \\triangleq \\phi_{n,k}(g_{t,n}) \\]
`;
			const result = md.render(content);

			// All formulas should be rendered (contain katex class)
			const katexCount = (result.match(/katex/g) || []).length;
			expect(katexCount).toBeGreaterThanOrEqual(4);

			// Raw delimiters should not appear in output
			expect(result).not.toContain("$x^2");
			expect(result).not.toContain("\\(\\alpha");
			expect(result).not.toContain("$$\\sum");
			expect(result).not.toContain("\\[ z_");
		});
	});

	describe("Real-world formula from bug report", () => {
		it("should render the hash index formula correctly", () => {
			const md = createRenderer();

			// This is the exact formula from the bug report screenshot
			const content = `
### 3.2 第一步：哈希得到索引

\\[ z_{t,n,k} \\triangleq \\phi_{n,k}(g_{t,n}) \\]

- \\(\\phi_{n,k}\\) 是确定性的哈希函数（同一个 \\(g\\) 永远得到同一个 \\(z\\)）
- 输出 \\(z_{t,n,k}\\) 是一个整数索引，实际实现里通常隐含了 \`mod M_{n,k}\`，保证落在表的范围内
`;
			const result = md.render(content);

			// Verify the main formula renders
			expect(result).toContain("katex");
			// \triangleq renders to Unicode ≜
			expect(result).toContain("≜");

			// Verify inline formulas render (\phi -> ϕ)
			expect(result).toContain("ϕ");

			// Raw LaTeX delimiters should not appear
			expect(result).not.toContain("\\[");
			expect(result).not.toContain("\\]");
			expect(result).not.toContain("\\(\\phi");
			expect(result).not.toContain("\\(g\\)");
		});
	});

	describe("Edge cases", () => {
		it("should handle subscripts and superscripts", () => {
			const md = createRenderer();
			const result = md.render("\\(x_{i,j}^{2}\\)");

			expect(result).toContain("katex");
			expect(result).not.toContain("\\(x_{i,j}");
		});

		it("should handle special LaTeX commands like triangleq", () => {
			const md = createRenderer();
			const result = md.render("\\(a \\triangleq b\\)");

			expect(result).toContain("katex");
			// triangleq should be rendered as the triangle-equal symbol
		});

		it("should preserve mod in inline code but render in math", () => {
			const md = createRenderer();
			const result = md.render("Use \\(x \\mod n\\) for modulo");

			expect(result).toContain("katex");
			expect(result).toContain("mod");
		});
	});
});
