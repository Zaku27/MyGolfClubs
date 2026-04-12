import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import type { ParseResult } from 'papaparse';
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
type SortKey = 'brand' | 'model' | 'variant' | 'type' | 'year' | 'loft' | 'length' | 'lie' | 'swingWeight';
type CanonicalHeader =
  | 'brand'
  | 'model'
  | 'variant'
  | 'type'
  | 'year'
  | 'loft'
  | 'length'
  | 'lie'
  | 'swingWeight'
  | 'volume'
  | 'hand'
  | 'source';
type CsvColumnMapping = Partial<Record<CanonicalHeader, string>>;

type CsvRow = Record<string, string>;

type ImportPreviewRow = {
  rowId: string;
  spec: CatalogSpec | null;
  status: 'ready' | 'duplicate' | 'invalid';
  reason?: string;
};

type CatalogSpecParseResult = {
  spec: CatalogSpec | null;
  reason?: string;
};

type ImportCandidate = {
  rowId: string;
  spec: CatalogSpec | null;
  reason?: string;
};

const defaultSortState: { key: SortKey; direction: SortDirection } = {
  key: 'year',
  direction: 'desc',
};

const CSV_MAPPING_STORAGE_KEY = 'mygolfbag-admin-csv-mapping-v1';
const REQUIRED_MAPPING_FIELDS: CanonicalHeader[] = ['model', 'type', 'year'];

const HEADER_ALIASES: Record<CanonicalHeader, string[]> = {
  brand: ['brand', 'maker', 'manufacturer', 'ブランド', 'メーカー', 'ブランド名', 'メーカ名', 'brandname', 'brand_name'],
  model: ['model', 'modelname', 'clubmodel', 'clubname', 'club name', 'club_name', 'name', 'モデル', 'モデル名', '品名', '商品名'],
  variant: ['variant', 'spec', 'option', 'バリアント', '仕様', 'スペック', 'オプション', '番手'],
  type: ['type', 'clubtype', 'club type', 'category', 'タイプ', '種別', 'クラブタイプ', 'クラブ種別', 'カテゴリ', 'クラブ', 'クラブ区分', '種類'],
  year: ['year', 'releaseyear', 'modelyear', '年度', '製造年', '発売年', '発売年度', '年', '年式', 'モデル年'],
  loft: ['loft', 'loftangle', 'ロフト', 'ロフト角', 'ロフト角度'],
  length: ['length', 'lengthin', 'lengthinches', 'length_in', 'レングス', '長さ', '長さinch', '長さin'],
  lie: ['lie', 'lieangle', 'ライ', 'ライ角', 'ライ角度'],
  swingWeight: ['swingweight', 'swing_weight', 'sw', 'balance', 'スイングウェイト', 'スウィングウェイト'],
  volume: ['volume', 'cc', 'headvolume', '容積', '体積', 'ヘッド容積', 'ヘッド体積'],
  hand: ['hand', 'dexterity', '利き手', 'ハンド', '左右', 'handedness'],
  source: ['source', 'ref', 'reference', '出典', '参照元', 'ソース'],
};

const MAPPING_FIELDS: CanonicalHeader[] = [
  'brand',
  'model',
  'variant',
  'type',
  'year',
  'loft',
  'length',
  'lie',
  'swingWeight',
  'volume',
  'hand',
  'source',
];

const MAPPING_FIELD_LABELS: Record<CanonicalHeader, string> = {
  brand: 'ブランド',
  model: 'モデル',
  variant: 'バリアント',
  type: 'タイプ',
  year: '年',
  loft: 'ロフト',
  length: '長さ',
  lie: 'ライ角',
  swingWeight: 'SW',
  volume: '容積(cc)',
  hand: '利き手',
  source: '出典',
};

const sortSign = (direction: SortDirection): 1 | -1 => (direction === 'asc' ? 1 : -1);

const normalizedString = (value: string | undefined): string => (value ?? '').trim().toLowerCase();

const normalizeHeaderKey = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\-_/\\]/g, '')
    .replace(/[()\[\]{}]/g, '')
    .replace(/[（）。・]/g, '')
    .replace(/\./g, '')
    .replace(/インチ|inch|inches/g, 'in')
    .replace(/角度/g, 'angle');
};

