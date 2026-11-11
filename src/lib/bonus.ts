import { amount, money } from './format.js';
import type { BonusRule, Period } from './types.js';

export const periodName: Record<Period, string> = { day: 'Día', week: 'Semana', month: 'Mes' };

/** "40 cortes en la semana" / "$ 3.500.000 en ventas en el mes" */
export function ruleGoal(r: Pick<BonusRule, 'period' | 'metric' | 'threshold'>) {
	const per = { day: 'en el día', week: 'en la semana', month: 'en el mes' }[r.period];
	return r.metric === 'cuts'
		? `${amount(r.threshold)} ${r.threshold === 1 ? 'corte' : 'cortes'} ${per}`
		: `${money(r.threshold)} en ventas ${per}`;
}

/** "$ 50.000 de premio" / "+5 % sobre su comisión" */
export function ruleReward(r: Pick<BonusRule, 'rewardType' | 'rewardValue'>) {
	return r.rewardType === 'fixed' ? `${money(r.rewardValue)} de premio` : `+${amount(r.rewardValue)} % sobre su comisión`;
}
