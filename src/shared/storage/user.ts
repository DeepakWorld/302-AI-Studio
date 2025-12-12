export interface UserInfo {
	uid: number;
	user_name: string;
	email: string;
	phone: string;
	avatar: string;
	balance: number;
	api_key: string;
	has_pwd: boolean;
	is_new_user: boolean;
	region: number;
	total_balance: number;
	gpt_cost: number;
	gpt_request_times: number;
	invite_code: string;
	invitation_link: string;
	ref: string;
	has_gift: boolean;
	inv_switch: boolean;
	question_switch: boolean;
	show_questionnaire_windows: boolean;
	to_band_phone: boolean;
	total_earning: number;
	today_earning: number;
	total_app: number;
	is_developer: number;
	resource_area: number;
	register_from: string;
}

export interface UserState {
	token: string | null;
	userInfo: UserInfo | null;
	isLoggedIn: boolean;
	/** The original API key obtained from SSO login, used to track association */
	ssoApiKey: string | null;
}
