import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import type { ParseError, ParseResult } from 'papaparse';
import { Link } from 'react-router-dom';
import {
  buildCatalogSpecKey,
  CATALOG_CLUB_TYPES,
  type CatalogClubType,
  type CatalogSpec,
  catalogSpecSchema,
} from '../types/catalog';
import { useCatalogSpecsStore } from '../store/catalogSpecsStore';
import './AdminClubs.css';

type TabKey = 'catalog' | 'import';
type SortDirection = 'asc' | 'desc';
type SortKey = 'brand' | 'model' | 'variant' | 'type' | 'year' | 'loft' | 'length' | 'swingWeight';

type CsvRow = Record<string, string>;

type ImportPreviewRow = {
  rowId: string;
  spec: CatalogSpec | null;
  status: 'ready' | 'duplicate' | 'invalid';
  reason?: string;
};

const defaultSortState: { key: SortKey; direction: SortDirection } = {
  key: 'year',
  direction: 'desc',
};

const sortSign = (direction: SortDirection): 1 | -1 => (direction === 'asc' ? 1 : -1);

const normalizedString = (value: string | undefined): string => (value ?? '').trim().toLowerCase();

const isTypeValue = (value: string): value is CatalogClubType => {
  return CATALOG_CLUB_TYPES.includes(value as CatalogClubType);
};

const toNullableNumber = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const toOptionalNumber = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
};

const pickCell = (row: CsvRow, aliases: string[]): string => {
  for (const alias of aliases) {
    const found = Object.entries(row).find(([key]) => normalizedString(key) === normalizedString(alias));
    if (found && found[1]?.trim()) {
      return found[1].trim();
    }
  }
  return '';
};

const parseCsvRowToCatalogSpec = (row: CsvRow): CatalogSpec | null => {
  const rawType = normalizedString(pickCell(row, ['type', 'clubType']));
  if (!isTypeValue(rawType)) {
    return null;
  }

  const candidate = {
    id: crypto.randomUUID(),
    brand: pickCell(row, ['brand', 'maker']) || 'TaylorMade',
    model: pickCell(row, ['model']),
    variant: pickCell(row, ['variant', 'spec', 'option']) || undefined,
    type: rawType,
    year: Number(pickCell(row, ['year'])),
    loft: toNullableNumber(pickCell(row, ['loft'])),
    length: toNullableNumber(pickCell(row, ['length', 'lengthInches', 'length_in'])),
    lie: pickCell(row, ['lie']) || undefined,
    swingWeight: pickCell(row, ['swingWeight', 'swing_weight']) || undefined,
    volume: toOptionalNumber(pickCell(row, ['volume', 'cc'])),
    hand: (pickCell(row, ['hand']) as CatalogSpec['hand']) || undefined,
    source: pickCell(row, ['source']) || 'CSV Import',
    importedAt: new Date().toISOString(),
  };

  const parsed = catalogSpecSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
};

const toComparable = (spec: CatalogSpec, key: SortKey): string | number => {
  switch (key) {
    case 'year':
      return spec.year;
    case 'loft':
      return spec.loft ?? Number.NEGATIVE_INFINITY;
    case 'length':
      return spec.length ?? Number.NEGATIVE_INFINITY;
    case 'brand':
      return normalizedString(spec.brand);
    case 'model':
      return normalizedString(spec.model);
    case 'variant':
      return normalizedString(spec.variant);
    case 'type':
      return normalizedString(spec.type);
    case 'swingWeight':
      return normalizedString(spec.swingWeight);
    default:
      return '';
  }
};

