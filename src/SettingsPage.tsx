import React from 'react';
import { Layers, Sparkles, ArrowRight } from 'lucide-react';
import { ProjectSettings } from './types';
import { cn } from './lib/utils';

const VIDEO_FORMATS = [
  '指定なし',
  'Web広告',
  'インタビュー動画',
  'モーショングラフィックス',
  'イベントOP',
  '採用動画',
  'その他',
];

const TONE_PRESETS = [
  'プロフェッショナル',
  '爽やか・明るい',
  'シリアス・重厚',
  'ポップ・カジュアル',
  '感情的・ドラマチック',
];

interface SettingsPageProps {
  settings: ProjectSettings;
  onChange: (s: ProjectSettings) => void;
  onStartEditing: () => void;
  onGenerateWithAI: () => void;
  isGenerating: boolean;
  hasExistingFrames: boolean;
}

export default function SettingsPage({
  settings,
  onChange,
  onStartEditing,
  onGenerateWithAI,
  isGenerating,
  hasExistingFrames,
}: SettingsPageProps) {
  const set = (key: keyof ProjectSettings, value: any) =>
    onChange({ ...settings, [key]: value });

  const canProceed = settings.title.trim().length > 0;

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] text-zinc-300 font-sans overflow-hidden print:hidden">
      {/* Header */}
      <header className="shrink-0 h-14 border-b border-zinc-800 bg-[#1a1a1a] flex items-center px-8">
        <div className="flex items-center gap-2">
          <Layers className="text-amber-500 w-5 h-5" />
          <span className="text-base font-bold tracking-tight text-zinc-200">Storyboarder</span>
        </div>
        <span className="ml-4 text-xs text-zinc-600 font-mono uppercase tracking-widest">プロジェクト設定</span>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-10 space-y-10">

          {/* Section: 基本情報 */}
          <section className="space-y-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-3">
              基本情報
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                タイトル
                <span className="text-amber-500 text-[10px]">必須</span>
              </label>
              <input
                type="text"
                value={settings.title}
                onChange={e => set('title', e.target.value)}
                placeholder="例：GMO採用動画 2025 / 新商品CM"
                className="w-full bg-[#1e1e1e] border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400">動画の目的</label>
                <textarea
                  value={settings.purpose}
                  onChange={e => set('purpose', e.target.value)}
                  placeholder="例：新サービスの認知拡大、応募者増加"
                  rows={3}
                  className="w-full bg-[#1e1e1e] border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 resize-none transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400">ターゲット視聴者</label>
                <textarea
                  value={settings.target}
                  onChange={e => set('target', e.target.value)}
                  placeholder="例：20〜30代 転職検討中のエンジニア"
                  rows={3}
                  className="w-full bg-[#1e1e1e] border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 resize-none transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400">総尺（秒）</label>
                <input
                  type="number"
                  value={settings.totalDuration}
                  min={5}
                  max={3600}
                  onChange={e => set('totalDuration', parseInt(e.target.value) || 30)}
                  className="w-full bg-[#1e1e1e] border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400">動画フォーマット</label>
                <select
                  value={settings.format}
                  onChange={e => set('format', e.target.value)}
                  className="w-full bg-[#1e1e1e] border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50 transition-colors"
                >
                  {VIDEO_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Section: マーケティング情報 */}
          <section className="space-y-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-3">
              マーケティング情報
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400">ブランド・商品名</label>
                <input
                  type="text"
                  value={settings.brand}
                  onChange={e => set('brand', e.target.value)}
                  placeholder="例：GMOペパボ / ロリポップ！"
                  className="w-full bg-[#1e1e1e] border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400">CTA（行動喚起）</label>
                <input
                  type="text"
                  value={settings.cta}
                  onChange={e => set('cta', e.target.value)}
                  placeholder="例：今すぐ応募 / 無料で試す"
                  className="w-full bg-[#1e1e1e] border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400">訴求ポイント（USP）</label>
              <textarea
                value={settings.usp}
                onChange={e => set('usp', e.target.value)}
                placeholder="例：フルリモート・自由な働き方・技術力が高いエンジニア組織"
                rows={2}
                className="w-full bg-[#1e1e1e] border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 resize-none transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400">トーン＆マナー</label>
              <div className="flex flex-wrap gap-2">
                {TONE_PRESETS.map(tone => (
                  <button
                    key={tone}
                    onClick={() => set('tonePreset', settings.tonePreset === tone ? '' : tone)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      settings.tonePreset === tone
                        ? "bg-amber-500/20 border-amber-500/60 text-amber-400"
                        : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400"
                    )}
                  >
                    {tone}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={settings.toneCustom}
                onChange={e => set('toneCustom', e.target.value)}
                placeholder="自由記述（例：スタイリッシュで都会的）"
                className="w-full bg-[#1e1e1e] border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>
          </section>

          {/* Section: 映像仕様 */}
          <section className="space-y-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-3">
              映像仕様
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400">
                  想定カット数
                  <span className="text-zinc-600 font-normal ml-2">（空白でAIが自動算出）</span>
                </label>
                <input
                  type="number"
                  value={settings.estimatedCuts ?? ''}
                  min={1}
                  max={100}
                  onChange={e => set('estimatedCuts', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="自動"
                  className="w-full bg-[#1e1e1e] border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400">ナレーション</label>
                <div className="flex gap-2 pt-1">
                  {(['no', 'yes'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => set('narration', v)}
                      className={cn(
                        "flex-1 py-2.5 rounded-lg text-xs font-bold border transition-all",
                        settings.narration === v
                          ? "bg-amber-500/20 border-amber-500/60 text-amber-400"
                          : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-600"
                      )}
                    >
                      {v === 'yes' ? 'あり' : 'なし'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400">BGMの雰囲気</label>
              <input
                type="text"
                value={settings.bgmMood}
                onChange={e => set('bgmMood', e.target.value)}
                placeholder="例：アップテンポ・爽やか / シネマティック・壮大"
                className="w-full bg-[#1e1e1e] border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400">参考・禁止事項</label>
              <textarea
                value={settings.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="例：競合他社名は出さない / ○○のCMのようなスタイル"
                rows={3}
                className="w-full bg-[#1e1e1e] border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 resize-none transition-colors"
              />
            </div>
          </section>

          {/* spacer for sticky footer */}
          <div className="h-4" />
        </div>
      </div>

      {/* Sticky footer: action buttons */}
      <div className="shrink-0 border-t border-zinc-800 bg-[#1a1a1a] px-8 py-5">
        <div className="max-w-2xl mx-auto flex gap-3">
          <button
            onClick={onStartEditing}
            disabled={!canProceed}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold border transition-all",
              canProceed
                ? "bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700"
                : "bg-zinc-900 border-zinc-800 text-zinc-700 cursor-not-allowed"
            )}
          >
            <ArrowRight size={16} />
            {hasExistingFrames ? '編集に戻る' : '編集を開始'}
          </button>
          <button
            onClick={onGenerateWithAI}
            disabled={!canProceed || isGenerating}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all",
              canProceed && !isGenerating
                ? "bg-amber-500 text-[#0f0f0f] hover:bg-amber-400"
                : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            )}
          >
            {isGenerating ? (
              <><div className="w-4 h-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />AIが考え中...</>
            ) : (
              <><Sparkles size={16} />AIにコンテを考えてもらう</>
            )}
          </button>
        </div>
        {!canProceed && (
          <p className="max-w-2xl mx-auto mt-2 text-xs text-zinc-600 text-center">
            タイトルを入力すると進めるよ
          </p>
        )}
      </div>
    </div>
  );
}
