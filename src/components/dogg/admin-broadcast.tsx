import { useCallback, useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Send, RefreshCw, ImagePlus, X, Square, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { adminBroadcasts, adminCancelBroadcast, adminSendBroadcast } from '@/lib/admin.functions';
import { useT } from './lang';
import { currentLang, LOCALE, t as tg } from '@/lib/i18n';
import { friendlyError, haptic } from '@/lib/dogg';

const initData = () => window.Telegram?.WebApp?.initData ?? '';
const n = (v: number) => Number(v ?? 0).toLocaleString(LOCALE[currentLang()]);
const when = (iso: string) => new Date(iso).toLocaleString(LOCALE[currentLang()], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
type Img = { base64: string; mime: 'image/jpeg' | 'image/png' | 'image/webp'; preview: string };

export function BroadcastAdmin() {
  const t = useT();
  const list = useServerFn(adminBroadcasts);
  const send = useServerFn(adminSendBroadcast);
  const cancel = useServerFn(adminCancelBroadcast);
  const [data, setData] = useState<Awaited<ReturnType<typeof list>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [img, setImg] = useState<Img | null>(null);
  const [btnText, setBtnText] = useState('');
  const [btnUrl, setBtnUrl] = useState('');
  const [busy, setBusy] = useState<'test' | 'send' | null>(null);

  const reload = useCallback(() => { setLoading(true); list({ data: { initData: initData() } }).then(setData).catch(e => toast.error(friendlyError(e, tg('admin.loadFail')))).finally(() => setLoading(false)); }, [list]);
  useEffect(reload, [reload]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error(t('bc.tooBig')); return; }
    const mime = (['image/jpeg', 'image/png', 'image/webp'].includes(f.type) ? f.type : 'image/jpeg') as Img['mime'];
    const reader = new FileReader();
    reader.onload = () => { const url = String(reader.result); setImg({ base64: url.slice(url.indexOf(',') + 1), mime, preview: url }); };
    reader.readAsDataURL(f);
  }

  async function submit(test: boolean) {
    if (!text.trim()) return;
    if (!test && !window.confirm(t('bc.confirm', { n: n(data?.audience ?? 0) }))) return;
    haptic(); setBusy(test ? 'test' : 'send');
    try {
      await send({ data: { initData: initData(), text, image: img ? { base64: img.base64, mime: img.mime } : null, buttonText: btnText || undefined, buttonUrl: btnUrl || undefined, test } });
      if (test) toast.success(t('bc.tested'));
      else { toast.success(t('bc.queued')); setText(''); setImg(null); setBtnText(''); setBtnUrl(''); reload(); }
    } catch (err) { toast.error(friendlyError(err, t('admin.saveFail'))); } finally { setBusy(null); }
  }

  async function stop(id: string) {
    try { await cancel({ data: { initData: initData(), id } }); reload(); } catch (err) { toast.error(friendlyError(err)); }
  }

  const max = img ? 1024 : 4000;
  return <>
    <form className="admin-card admin-form" onSubmit={e => { e.preventDefault(); void submit(false); }}>
      <h2><Send /> {t('bc.title')}</h2>
      <p className="admin-muted">{t('bc.help', { n: n(data?.audience ?? 0) })}</p>
      <label>{t('bc.text')}<Textarea required rows={5} maxLength={max} value={text} onChange={e => setText(e.target.value)} placeholder={t('bc.textPh')} /><small>{text.length}/{max}</small></label>
      <label>{t('bc.image')}
        {img
          ? <span className="bc-img"><img src={img.preview} alt="" /><Button type="button" size="sm" variant="outline" onClick={() => setImg(null)}><X /> {t('bc.removeImage')}</Button></span>
          : <span className="bc-pick"><ImagePlus /><input type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} /></span>}
      </label>
      <div className="admin-row2">
        <label>{t('bc.btnText')}<Input maxLength={40} value={btnText} onChange={e => setBtnText(e.target.value)} placeholder="🚀 Open" /></label>
        <label>{t('bc.btnUrl')}<Input value={btnUrl} onChange={e => setBtnUrl(e.target.value)} placeholder="https://t.me/Doggminerbot/miner" /></label>
      </div>
      <div className="admin-actions">
        <Button type="submit" disabled={!!busy || !text.trim()}>{busy === 'send' ? <RefreshCw className="animate-spin" /> : <Send />} {t('bc.send')}</Button>
        <Button type="button" variant="outline" disabled={!!busy || !text.trim()} onClick={() => void submit(true)}>{busy === 'test' ? <RefreshCw className="animate-spin" /> : <FlaskConical />} {t('bc.test')}</Button>
      </div>
    </form>
    <div className="admin-bar"><span>{t('bc.history')}</span><Button size="sm" variant="outline" onClick={reload} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} /></Button></div>
    <div className="admin-list">
      {data?.list.length === 0 && <p className="admin-muted">{t('bc.empty')}</p>}
      {data?.list.map(b => <article key={b.id} className={`admin-item ${b.status === 'cancelled' ? 'off' : ''}`}>
        <span className="admin-ico">{b.photo_file_id ? <ImagePlus /> : <Send />}</span>
        <div><strong>{b.text.slice(0, 80)}{b.text.length > 80 ? '…' : ''}</strong>
          <small>{t(`bc.status.${b.status as 'queued'}`)} · {when(b.created_at)}</small>
          <small>{t('bc.stats', { s: n(b.sent), f: n(b.failed), g: n(b.gone) })}</small>
          {b.button_url && <small className="admin-mono">{b.button_text} → {b.button_url}</small>}</div>
        {(b.status === 'queued' || b.status === 'sending') && <div className="admin-btns"><Button size="icon" variant="ghost" aria-label={t('bc.cancel')} onClick={() => void stop(b.id)}><Square /></Button></div>}
      </article>)}
    </div>
  </>;
}
