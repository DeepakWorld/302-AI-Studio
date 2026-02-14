export type ReasoningState = {
	[messageId: string]: {
		[partIndex: string]: boolean;
	};
};

export type ChatUIStateData = {
	reasoningState: ReasoningState;
};
