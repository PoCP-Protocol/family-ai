import Link from 'next/link';

export default async function FamilyDetailsPage({ params }: { params: Promise<{ familyId: string }> }) {
  const { familyId } = await params;
  return <main className="ops-main"><span className="ops-badge">家庭运营</span><h1>家庭详情</h1><section className="ops-card"><p>请求范围由服务端租户、角色和家庭授权确认。URL 中的标识不会单独产生权限。</p><p>当前请求标识：{familyId}</p><Link href="/families">返回家庭列表</Link></section></main>;
}
