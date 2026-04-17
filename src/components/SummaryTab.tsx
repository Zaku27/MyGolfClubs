import type { SummaryData, Recommendation, Adjustment } from '../types/summary';

// Inline SVG icon components
const IconTrophy = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} width="1em" height="1em">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const IconTarget = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} width="1em" height="1em">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const IconTrendingUp = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} width="1em" height="1em">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const IconFileDown = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} width="1em" height="1em">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M12 18v-6" />
    <path d="m9 15 3 3 3-3" />
  </svg>
);

const IconMapPin = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} width="1em" height="1em">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconCheckCircle = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} width="1em" height="1em">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

interface SummaryTabProps {
  data: SummaryData;
}

const categoryLabel: Record<Recommendation['category'], string> = {
  Driver: 'ドライバー',
  Fairway: 'フェアウェイウッド',
  Hybrid: 'ハイブリッド',
  Iron: 'アイアン',
  Wedge: 'ウェッジ',
  Putter: 'パター',
};

const priorityConfig: Record<Adjustment['priority'], { color: string; label: string; badgeClass: string }> = {
  high: { color: 'text-red-500', label: '優先度高', badgeClass: 'bg-red-100 text-red-700 border-red-200' },
  medium: { color: 'text-orange-500', label: '優先度中', badgeClass: 'bg-orange-100 text-orange-700 border-orange-200' },
  low: { color: 'text-blue-500', label: '優先度低', badgeClass: 'bg-blue-100 text-blue-700 border-blue-200' },
};

export function SummaryTab({ data }: SummaryTabProps) {
  const { currentSet, recommendations, adjustments } = data;

  return (
    <div className="space-y-8 pb-8">
      {/* 1. 全体サマリーKPIセクション */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 使用クラブ本数 */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <IconTrophy className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">使用クラブ本数</span>
            </div>
            <p className="text-3xl font-bold">{currentSet.clubCount}<span className="text-lg font-normal text-muted-foreground">本</span></p>
          </div>

          {/* ドライバー平均飛距離 */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <IconTarget className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">ドライバー平均</span>
            </div>
            <p className="text-3xl font-bold">{currentSet.avgDriverDistance}<span className="text-lg font-normal text-muted-foreground">yd</span></p>
          </div>

          {/* 7I平均飛距離 */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <IconTarget className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">7I平均飛距離</span>
            </div>
            <p className="text-3xl font-bold">{currentSet.avg7IronDistance}<span className="text-lg font-normal text-muted-foreground">yd</span></p>
          </div>

          {/* 改善ポテンシャル */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <IconTrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-sm text-muted-foreground">改善ポテンシャル</span>
            </div>
            <p className="text-3xl font-bold text-green-600">+{currentSet.potentialGain}<span className="text-lg font-normal text-muted-foreground">yd</span></p>
          </div>
        </div>
      </section>

      {/* セパレーター */}
      <div className="h-px bg-border" />

      {/* 2. おすすめ新クラブ提案セクション */}
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <IconTrophy className="w-5 h-5 text-primary" />
          おすすめ新クラブ
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {recommendations.map((rec, index) => (
            <div key={index} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              {/* 画像エリア */}
              <div className="aspect-video bg-muted flex items-center justify-center">
                {rec.imageUrl ? (
                  <img
                    src={rec.imageUrl}
                    alt={rec.clubName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-muted-foreground text-sm">
                    <IconTarget className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    {categoryLabel[rec.category]}
                  </div>
                )}
              </div>

              {/* コンテンツエリア */}
              <div className="p-4 space-y-3">
                {/* ヘッダー */}
                <div>
                  <p className="text-sm text-muted-foreground">{rec.brand}</p>
                  <h3 className="font-semibold text-lg">{rec.clubName}</h3>
                </div>

                {/* 理由 */}
                <ul className="space-y-1">
                  {rec.reason.map((r, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {r}
                    </li>
                  ))}
                </ul>

                {/* 期待効果 */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                    +{rec.expectedDistanceGain}yd
                  </span>
                  {rec.expectedAccuracyGain && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                      精度 +{rec.expectedAccuracyGain}%
                    </span>
                  )}
                </div>

                {/* アクションボタン */}
                <button className="w-full mt-3 px-4 py-2 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors text-sm font-medium">
                  このクラブの詳細分析へ
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* セパレーター */}
      <div className="h-px bg-border" />

      {/* 3. 調整・フィッティング提案セクション */}
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <IconCheckCircle className="w-5 h-5 text-primary" />
          調整・フィッティング提案
        </h2>
        <div className="space-y-3">
          {adjustments.map((adj, index) => {
            const priority = priorityConfig[adj.priority];
            return (
              <div
                key={index}
                className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* 優先度バッジ */}
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border shrink-0 ${priority.badgeClass}`}>
                    {priority.label}
                  </span>

                  {/* コンテンツ */}
                  <div className="flex-1 space-y-2">
                    <h3 className="font-semibold text-lg">{adj.title}</h3>
                    <p className="text-sm text-muted-foreground">{adj.description}</p>

                    {/* 効果 */}
                    <div className="flex flex-wrap gap-3 pt-1">
                      <span className="inline-flex items-center text-sm text-green-600 font-medium">
                        <IconTrendingUp className="w-4 h-4 mr-1" />
                        {adj.estimatedEffect}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* セパレーター */}
      <div className="h-px bg-border" />

      {/* 4. 全体評価セクション（フッター風） */}
      <section className="bg-muted/50 rounded-xl p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="font-semibold text-lg">クラブセット完成度</h3>
            <div className="flex items-center gap-4">
              <div className="w-48 h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${Math.min(100, (currentSet.clubCount / 14) * 100)}%` }}
                />
              </div>
              <span className="text-sm text-muted-foreground">{currentSet.clubCount}/14本</span>
            </div>
          </div>

          {/* CTAボタン */}
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium">
              <IconFileDown className="w-4 h-4" />
              この提案をPDFで保存
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors font-medium">
              <IconMapPin className="w-4 h-4" />
              ショップ検索
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
