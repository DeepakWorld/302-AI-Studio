import { setLocale } from "$lib/paraglide/runtime";

export function applyLocale(lang: "en") {
	setLocale(lang, { reload: true });
}
