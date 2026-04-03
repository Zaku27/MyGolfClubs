import type { ChangeEvent } from 'react';

export type AnalysisTab = 'weightLength' | 'loftDistance' | 'lieAngle' | 'swingWeight';

const ANALYSIS_TAB_OPTIONS: Array<{ tab: AnalysisTab; label: string }> = [
  { tab: 'loftDistance', label: 'ロフトと飛距離' },
  { tab: 'lieAngle', label: 'ライ角分布' },
  { tab: 'weightLength', label: '重量と長さ' },
  { tab: 'swingWeight', label: 'SW分布' },
];

const ANALYSIS_TAB_TITLE: Record<AnalysisTab, string> = {
  weightLength: '重量 - 長さ',
  loftDistance: 'ロフト - 飛距離',
  swingWeight: 'スイングウェイト分布',
  lieAngle: 'ライ角分布',
};

const ANALYSIS_TAB_SUBTITLE: Record<AnalysisTab, string> = {
  weightLength: '回帰トレンドからの偏差で、重すぎるクラブと軽すぎるクラブをすぐに判別できます。',
  loftDistance:
    '推定飛距離はクラブ種別ごとの個別カーブを使い、42 m/s 基準でヘッドスピード補正しています。',
  swingWeight:
    'D2 を基準にスイングウェイトのばらつきを可視化し、調整が必要なクラブを特定できます。',
  lieAngle:
    '全クラブのライ角分布を確認し、アイアンセットの一貫性やフィッティング問題を把握できます。',
};

type AnalysisHeaderProps = {
  activeTab: AnalysisTab;
  onTabChange: (tab: AnalysisTab) => void;
  headSpeed: number;
  onHeadSpeedChange: (event: ChangeEvent<HTMLInputElement>) => void;
  showSwingSettings: boolean;
  onToggleSwingSettings: () => void;
  showLieSettings: boolean;
  onToggleLieSettings: () => void;
  onBack: () => void;
};

export const AnalysisHeader = ({
  activeTab,
  onTabChange,
  headSpeed,
  onHeadSpeedChange,
  showSwingSettings,
  onToggleSwingSettings,
  showLieSettings,
  onToggleLieSettings,
  onBack,
}: AnalysisHeaderProps) => (
  <div className="analysis-header">
    <div>
      <p className="analysis-eyebrow">分析ビュー</p>
      <h1>{ANALYSIS_TAB_TITLE[activeTab]}</h1>
      <p className="analysis-subtitle">{ANALYSIS_TAB_SUBTITLE[activeTab]}</p>
      <div className="analysis-tab-nav" role="tablist" aria-label="分析タブ">
        {ANALYSIS_TAB_OPTIONS.map((item) => (
          <button
            key={item.tab}
            className={`analysis-tab-btn ${activeTab === item.tab ? 'active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === item.tab}
            onClick={() => onTabChange(item.tab)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
    <div className="analysis-controls">
      {activeTab === 'loftDistance' && (
        <label className="headspeed-control">
          <span>推定ヘッドスピード</span>
          <div className="headspeed-input-wrap">
            <input
              type="number"
              min="30"
              max="60"
              step="0.1"
              value={headSpeed}
              onChange={onHeadSpeedChange}
              className="analysis-input headspeed-input"
            />
            <em>m/s</em>
          </div>
        </label>
      )}
      {activeTab === 'swingWeight' && (
        <button className="btn-secondary" onClick={onToggleSwingSettings}>
          {showSwingSettings ? 'SW目安設定を閉じる' : 'SW目安設定を開く'}
        </button>
      )}
      {activeTab === 'lieAngle' && (
        <button className="btn-secondary" onClick={onToggleLieSettings}>
          {showLieSettings ? '基準値設定を閉じる' : '基準値設定を開く'}
        </button>
      )}
      <button className="btn-secondary" onClick={onBack}>
        クラブ一覧へ戻る
      </button>
    </div>
  </div>
);