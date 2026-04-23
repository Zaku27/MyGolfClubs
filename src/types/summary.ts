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

export interface ProposedSpec {
  loftAngle?: number;
  length?: number;
  swingWeight?: string;
  lieAngle?: number;
  condition?: string;
}

export interface Recommendation {
  category: 'Driver' | 'Fairway' | 'Hybrid' | 'Iron' | 'Wedge' | 'Putter';
  clubName: string;
  brand?: string;                      // オプション化（スペック中心の表示に変更）
  reason: string[];                    // 3つ以内の短い理由
  expectedDistanceGain: number;        // 期待飛距離向上
  expectedAccuracyGain?: number;       // オプションで精度向上
  imageUrl?: string;                   // 将来的に画像URL
  proposedSpec?: ProposedSpec;         // 提案スペック
  actionType?: 'add' | 'replace';      // 追加か入れ替えか
  replaceTarget?: string;              // 入れ替え対象のクラブ名
}

export interface Adjustment {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  estimatedEffect: string;             // 例: "飛距離 +8yd 見込み"
}
