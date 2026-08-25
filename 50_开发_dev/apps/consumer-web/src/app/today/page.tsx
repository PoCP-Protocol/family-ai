import Link from 'next/link';
import { requestFamilyApi, type FamilyHomeProjection } from '@family/web-platform';

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ familyId?: string }> }) {
	const { familyId } = await searchParams;
	if (!familyId) return <main className="main"><span className="eyebrow">今天工作台</span><h1>先选择家庭</h1><section className="hero"><h2>家庭范围由服务端会话确认</h2><p>登录后从可访问家庭上下文中选择，不接受任意 URL familyId 作为授权来源。</p><Link className="button" href="/select-family">选择家庭</Link></section></main>;
	const result = await requestFamilyApi<FamilyHomeProjection>(`/families/${encodeURIComponent(familyId)}/ui/01/home`);
	if (!result.ok) return <main className="main"><span className="eyebrow">今天工作台</span><h1>暂时无法加载</h1><section className="card"><p>家庭首页暂时不可用（{result.code}）。请重新登录或稍后重试。</p></section></main>;
	const home = result.data;
	return <main className="main"><span className="eyebrow">今天工作台 · UI-01 / UI-09</span><h1>{home.family?.display_name ?? '当前家庭'}</h1><section className="hero"><span className="eyebrow">今晚一件事</span><h2>{home.primary_action?.assignment_text ?? '今天还没有安排好的家庭行动'}</h2><p>当前阶段：{home.journey?.current_phase ?? '尚未开始'} · 状态：{home.primary_action?.status ?? '待确认'}</p><Link className="button" href="/today/action">打开今日行动</Link></section><section className="grid"><article className="card"><span className="eyebrow">家庭记录</span><h2>家庭私有、可回看</h2><p>里程碑与服务状态只在当前授权家庭范围内显示。</p></article><article className="card"><span className="eyebrow">边界</span><h2>不评分、不排名、不诊断</h2><p>首页不调用模型，也不把家庭对话自动分析为事实。</p></article></section></main>;
}