export default function AdminClubs() {
  const specs = useCatalogSpecsStore((state) => state.specs);
  const storeError = useCatalogSpecsStore((state) => state.error);
  const addMany = useCatalogSpecsStore((state) => state.addMany);
  const updateOne = useCatalogSpecsStore((state) => state.updateOne);
  const clearError = useCatalogSpecsStore((state) => state.clearError);

  const [activeTab, setActiveTab] = useState<TabKey>('catalog');
  const [searchModel, setSearchModel] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | CatalogClubType>('all');
  const [sortState, setSortState] = useState(defaultSortState);
  const [editingSpec, setEditingSpec] = useState<CatalogSpec | null>(null);

  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [importMessage, setImportMessage] = useState<string>('');
  const [importError, setImportError] = useState<string>('');
  const [csvLoading, setCsvLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfExtractedText, setPdfExtractedText] = useState('');

  const existingKeys = useMemo(() => new Set(specs.map(buildCatalogSpecKey)), [specs]);

  const brandOptions = useMemo(() => {
    return Array.from(new Set(specs.map((spec) => spec.brand))).sort((a, b) => a.localeCompare(b));
  }, [specs]);

  const yearOptions = useMemo(() => {
    return Array.from(new Set(specs.map((spec) => spec.year))).sort((a, b) => b - a);
  }, [specs]);

  const filteredSpecs = useMemo(() => {
    return specs.filter((spec) => {
      if (searchModel.trim() && !normalizedString(spec.model).includes(normalizedString(searchModel))) {
        return false;
      }
      if (brandFilter !== 'all' && spec.brand !== brandFilter) {
        return false;
      }
      if (yearFilter !== 'all' && String(spec.year) !== yearFilter) {
        return false;
      }
      if (typeFilter !== 'all' && spec.type !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [specs, searchModel, brandFilter, yearFilter, typeFilter]);

  const sortedSpecs = useMemo(() => {
    const direction = sortSign(sortState.direction);
    return [...filteredSpecs].sort((a, b) => {
      const left = toComparable(a, sortState.key);
      const right = toComparable(b, sortState.key);
      if (left < right) {
        return -1 * direction;
      }
      if (left > right) {
        return 1 * direction;
      }
      return 0;
    });
  }, [filteredSpecs, sortState]);

  const previewSummary = useMemo(() => {
    const ready = previewRows.filter((row) => row.status === 'ready').length;
    const duplicate = previewRows.filter((row) => row.status === 'duplicate').length;
    const invalid = previewRows.filter((row) => row.status === 'invalid').length;
    return { ready, duplicate, invalid };
  }, [previewRows]);

  const toggleSort = (key: SortKey) => {
    setSortState((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return {
        key,
        direction: 'asc',
      };
    });
  };

  const handleCsvUpload = (file: File) => {
    setCsvLoading(true);
    setImportError('');
    setImportMessage('');

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: ParseResult<CsvRow>) => {
        try {
          const seenInPreview = new Set<string>();
          const rows: ImportPreviewRow[] = results.data.map((row, index) => {
            const parsed = parseCsvRowToCatalogSpec(row);

            if (!parsed) {
              return {
                rowId: `csv-${index + 1}`,
                spec: null,
                status: 'invalid',
                reason: '必須項目または型が不正です（model/type/year など）',
              };
            }

            const key = buildCatalogSpecKey(parsed);
            if (existingKeys.has(key) || seenInPreview.has(key)) {
              return {
                rowId: `csv-${index + 1}`,
                spec: parsed,
                status: 'duplicate',
                reason: '既存Catalogまたはプレビュー内で重複',
              };
            }

            seenInPreview.add(key);
            return {
              rowId: `csv-${index + 1}`,
              spec: parsed,
              status: 'ready',
            };
          });

          setPreviewRows(rows);
          setImportMessage(`CSVを解析しました: ${rows.length}行`);
        } catch (error) {
          setImportError(`CSV解析でエラーが発生しました: ${(error as Error).message}`);
        } finally {
          setCsvLoading(false);
        }
      },
      error: (error: ParseError) => {
        setImportError(`CSVアップロードに失敗しました: ${error.message}`);
        setCsvLoading(false);
      },
    });
  };

  const handlePdfUpload = async (file: File) => {
    setPdfLoading(true);
    setImportError('');
    setImportMessage('');
    setPdfExtractedText('');

    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const textChunks: string[] = [];
      for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
        const page = await pdf.getPage(pageIndex);
        const text = await page.getTextContent();
        const pageLines = text.items
          .map((item) => ('str' in item ? String(item.str) : ''))
          .filter(Boolean)
          .join(' ');
        textChunks.push(`[page ${pageIndex}] ${pageLines}`);
      }

      const extracted = textChunks.join('\n');
      setPdfExtractedText(extracted);
      setImportMessage(`PDFテキスト抽出完了: ${pdf.numPages}ページ`);
      console.log('[Catalog PDF Extracted Text]', extracted);
    } catch (error) {
      setImportError(`PDF解析に失敗しました: ${(error as Error).message}`);
    } finally {
      setPdfLoading(false);
    }
  };

  const registerAllPreviewRows = () => {
    const readySpecs = previewRows
      .filter((row): row is ImportPreviewRow & { spec: CatalogSpec } => row.status === 'ready' && row.spec != null)
      .map((row) => row.spec);

    const result = addMany(readySpecs);
    setImportMessage(`${result.added}件新規登録、${result.skipped + previewSummary.duplicate + previewSummary.invalid}件スキップ`);
    setPreviewRows([]);
  };

  const handleSaveEdit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingSpec) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const nextVariant = String(formData.get('variant') ?? '').trim();
    const nextLoft = String(formData.get('loft') ?? '').trim();
    const nextLength = String(formData.get('length') ?? '').trim();
    const nextLie = String(formData.get('lie') ?? '').trim();
    const nextSwingWeight = String(formData.get('swingWeight') ?? '').trim();
    const nextVolume = String(formData.get('volume') ?? '').trim();
    const nextHand = String(formData.get('hand') ?? '').trim();
    const nextSource = String(formData.get('source') ?? '').trim();

    const ok = updateOne(editingSpec.id, {
      variant: nextVariant || undefined,
      loft: nextLoft ? Number(nextLoft) : null,
      length: nextLength ? Number(nextLength) : null,
      lie: nextLie || undefined,
      swingWeight: nextSwingWeight || undefined,
      volume: nextVolume ? Number(nextVolume) : undefined,
      hand: (nextHand || undefined) as CatalogSpec['hand'] | undefined,
      source: nextSource || undefined,
    });

    if (ok) {
      setEditingSpec(null);
      clearError();
    }
  };

  return (
    <main className="admin-clubs-page">
      <div className="admin-clubs-header">
        <div>
          <h1>Catalog Specs 管理</h1>
          <p>CatalogSpecsは参照データです。MyClubsとは分離し、最小限編集だけ許可しています。</p>
        </div>
        <Link to="/" className="btn-primary">
          ホームに戻る
        </Link>
      </div>

      <div className="admin-clubs-tabs" role="tablist" aria-label="管理タブ">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'catalog'}
          className={`admin-tab ${activeTab === 'catalog' ? 'active' : ''}`}
          onClick={() => setActiveTab('catalog')}
        >
          Catalog Specs 一覧
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'import'}
          className={`admin-tab ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          インポート（CSV / PDF）
        </button>
      </div>

      {activeTab === 'catalog' ? (
        <section className="admin-panel" role="tabpanel">
          <div className="admin-filters">
            <input
              type="search"
              placeholder="モデル名で検索"
              value={searchModel}
              onChange={(event) => setSearchModel(event.target.value)}
            />
            <select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}>
              <option value="all">全ブランド</option>
              {brandOptions.map((brand) => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
            <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
              <option value="all">全年</option>
              {yearOptions.map((year) => (
                <option key={year} value={String(year)}>{year}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as 'all' | CatalogClubType)}
            >
              <option value="all">全タイプ</option>
              {CATALOG_CLUB_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th><button type="button" onClick={() => toggleSort('brand')}>Brand</button></th>
                  <th><button type="button" onClick={() => toggleSort('model')}>Model</button></th>
                  <th><button type="button" onClick={() => toggleSort('variant')}>Variant</button></th>
                  <th><button type="button" onClick={() => toggleSort('type')}>Type</button></th>
                  <th><button type="button" onClick={() => toggleSort('year')}>Year</button></th>
                  <th><button type="button" onClick={() => toggleSort('loft')}>Loft</button></th>
                  <th><button type="button" onClick={() => toggleSort('length')}>Length</button></th>
                  <th><button type="button" onClick={() => toggleSort('swingWeight')}>SW</button></th>
                  <th>編集</th>
                </tr>
              </thead>
              <tbody>
                {sortedSpecs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="admin-empty">条件に一致するCatalog Specがありません。</td>
                  </tr>
                ) : (
                  sortedSpecs.map((spec) => (
                    <tr key={spec.id}>
                      <td>{spec.brand}</td>
                      <td>{spec.model}</td>
                      <td>{spec.variant ?? '-'}</td>
                      <td>{spec.type}</td>
                      <td>{spec.year}</td>
                      <td>{spec.loft ?? '-'}</td>
                      <td>{spec.length ?? '-'}</td>
                      <td>{spec.swingWeight ?? '-'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-edit-mini"
                          onClick={() => {
                            setEditingSpec(spec);
                            setImportError('');
                            setImportMessage('');
                          }}
                        >
                          編集
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="admin-panel" role="tabpanel">
          <div className="admin-import-grid">
            <div className="admin-upload-card">
              <h2>CSVアップロード</h2>
              <p>ヘッダー行付きCSVを選択すると、Catalog登録前にプレビューします。</p>
              <label className="btn-primary file-label">
                CSVファイルを選択
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      handleCsvUpload(file);
                    }
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              {csvLoading && <p className="admin-status">CSVを解析中...</p>}
            </div>

            <div className="admin-upload-card">
              <h2>PDFアップロード</h2>
              <p>まずはテキスト抽出のみ実装しています。抽出結果は画面表示とコンソール出力を行います。</p>
              <label className="btn-primary file-label">
                PDFファイルを選択
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handlePdfUpload(file);
                    }
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              {pdfLoading && <p className="admin-status">PDFからテキスト抽出中...</p>}
            </div>
          </div>

          {importMessage && <p className="admin-message success">{importMessage}</p>}
          {(importError || storeError) && <p className="admin-message error">{importError || storeError}</p>}

          {pdfExtractedText && (
            <div className="admin-pdf-preview">
              <h3>PDF抽出テキスト（先頭プレビュー）</h3>
              <pre>{pdfExtractedText.slice(0, 3000)}</pre>
            </div>
          )}

          <div className="admin-preview-header">
            <h3>登録予定プレビュー</h3>
            <p>
              Ready: {previewSummary.ready} / Duplicate: {previewSummary.duplicate} / Invalid: {previewSummary.invalid}
            </p>
            <button
              type="button"
              className="btn-primary"
              disabled={previewSummary.ready === 0 || csvLoading}
              onClick={registerAllPreviewRows}
            >
              すべてCatalogに登録
            </button>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Brand</th>
                  <th>Model</th>
                  <th>Variant</th>
                  <th>Type</th>
                  <th>Year</th>
                  <th>Loft</th>
                  <th>Length</th>
                  <th>SW</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="admin-empty">CSVアップロード後にプレビューを表示します。</td>
                  </tr>
                ) : (
                  previewRows.map((row) => (
                    <tr key={row.rowId}>
                      <td>
                        <span className={`status-pill ${row.status}`}>{row.status}</span>
                      </td>
                      <td>{row.spec?.brand ?? '-'}</td>
                      <td>{row.spec?.model ?? '-'}</td>
                      <td>{row.spec?.variant ?? '-'}</td>
                      <td>{row.spec?.type ?? '-'}</td>
                      <td>{row.spec?.year ?? '-'}</td>
                      <td>{row.spec?.loft ?? '-'}</td>
                      <td>{row.spec?.length ?? '-'}</td>
                      <td>{row.spec?.swingWeight ?? '-'}</td>
                      <td>{row.reason ?? '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editingSpec && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal">
            <h2>Catalog Spec 編集</h2>
            <p className="admin-modal-title">{editingSpec.brand} / {editingSpec.model} / {editingSpec.year}</p>
            <form onSubmit={handleSaveEdit}>
              <div className="admin-modal-grid">
                <label>
                  Variant
                  <input name="variant" defaultValue={editingSpec.variant ?? ''} />
                </label>
                <label>
                  Loft
                  <input name="loft" defaultValue={editingSpec.loft ?? ''} inputMode="decimal" />
                </label>
                <label>
                  Length
                  <input name="length" defaultValue={editingSpec.length ?? ''} inputMode="decimal" />
                </label>
                <label>
                  Lie
                  <input name="lie" defaultValue={editingSpec.lie ?? ''} />
                </label>
                <label>
                  SwingWeight
                  <input name="swingWeight" defaultValue={editingSpec.swingWeight ?? ''} />
                </label>
                <label>
                  Volume(cc)
                  <input name="volume" defaultValue={editingSpec.volume ?? ''} inputMode="decimal" />
                </label>
                <label>
                  Hand
                  <select name="hand" defaultValue={editingSpec.hand ?? ''}>
                    <option value="">未設定</option>
                    <option value="RH">RH</option>
                    <option value="LH">LH</option>
                    <option value="RH/LH">RH/LH</option>
                  </select>
                </label>
                <label>
                  Source
                  <input name="source" defaultValue={editingSpec.source ?? ''} />
                </label>
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditingSpec(null)}>
                  キャンセル
                </button>
                <button type="submit" className="btn-primary">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
