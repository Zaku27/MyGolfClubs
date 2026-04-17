export interface SummaryData {
  currentSet: {
    clubCount: number;
    avgDriverDistance: number;     // ヤード
    avg7IronDistance: number;
    potentialGain: number;         // 改善ポテンシャル（ヤード）
  };
  recommendations: Recommendation[];
  adjustments: Adjustment[];
}

export interface Recommendation {
  category: 'Driver' | 'Fairway' | 'Hybrid' | 'Iron' | 'Wedge' | 'Putter';
  clubName: string;
  brand: string;
  reason: string[];                    // 3つ以内の短い理由
  expectedDistanceGain: number;        // 期待飛距離向上
  expectedAccuracyGain?: number;       // オプションで精度向上
  imageUrl?: string;                   // 将来的に画像URL
}

export interface Adjustment {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  estimatedEffect: string;             // 例: "飛距離 +8yd 見込み"
}
