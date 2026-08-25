import Link from 'next/link';
import { requestFamilyApi, type ContextsResponse } from '@family/web-platform';

export default async function SelectFamilyPage() {
  const result = await requestFamilyApi<ContextsResponse>('/auth/contexts');
  if (!result.ok) return <main className="main"><span className="eyebrow">家庭上下文</span><h1>暂时无法读取家庭</h1><section className="card"><p>请重新登录或稍后重试。当前没有使用 URL 中的 familyId 作为授权依据。</p><Link className="button" href="/login">返回登录</Link></section></main>;
  if (result.data.contexts.length === 0) return <main className="main"><span className="eyebrow">家庭上下文</span><h1>还没有可访问的家庭</h1><section className="card"><p>当前账号尚未绑定家庭。完成家庭建立后，这里会显示可选择的家庭空间。</p></section></main>;
  return <main className="main"><span className="eyebrow">选择家庭</span><h1>进入家庭成长工作台</h1><section className="grid">{result.data.contexts.map((context) => <Link className="card context-link" href={`/today?familyId=${encodeURIComponent(context.familyId)}`} key={context.familyId}><h2>{context.displayName}</h2><p>{context.role} · 家庭范围由服务端会话确认</p></Link>)}</section></main>;
}