const normalizeTypeValue = (value: string): CatalogClubType | undefined => {
  const normalized = normalizedString(value)
    .replace(/[\s\-_]/g, '')
    .replace(/ー/g, '');

  const dictionary: Record<string, CatalogClubType> = {
    driver: 'driver',
    dr: 'driver',
    ドライバー: 'driver',
    fairway: 'fairway',
    fairwaywood: 'fairway',
    fw: 'fairway',
    wood: 'wood',
    woods: 'wood',
    フェアウェイ: 'fairway',
    フェアウェイウッド: 'fairway',
    hybrid: 'hybrid',
    utility: 'hybrid',
    ut: 'hybrid',
    rescue: 'hybrid',
    ユーティリティ: 'hybrid',
    ハイブリッド: 'hybrid',
    iron: 'iron',
    irons: 'iron',
    アイアン: 'iron',
    wedge: 'wedge',
    wg: 'wedge',
    ウェッジ: 'wedge',
    putter: 'putter',
    pt: 'putter',
    パター: 'putter',
  };

  return dictionary[normalized];
};

const normalizeHandValue = (value: string | undefined): CatalogSpec['hand'] | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = normalizedString(value).replace(/[\s]/g, '').replace(/右利き|右/g, 'rh').replace(/左利き|左/g, 'lh');
  if (normalized === 'rh' || normalized === 'right') {
    return 'RH';
  }
  if (normalized === 'lh' || normalized === 'left') {
    return 'LH';
  }
  if (normalized.includes('rh/lh') || normalized.includes('rh・lh') || normalized.includes('rh&lh') || normalized.includes('both')) {
    return 'RH/LH';
  }
  if (normalized.includes('rh') && normalized.includes('lh')) {
    return 'RH/LH';
  }
  return undefined;
};

const isTypeValue = (value: string): value is CatalogClubType => {
  return CATALOG_CLUB_TYPES.includes(value as CatalogClubType);
};

const extractNumericValue = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const matched = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!matched) {
    return undefined;
  }

  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toYearNumber = (value: string | undefined): number => {
  if (!value) {
    return Number.NaN;
  }

  const matched = value.match(/(?:19|20)\d{2}/);
  if (!matched) {
    return Number.NaN;
  }

  return Number(matched[0]);
};

const toNullableNumber = (value: string | undefined): number | null => {
  const parsed = extractNumericValue(value);
  return parsed ?? null;
};

const toOptionalNumber = (value: string | undefined): number | undefined => {
  return extractNumericValue(value);
};

const buildCsvLookup = (row: CsvRow): Record<string, string> => {
  const lookup: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(row)) {
    const key = normalizeHeaderKey(rawKey);
    const value = String(rawValue ?? '').trim();
    if (!key || !value) {
      continue;
    }
    lookup[key] = value;
  }
  return lookup;
};

const guessColumnMapping = (headers: string[]): CsvColumnMapping => {
  const mapping: CsvColumnMapping = {};
  for (const canonical of Object.keys(HEADER_ALIASES) as CanonicalHeader[]) {
    const aliases = HEADER_ALIASES[canonical];
    for (const header of headers) {
      const normalizedHeader = normalizeHeaderKey(header);
      const matched = aliases.some((alias) => normalizeHeaderKey(alias) === normalizedHeader);
      if (matched) {
        mapping[canonical] = header;
        break;
      }
    }
  }
  return mapping;
};

const parseStoredMapping = (value: unknown): CsvColumnMapping => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const result: CsvColumnMapping = {};
  for (const key of Object.keys(value)) {
    if (!(key in HEADER_ALIASES)) {
      continue;
    }
    const mapped = (value as Record<string, unknown>)[key];
    if (typeof mapped === 'string' && mapped.trim()) {
      result[key as CanonicalHeader] = mapped;
    }
  }
  return result;
};

