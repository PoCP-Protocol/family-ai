import Link from 'next/link';
export default function TodayPage() { return <main className="main"><span className="eyebrow">今天工作台</span><h1>今天</h1><section className="hero"><h2>连接家庭后显示今晚一件事</h2><p>真实版本将读取 FamilyHomeProjection、今日行动和当前 90 天旅程摘要。</p><Link className="button" href="/login">登录并继续</Link></section></main>; }
