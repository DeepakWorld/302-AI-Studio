import { PLATFORM } from "@electron/main/constants/index";
import { match } from "ts-pattern";

/**
 * Command line error type constants
 */
export const CmdErrorType = {
	/** Command not found (not installed or not in PATH) */
	COMMAND_NOT_FOUND: "COMMAND_NOT_FOUND",
	/** Command executed but returned non-zero exit code */
	NON_ZERO_EXIT: "NON_ZERO_EXIT",
	/** Permission denied */
	PERMISSION_DENIED: "PERMISSION_DENIED",
	/** Other system-level errors */
	SYSTEM_ERROR: "SYSTEM_ERROR",
} as const;

export type CmdErrorType = (typeof CmdErrorType)[keyof typeof CmdErrorType];

/**
 * Extended ExecException type with child_process specific properties
 */
interface ExtendedExecError extends Error {
	code?: string;
	errno?: number;
	syscall?: string;
	killed?: boolean;
	status?: number | null;
	signal?: NodeJS.Signals | null;
}

/**
 * Check if error is "command not found"
 * Supports Windows, macOS, Linux
 */
export function isCommandNotFound(error: unknown): boolean {
	const isCommandNotFoundMessage = (message: string) => {
		const lowerMsg = message.toLowerCase();
		if (lowerMsg.includes("enoent")) return true;

		return match(PLATFORM)
			.with({ IS_WINDOWS: true }, () =>
				match(lowerMsg)
					.when(
						(m) => m.includes("is not recognized"),
						() => true,
					)
					.when(
						(m) => m.includes("cannot find the path"),
						() => true,
					)
					.otherwise(() => false),
			)
			.with({ IS_MAC: true }, { IS_LINUX: true }, () =>
				match(lowerMsg)
					.when(
						(m) => m.includes("command not found"),
						() => true,
					)
					.when(
						(m) => m.includes("no such file or directory"),
						() => true,
					)
					.otherwise(() => false),
			)
			.otherwise(() => false);
	};

	return match(error)
		.when(
			(err): err is ExtendedExecError => err instanceof Error,
			(err) => {
				if (err.code === "ENOENT" || err.status === 127) return true;
				return isCommandNotFoundMessage(err.message);
			},
		)
		.when(
			(err): err is string => typeof err === "string",
			(err) => isCommandNotFoundMessage(err),
		)
		.otherwise(() => false);
}

/**
 * Check if error is permission denied
 */
export function isPermissionDenied(error: unknown): boolean {
	return match(error)
		.when(
			(err): err is ExtendedExecError => err instanceof Error,
			(err) => {
				const message = err.message.toLowerCase();

				return match(err.code)
					.with("EACCES", () => true)
					.with("EPERM", () => true)
					.otherwise(() =>
						match(message)
							.when(
								(m) => m.includes("permission denied"),
								() => true,
							)
							.when(
								(m) => m.includes("operation not permitted"),
								() => true,
							)
							.when(
								(m) => m.includes("access is denied"),
								() => true,
							)
							.when(
								(m) => m.includes("access denied"),
								() => true,
							)
							.when(
								(m) => m.includes("requires elevation"),
								() => true,
							)
							.otherwise(() => false),
					);
			},
		)
		.otherwise(() => false);
}

/**
 * Check if error is a WSL-related error (Windows only)
 * Used for detecting Podman machine WSL distribution issues
 */
export function isWSLError(error: unknown): boolean {
	const isWSLErrMessage = (message: string): boolean => {
		const lowerMsg = message.toLowerCase();
		return (
			lowerMsg.includes("wsl_e_distro_not_found") ||
			lowerMsg.includes("bootstrap script failed") ||
			lowerMsg.includes("exit status 0xffffffff") ||
			(lowerMsg.includes("wsl") && lowerMsg.includes("not found"))
		);
	};

	return match(error)
		.when(
			(err): err is ExtendedExecError => err instanceof Error,
			(err) => isWSLErrMessage(err.message),
		)
		.when(
			(err): err is string => typeof err === "string",
			(err) => isWSLErrMessage(err),
		)
		.otherwise(() => false);
}

/**
 * Parse command execution error type
 */
export function parseCmdError(error: unknown): {
	type: CmdErrorType;
	message: string;
	code?: number;
} {
	return match(error)
		.when(
			(err): err is ExtendedExecError => err instanceof Error,
			(err) => {
				const getExitCode = (): number | undefined =>
					typeof err.status === "number" ? err.status : undefined;

				return match({
					isCmdNotFound: isCommandNotFound(err),
					isPermDenied: isPermissionDenied(err),
				})
					.with({ isCmdNotFound: true }, () => ({
						type: CmdErrorType.COMMAND_NOT_FOUND,
						message: err.message,
						code: getExitCode(),
					}))
					.with({ isPermDenied: true }, () => ({
						type: CmdErrorType.PERMISSION_DENIED,
						message: err.message,
						code: getExitCode(),
					}))
					.with({ isCmdNotFound: false, isPermDenied: false }, () => {
						if (err.killed === false && typeof err.status === "number") {
							return {
								type: CmdErrorType.NON_ZERO_EXIT,
								message: err.message,
								code: err.status,
							};
						}
						return {
							type: CmdErrorType.SYSTEM_ERROR,
							message: err.message,
							code: getExitCode(),
						};
					})
					.exhaustive();
			},
		)
		.otherwise(() => ({
			type: CmdErrorType.SYSTEM_ERROR,
			message: String(error),
		}));
}
