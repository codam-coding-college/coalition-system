import { SessionData } from "express-session";

export interface CustomSessionData extends SessionData {
	returnTo?: string;
	quiz?: {
		currentQuestionId?: number | null;
		questionsAnswered?: number[];
		coalitionScores?: {[key: number]: number};
	},
}
