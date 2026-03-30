import { SwingTargetInputRow, SwingThresholdInputRow } from './AnalysisSettingsInputs';

type AnalysisSwingSettingsCardProps = {
  swingWeightTarget: number;
  swingGoodTolerance: number;
  swingAdjustThreshold: number;
  onSetSwingWeightTarget: (value: number) => void;
  onSetSwingGoodTolerance: (value: number) => void;
  onSetSwingAdjustThreshold: (value: number) => void;
  onResetSwingWeightTarget: () => void;
  onResetSwingThresholds: () => void;
};

export const AnalysisSwingSettingsCard = ({
  swingWeightTarget,
  swingGoodTolerance,
  swingAdjustThreshold,
  onSetSwingWeightTarget,
  onSetSwingGoodTolerance,
  onSetSwingAdjustThreshold,
  onResetSwingWeightTarget,
  onResetSwingThresholds,
}: AnalysisSwingSettingsCardProps) => (
  <div className="analysis-card lie-settings-card">
    <div className="analysis-table-header">
      <h2>スイングウェイト目安設定</h2>
      <p>目安ターゲットを設定すると、偏差とステータス判定に即時反映されます。</p>
    </div>
    <div className="lie-settings-guide" role="note" aria-label="スイングウェイト目安設定の使い方">
      <div className="lie-settings-guide-title">使い方</div>
      <ul className="lie-settings-guide-list">
        <li>1. 目安ターゲットを 0.1 刻みで入力する</li>
        <li>2. 良好範囲と調整推奨の閾値を必要に応じて変更する</li>
        <li>3. 棒グラフの目安ラインと偏差表示でバランスを確認する</li>
      </ul>
    </div>
    <div className="lie-settings-grid">
      <div className="lie-settings-section">
        <div className="lie-settings-section-title">目安ターゲット</div>
        <SwingTargetInputRow
          value={swingWeightTarget}
          onCommit={onSetSwingWeightTarget}
          onReset={onResetSwingWeightTarget}
        />
      </div>
      <div className="lie-settings-section">
        <div className="lie-settings-section-title">ステータス判定閾値</div>
        <SwingThresholdInputRow
          label="良好範囲"
          value={swingGoodTolerance}
          description="偏差の絶対値がこの値以下なら良好"
          onCommit={onSetSwingGoodTolerance}
        />
        <SwingThresholdInputRow
          label="調整推奨"
          value={swingAdjustThreshold}
          description="偏差の絶対値がこの値を超えると調整推奨"
          onCommit={onSetSwingAdjustThreshold}
        />
      </div>
    </div>
    <div className="lie-settings-actions">
      <button className="btn-secondary" onClick={onResetSwingWeightTarget}>目安ターゲットを初期値に戻す</button>
      <button className="btn-secondary" onClick={onResetSwingThresholds}>閾値を初期値に戻す</button>
    </div>
  </div>
);