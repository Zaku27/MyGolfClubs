import { Link } from 'react-router-dom';
import { APP, SOCIAL } from '../constants/app';

interface PageHeaderProps {
  /** ページタイトル */
  title: string;
  /** サブタイトル/説明 */
  subtitle?: string;
  /** 上部のラベル（カテゴリ名など） */
  label?: string;
  /** 戻るボタンのリンク先 */
  backTo?: string;
  /** 戻るボタンのテキスト */
  backLabel?: string;
  /** 右側に表示するカスタムアクション */
  actions?: React.ReactNode;
  /** バナーのバリアント */
  variant?: 'default' | 'simulator' | 'admin';
}

/**
 * 統一されたページヘッダーコンポーネント
 * 全ページで一貫した「MGR | MyGolfRoom」ブランディングを提供
 */
export function PageHeader({
  title,
  subtitle,
  label,
  backTo,
  backLabel = 'ホームに戻る',
  actions,
  variant = 'default',
}: PageHeaderProps) {
  // バリアントに応じたスタイル
  const variantStyles = {
    default: {
      wrapper: 'from-slate-50 to-slate-100 border-slate-200',
      label: 'text-emerald-600',
      title: 'text-slate-900',
      subtitle: 'text-slate-600',
      backButton: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    },
    simulator: {
      wrapper: 'from-green-50 via-emerald-50 to-lime-50 border-emerald-200',
      label: 'text-emerald-700',
      title: 'text-emerald-950',
      subtitle: 'text-emerald-700',
      backButton: 'border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-50',
    },
    admin: {
      wrapper: 'from-slate-50 to-slate-100 border-slate-200',
      label: 'text-slate-600',
      title: 'text-slate-900',
      subtitle: 'text-slate-600',
      backButton: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    },
  };

  const styles = variantStyles[variant];

  return (
    <header
      className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br ${styles.wrapper} px-5 py-6 shadow-sm sm:px-7 sm:py-7`}
    >
      {/* 背景パターン */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.3) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(0,0,0,0.3) 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10">
        {/* 上部：ブランディング + ラベル */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* ロゴ */}
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md">
              <svg
                width="20"
                height="20"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 16C8 16 12 12 16 12C20 12 24 16 24 16"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="16" cy="16" r="2" fill="white" />
              </svg>
            </div>
            {/* ブランド名 */}
            <span className="text-xs font-bold tracking-wider text-emerald-700">
              {APP.short} | {APP.name}
            </span>
          </div>

          {label && (
            <span className={`text-xs font-semibold uppercase tracking-[0.2em] ${styles.label}`}>
              {label}
            </span>
          )}
        </div>

        {/* メインコンテンツ */}
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className={`text-2xl font-black sm:text-3xl ${styles.title}`}>
              {title}
            </h1>
            {subtitle && (
              <p className={`mt-1 text-sm ${styles.subtitle}`}>{subtitle}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {backTo && (
              <Link
                to={backTo}
                className={`inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${styles.backButton}`}
              >
                {backLabel}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ソーシャルハッシュタグ（装飾） */}
      <div className="absolute bottom-2 right-4 text-[10px] font-medium text-emerald-600/40">
        {SOCIAL.hashtag}
      </div>
    </header>
  );
}

export default PageHeader;
