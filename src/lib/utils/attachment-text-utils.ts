/**
 * Adds an attachment reference (e.g., @filename) to the text.
 * @param text The current text content.
 * @param attachmentName The name of the attachment to reference.
 * @returns The updated text with the attachment reference appended.
 */
export function addAttachmentReference(text: string, attachmentName: string): string {
	const prefix = text.length > 0 && !text.endsWith(" ") ? " " : "";
	return `${text}${prefix}@${attachmentName} `;
}

/**
 * Removes an attachment reference (e.g., @filename) from the text.
 * @param text The current text content.
 * @param attachmentName The name of the attachment to remove the reference for.
 * @returns The updated text with the attachment reference removed.
 */
export function removeAttachmentReference(text: string, attachmentName: string): string {
	const escapedName = attachmentName.replace(/[.*+?^${}()|[\\]/g, "\\$&");
	const regex = new RegExp(`@${escapedName}\\s?`);
	return text.replace(regex, "");
}