const buildMappingForHeaders = (
  headers: string[],
  preferredMapping: CsvColumnMapping,
): CsvColumnMapping => {
  const guessed = guessColumnMapping(headers);
  const nextMapping: CsvColumnMapping = { ...guessed };
  for (const [canonical, mappedHeader] of Object.entries(preferredMapping)) {
    if (!mappedHeader) {
      continue;
    }
    if (headers.includes(mappedHeader)) {
      nextMapping[canonical as CanonicalHeader] = mappedHeader;
    }
  }
  return nextMapping;
};

const decodeCsvFileText = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    try {
      return new TextDecoder('shift_jis').decode(buffer);
    } catch {
      return new TextDecoder('utf-8').decode(buffer);
    }
  }
};

const hasResolvableHeader = (
  headers: string[],
  canonical: CanonicalHeader,
  mapping: CsvColumnMapping,
): boolean => {
  const mappedHeader = mapping[canonical];
  if (mappedHeader && headers.includes(mappedHeader)) {
    return true;
  }

  const aliases = HEADER_ALIASES[canonical];
  return headers.some((header) => {
    const normalizedHeader = normalizeHeaderKey(header);
    return aliases.some((alias) => normalizeHeaderKey(alias) === normalizedHeader);
  });
};

const pickCell = (lookup: Record<string, string>, canonicalHeader: CanonicalHeader): string => {
  const aliases = HEADER_ALIASES[canonicalHeader];
  for (const alias of aliases) {
    const key = normalizeHeaderKey(alias);
    const found = lookup[key];
    if (found) {
      return found;
    }
  }
  return '';
};

const pickCellFromRow = (
  row: CsvRow,
  canonicalHeader: CanonicalHeader,
  mapping?: CsvColumnMapping,
): string => {
  const mappedHeader = mapping?.[canonicalHeader];
  if (mappedHeader) {
    const mappedValue = String(row[mappedHeader] ?? '').trim();
    if (mappedValue) {
      return mappedValue;
    }
  }

  const lookup = buildCsvLookup(row);
  return pickCell(lookup, canonicalHeader);
};

const parseCsvRowToCatalogSpec = (
  row: CsvRow,
  mapping?: CsvColumnMapping,
  sourceHint?: string,
): CatalogSpecParseResult => {
  const rawModel = pickCellFromRow(row, 'model', mapping);
  if (!rawModel) {
    return { spec: null, reason: 'モデル(model)列が見つかりません' };
  }

  const rawType = pickCellFromRow(row, 'type', mapping);
  const isDriverModel = /\bdriver\b/i.test(rawModel);
  const normalizedType = isDriverModel ? 'driver' : normalizeTypeValue(rawType);
  if (!normalizedType || !isTypeValue(normalizedType)) {
    return { spec: null, reason: `タイプ(type)列の値が不正です: "${rawType}"` };
  }

  const rawYear = pickCellFromRow(row, 'year', mapping);
  const year = toYearNumber(rawYear);
  if (Number.isNaN(year)) {
    return { spec: null, reason: `年(year)列の値が不正です: "${rawYear}"` };
  }

  const rawVariant = pickCellFromRow(row, 'variant', mapping);
  const variant = isDriverModel ? '1' : rawVariant || undefined;

  const candidate = {
    id: crypto.randomUUID(),
    brand: pickCellFromRow(row, 'brand', mapping) || 'TaylorMade',
    model: rawModel,
    variant,
    type: normalizedType,
    year,
    loft: toNullableNumber(pickCellFromRow(row, 'loft', mapping)),
    length: toNullableNumber(pickCellFromRow(row, 'length', mapping)),
    lie: pickCellFromRow(row, 'lie', mapping) || undefined,
    swingWeight: pickCellFromRow(row, 'swingWeight', mapping) || undefined,
    volume: toOptionalNumber(pickCellFromRow(row, 'volume', mapping)),
    hand: normalizeHandValue(pickCellFromRow(row, 'hand', mapping)),
    source: sourceHint || 'CSV Import',
    importedAt: new Date().toISOString(),
  };

  const parsed = catalogSpecSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      spec: null,
      reason: parsed.error.issues[0]?.message ?? 'CatalogSpecの構造が不正です',
    };
  }

  return { spec: parsed.data };
};


