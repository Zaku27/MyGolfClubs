type SwingLegendProps = {
  swingGoodTolerance: number;
  swingAdjustThreshold?: number;
};

type LieLegendProps = {
  lieGoodTolerance: number;
};

export const LoftLegend = () => (
  <div className="analysis-legend">
    <span><i style={{ backgroundColor: '#1976d2' }} />ドライバー</span>
    <span><i style={{ backgroundColor: '#0d47a1' }} />ウッド</span>
    <span><i style={{ backgroundColor: '#00acc1' }} />ハイブリッド</span>
    <span><i style={{ backgroundColor: '#0b8f5b' }} />アイアン</span>
    <span><i style={{ backgroundColor: '#9acd32' }} />ウェッジ</span>
    <span><i className="legend-estimated" />推定</span>
    <span><i className="legend-actual" />実測</span>
    <span><i className="legend-actual-line" />実測ライン</span>
  </div>
);

export const LieLegend = ({ lieGoodTolerance }: LieLegendProps) => (
  <div className="analysis-legend">
    <span><i style={{ backgroundColor: '#1976d2' }} />ドライバー</span>
    <span><i style={{ backgroundColor: '#0d47a1' }} />ウッド</span>
    <span><i style={{ backgroundColor: '#00acc1' }} />ハイブリッド</span>
    <span><i style={{ backgroundColor: '#0b8f5b' }} />アイアン</span>
    <span><i style={{ backgroundColor: '#9acd32' }} />ウェッジ</span>
    <span><i style={{ backgroundColor: '#424242' }} />パター</span>
    <span><i className="legend-good-range" />良好範囲 ±{lieGoodTolerance.toFixed(1)}°</span>
    <span><i className="legend-standard-line" />基準値ライン</span>
    <span><i style={{ backgroundColor: '#fb8c00', border: '1.5px solid #e65100', boxSizing: 'border-box' }} />ややズレ</span>
    <span><i style={{ backgroundColor: '#c62828' }} />調整推奨</span>
  </div>
);

export const SwingLegend = ({ swingGoodTolerance, swingAdjustThreshold }: SwingLegendProps) => (
  <div className="analysis-legend">
    <span><i style={{ backgroundColor: '#1976d2' }} />ドライバー</span>
    <span><i style={{ backgroundColor: '#0d47a1' }} />ウッド</span>
    <span><i style={{ backgroundColor: '#00acc1' }} />ハイブリッド</span>
    <span><i style={{ backgroundColor: '#0b8f5b' }} />アイアン</span>
    <span><i style={{ backgroundColor: '#9acd32' }} />ウェッジ</span>
    <span><i style={{ backgroundColor: '#fb8c00' }} />ややズレ</span>
    <span><i style={{ backgroundColor: '#c62828' }} />調整推奨</span>
    <span><i className="legend-good-range" />良好範囲 ±{swingGoodTolerance.toFixed(1)}</span>
    {swingAdjustThreshold && (
      <span><i className="legend-adjust-threshold" />調整閾値 ±{swingAdjustThreshold.toFixed(1)}</span>
    )}
  </div>
);

export const WeightLegend = () => (
  <div className="analysis-legend">
    <span><i style={{ backgroundColor: '#1976d2' }} />ドライバー</span>
    <span><i style={{ backgroundColor: '#0d47a1' }} />ウッド</span>
    <span><i style={{ backgroundColor: '#00acc1' }} />ハイブリッド</span>
    <span><i style={{ backgroundColor: '#0b8f5b' }} />アイアン</span>
    <span><i style={{ backgroundColor: '#9acd32' }} />ウェッジ</span>
    <span><i className="legend-heavy-outlier" />重い</span>
    <span><i className="legend-light-outlier" />軽い</span>
    <span><i className="legend-trend-line" />全体トレンド線</span>
    <span>
      <i
        style={{
          width: 18,
          height: 2,
          backgroundColor: '#1565c0',
          borderRadius: 2,
        }}
      />
      アイアン・ウェッジ線
    </span>
    <span>
      <i
        style={{
          width: 18,
          height: 2,
          backgroundColor: '#2e7d32',
          borderRadius: 2,
        }}
      />
      ハイブリッド・ウッド・ドライバー線
    </span>
    <span><i className="legend-expected-band" />アイアン・ウェッジ 期待帯 ±12g</span>
    <span><i className="legend-expected-band-secondary" />ハイブリッド・ウッド・ドライバー 期待帯 ±12g</span>
  </div>
);

export const LieLengthLegend = ({ tolerance }: { tolerance: number }) => (
  <div className="analysis-legend">
    <span><i style={{ backgroundColor: '#1976d2' }} />ドライバー</span>
    <span><i style={{ backgroundColor: '#0d47a1' }} />ウッド</span>
    <span><i style={{ backgroundColor: '#00acc1' }} />ハイブリッド</span>
    <span><i style={{ backgroundColor: '#0b8f5b' }} />アイアン</span>
    <span><i style={{ backgroundColor: '#9acd32' }} />ウェッジ</span>
    <span><i className="legend-upright-outlier" />アップライト寄り</span>
    <span><i className="legend-flat-outlier" />フラット寄り</span>
    <span><i className="legend-trend-line" />回帰トレンド線</span>
    <span><i className="legend-lie-trend-band" />期待帯 ±{tolerance.toFixed(1)}°</span>
  </div>
);

export const LoftLengthLegend = () => (
  <div className="analysis-legend">
    <span><i style={{ backgroundColor: '#1976d2' }} />ドライバー</span>
    <span><i style={{ backgroundColor: '#0d47a1' }} />ウッド</span>
    <span><i style={{ backgroundColor: '#00acc1' }} />ハイブリッド</span>
    <span><i style={{ backgroundColor: '#0b8f5b' }} />アイアン</span>
    <span><i style={{ backgroundColor: '#9acd32' }} />ウェッジ</span>
    <span><i className="legend-standard-line" />クラブ種別ごとの標準スペックライン</span>
  </div>
);