const buildPreviewRows = (
  candidates: ImportCandidate[],
  existingKeys: Set<string>,
): ImportPreviewRow[] => {
  const seenInPreview = new Set<string>();

  return candidates.map((candidate) => {
    if (!candidate.spec) {
      return {
        rowId: candidate.rowId,
        spec: null,
        status: 'invalid',
        reason: candidate.reason ?? '行の構造を解釈できませんでした',
      };
    }

    const key = buildCatalogSpecKey(candidate.spec);
    if (existingKeys.has(key) || seenInPreview.has(key)) {
      return {
        rowId: candidate.rowId,
        spec: candidate.spec,
        status: 'duplicate',
        reason: '既存Catalogまたはプレビュー内で重複',
      };
    }

    seenInPreview.add(key);
    return {
      rowId: candidate.rowId,
      spec: candidate.spec,
      status: 'ready',
    };
  });
};

const toComparable = (spec: CatalogSpec, key: SortKey): string | number => {
  switch (key) {
    case 'year':
      return spec.year;
    case 'loft':
      return spec.loft ?? Number.NEGATIVE_INFINITY;
    case 'length':
      return spec.length ?? Number.NEGATIVE_INFINITY;
    case 'lie':
      if (typeof spec.lie === 'number') {
        return spec.lie;
      }
      return spec.lie ? normalizedString(spec.lie) : '';
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
  const clearAll = useCatalogSpecsStore((state) => state.clearAll);

  const [activeTab, setActiveTab] = useState<TabKey>('catalog');
  const [searchModel, setSearchModel] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | CatalogClubType>('all');
  const [sortState, setSortState] = useState(defaultSortState);
  const [editingSpec, setEditingSpec] = useState<CatalogSpec | null>(null);

  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [csvRawRows, setCsvRawRows] = useState<CsvRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvColumnMapping, setCsvColumnMapping] = useState<CsvColumnMapping>({});
  const [csvSourceFileName, setCsvSourceFileName] = useState<string | undefined>(undefined);
  const [importMessage, setImportMessage] = useState<string>('');
  const [importError, setImportError] = useState<string>('');
  const [csvLoading, setCsvLoading] = useState(false);

  useEffect(() => {
    try {
      const rawCsvMapping = localStorage.getItem(CSV_MAPPING_STORAGE_KEY);
      if (rawCsvMapping) {
        setCsvColumnMapping(parseStoredMapping(JSON.parse(rawCsvMapping)));
      }
    } catch {
      // Ignore localStorage parse issues and keep defaults.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CSV_MAPPING_STORAGE_KEY, JSON.stringify(csvColumnMapping));
  }, [csvColumnMapping]);

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

  const csvMissingRequiredFields = useMemo(() => {
    if (csvHeaders.length === 0) {
      return [] as CanonicalHeader[];
    }
    return REQUIRED_MAPPING_FIELDS.filter((field) => !hasResolvableHeader(csvHeaders, field, csvColumnMapping));
  }, [csvHeaders, csvColumnMapping]);


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

  const buildCsvPreviewRows = (
    rows: CsvRow[],
    mapping: CsvColumnMapping,
    sourceHint?: string,
  ): ImportPreviewRow[] => {
    const candidates: ImportCandidate[] = rows.map((row, index) => {
      const parsed = parseCsvRowToCatalogSpec(row, mapping, sourceHint);
      return {
        rowId: `csv-${index + 1}`,
        spec: parsed.spec,
        reason: parsed.spec ? undefined : parsed.reason ?? '必須項目または型が不正です（model/type/year など）',
      };
    });

    return buildPreviewRows(candidates, existingKeys);
  };

  const handleCsvUpload = async (file: File) => {
    setCsvLoading(true);
    setImportError('');
    setImportMessage('');

    try {
      const text = await decodeCsvFileText(file);
      Papa.parse<CsvRow>(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results: ParseResult<CsvRow>) => {
          try {
            const headers = results.meta.fields ?? Object.keys(results.data[0] ?? {});
            const resolvedMapping = buildMappingForHeaders(headers, csvColumnMapping);
            const rows = buildCsvPreviewRows(results.data, resolvedMapping, file.name);

            setCsvRawRows(results.data);
            setCsvHeaders(headers);
            setCsvColumnMapping(resolvedMapping);
            setCsvSourceFileName(file.name);
            setPreviewRows(rows);
            setImportMessage(`CSVを解析しました: ${rows.length}行`);
          } catch (error) {
            setImportError(`CSV解析でエラーが発生しました: ${(error as Error).message}`);
          } finally {
            setCsvLoading(false);
          }
        },
        error: (error: Error) => {
          setImportError(`CSVアップロードに失敗しました: ${error.message}`);
          setCsvLoading(false);
        },
      });
    } catch (error) {
      setImportError(`CSVの読み込みに失敗しました: ${(error as Error).message}`);
      setCsvLoading(false);
    }
  };

  const handleRebuildPreviewWithMapping = () => {
    if (csvRawRows.length === 0) {
      setImportError('再プレビュー対象のCSVデータがありません。先にCSVを読み込んでください。');
      return;
    }

    const rows = buildCsvPreviewRows(csvRawRows, csvColumnMapping, csvSourceFileName);
    setPreviewRows(rows);
    setImportError('');
    setImportMessage(`列マッピングを適用して再プレビューしました: ${rows.length}行`);
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

  const handleClearAllData = () => {
    if (!window.confirm('すべてのCatalog Specデータを削除します。よろしいですか？')) {
      return;
    }
    clearAll();
    setImportMessage('');
    setImportError('');
    setEditingSpec(null);
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
          インポート（CSV）
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
                  <th><button type="button" onClick={() => toggleSort('lie')}>Lie</button></th>
                  <th><button type="button" onClick={() => toggleSort('swingWeight')}>SW</button></th>
                  <th>編集</th>
                </tr>
              </thead>
              <tbody>
                {sortedSpecs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="admin-empty">条件に一致するCatalog Specがありません。</td>
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
                      <td>{spec.lie ?? '-'}</td>
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

          </div>

          {csvHeaders.length > 0 && (
            <div className="admin-mapping-card">
              <h3>CSV列マッピング（手動上書き）</h3>
              <p>自動判定が外れる場合、model/type/year などを手動指定して再プレビューできます。</p>
              {csvMissingRequiredFields.length > 0 && (
                <p className="admin-mapping-warning">
                  必須列の解決候補が不足: {csvMissingRequiredFields.map((field) => MAPPING_FIELD_LABELS[field]).join(', ')}
                </p>
              )}
              <div className="admin-mapping-grid">
                {MAPPING_FIELDS.map((field) => (
                  <label key={field}>
                    {MAPPING_FIELD_LABELS[field]}
                    <select
                      value={csvColumnMapping[field] ?? ''}
                      onChange={(event) => {
                        const selectedHeader = event.target.value;
                        setCsvColumnMapping((prev) => ({
                          ...prev,
                          [field]: selectedHeader || undefined,
                        }));
                      }}
                    >
                      <option value="">自動判定</option>
                      {csvHeaders.map((header) => (
                        <option key={`${field}-${header}`} value={header}>{header}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="admin-mapping-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCsvColumnMapping(buildMappingForHeaders(csvHeaders, {}))}
                >
                  自動判定に戻す
                </button>
                <button type="button" className="btn-secondary" onClick={handleRebuildPreviewWithMapping}>
                  マッピングで再プレビュー
                </button>
              </div>
            </div>
          )}

          {importMessage && <p className="admin-message success">{importMessage}</p>}
          {(importError || storeError) && <p className="admin-message error">{importError || storeError}</p>}

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
                  <th>Lie</th>
                  <th>SW</th>
                  <th>Volume</th>
                  <th>Hand</th>
                  <th>Source</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="admin-empty">CSVを取り込むとプレビューを表示します。</td>
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
                      <td>{row.spec?.lie ?? '-'}</td>
                      <td>{row.spec?.swingWeight ?? '-'}</td>
                      <td>{row.spec?.volume ?? '-'}</td>
                      <td>{row.spec?.hand ?? '-'}</td>
                      <td>{row.spec?.source ?? '-'}</td>
                      <td>{row.reason ?? '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="admin-clear-all">
        <button type="button" className="btn-danger" onClick={handleClearAllData}>
          すべてのデータを削除
        </button>
      </div>

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
