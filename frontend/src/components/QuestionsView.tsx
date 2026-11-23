import React, { useEffect, useState } from 'react';
import {
  HelpCircle,
  Search,
  Plus,
  Upload,
  RefreshCw,
  Edit3,
  Trash2,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Download,
  Layers,
} from 'lucide-react';
import { ApiService } from '../services/api';
import {
  AdminUser,
  ConfirmDialogOptions,
  LangCode,
  QuestionCategoryStat,
  QuizQuestionItem,
} from '../types';
import { buildCsvContent, formatNumber, hasAdminPermission } from '../utils/adminUtils';

interface QuestionsViewProps {
  currentAdmin: AdminUser | null;
  onConfirm: (opts: ConfirmDialogOptions) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: LangCode;
}

const SAMPLE_IMPORT_JSON = `[
  {
    "category_id": 1,
    "category_title": "اطلاعات عمومی",
    "question": "پایتخت کشور ایران کدام شهر است؟",
    "options": ["تهران", "اصفهان", "شیراز", "تبریز"],
    "correct": 0
  }
]`;

export const QuestionsView: React.FC<QuestionsViewProps> = ({
  currentAdmin,
  onConfirm,
  onNotify,
  lang,
}) => {
  const [questions, setQuestions] = useState<QuizQuestionItem[]>([]);
  const [categories, setCategories] = useState<QuestionCategoryStat[]>([]);
  const [totalBankCount, setTotalBankCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Create / Edit modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<QuizQuestionItem | null>(null);
  const [qText, setQText] = useState('');
  const [qCategoryTitle, setQCategoryTitle] = useState('اطلاعات عمومی');
  const [qCategoryId, setQCategoryId] = useState(0);
  const [qOptions, setQOptions] = useState<string[]>(['', '', '', '']);
  const [qCorrect, setQCorrect] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  // Bulk import modal state
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    inserted_count: number;
    skipped_count: number;
    errors: string[];
  } | null>(null);

  const canWrite = hasAdminPermission(currentAdmin, 'config:write');

  const fetchCategories = async () => {
    try {
      const res = await ApiService.getQuestionCategories();
      setCategories(res.categories || []);
      setTotalBankCount(res.total || 0);
    } catch {
      // ignore
    }
  };

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await ApiService.listQuestions({
        page,
        limit: 20,
        search: appliedSearch || undefined,
        category_title: categoryFilter !== 'all' ? categoryFilter : undefined,
      });
      setQuestions(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err: any) {
      onNotify(err.message || 'خطا در دریافت بانک سوالات', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [page, appliedSearch, categoryFilter]);

  const openCreateModal = () => {
    setEditingItem(null);
    setQText('');
    const defaultCat = categoryFilter !== 'all' ? categoryFilter : categories[0]?.category_title || 'اطلاعات عمومی';
    const catMatch = categories.find((c) => c.category_title === defaultCat);
    setQCategoryTitle(defaultCat);
    setQCategoryId(catMatch?.category_id ?? 0);
    setQOptions(['', '', '', '']);
    setQCorrect(0);
    setEditorOpen(true);
  };

  const openEditModal = (item: QuizQuestionItem) => {
    setEditingItem(item);
    setQText(item.question || '');
    setQCategoryTitle(item.category_title || 'اطلاعات عمومی');
    setQCategoryId(item.category_id ?? 0);
    const opts = Array.isArray(item.options) ? [...item.options] : [];
    while (opts.length < 4) opts.push('');
    setQOptions(opts.slice(0, 4));
    setQCorrect(typeof item.correct === 'number' ? item.correct : 0);
    setEditorOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedOpts = qOptions.map((o) => o.trim());
    if (qText.trim().length < 3 || cleanedOpts.some((o) => !o)) {
      onNotify(
        lang === 'fa' ? 'متن سوال و هر ۴ گزینه باید تکمیل شوند.' : 'Question text and all 4 options are required.',
        'error'
      );
      return;
    }
    setSaving(true);
    try {
      const payload = {
        question: qText.trim(),
        options: cleanedOpts,
        correct: qCorrect,
        category_id: Number(qCategoryId) || 0,
        category_title: qCategoryTitle.trim() || 'اطلاعات عمومی',
      };
      if (editingItem) {
        await ApiService.updateQuestion(editingItem._id, payload);
        onNotify(lang === 'fa' ? 'سوال با موفقیت ویرایش شد.' : 'Question updated.', 'success');
      } else {
        await ApiService.createQuestion(payload);
        onNotify(lang === 'fa' ? 'سوال جدید به بانک اضافه شد.' : 'Question created.', 'success');
      }
      setEditorOpen(false);
      fetchQuestions();
      fetchCategories();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = (item: QuizQuestionItem) => {
    onConfirm({
      title: lang === 'fa' ? 'حذف سوال کوییز' : 'Delete Quiz Question',
      message:
        lang === 'fa'
          ? `آیا از حذف سوال «${item.question.slice(0, 80)}» اطمینان دارید؟`
          : `Permanently delete question "${item.question.slice(0, 80)}"?`,
      variant: 'danger',
      confirmLabel: lang === 'fa' ? 'حذف سوال' : 'Delete',
      onConfirm: async () => {
        try {
          await ApiService.deleteQuestion(item._id);
          onNotify(lang === 'fa' ? 'سوال حذف شد.' : 'Question deleted.', 'success');
          fetchQuestions();
          fetchCategories();
        } catch (err: any) {
          onNotify(err.message, 'error');
        }
      },
    });
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    let parsed: any;
    try {
      parsed = JSON.parse(importJson);
    } catch {
      onNotify(lang === 'fa' ? 'فرمت JSON معتبر نیست.' : 'Invalid JSON syntax.', 'error');
      return;
    }
    const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : null;
    if (!items || items.length === 0) {
      onNotify(
        lang === 'fa' ? 'یک آرایه JSON غیرخالی از سوالات وارد کنید.' : 'Provide a non-empty JSON array of questions.',
        'error'
      );
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const res = await ApiService.bulkImportQuestions(items);
      setImportResult(res);
      onNotify(
        lang === 'fa'
          ? `${formatNumber(res.inserted_count, lang)} سوال با موفقیت وارد شد.`
          : `Imported ${res.inserted_count} questions.`,
        'success'
      );
      fetchQuestions();
      fetchCategories();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['QuestionID', 'CategoryID', 'Category', 'Question', 'Option1', 'Option2', 'Option3', 'Option4', 'CorrectIndex'];
    const rows = questions.map((q) => [
      q.question_id ?? q._id,
      q.category_id ?? 0,
      q.category_title || '',
      q.question || '',
      q.options?.[0] || '',
      q.options?.[1] || '',
      q.options?.[2] || '',
      q.options?.[3] || '',
      q.correct ?? 0,
    ]);
    const csv = buildCsvContent(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kafehfekr_quiz_questions_p${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">{lang === 'fa' ? 'بانک سوالات کوییز' : 'Quiz Question Bank'}</h1>
          <p className="page-subtitle">
            {lang === 'fa'
              ? `${formatNumber(totalBankCount, lang)} سوال در ${formatNumber(categories.length, lang)} دسته‌بندی — مدیریت مستقیم سوالات بازی Quiz`
              : `${formatNumber(totalBankCount, lang)} questions across ${formatNumber(categories.length, lang)} categories`}
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-secondary" onClick={handleExportCSV} disabled={questions.length === 0}>
            <Download size={15} />
            <span>{lang === 'fa' ? 'خروجی CSV' : 'Export CSV'}</span>
          </button>
          {canWrite && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setImportResult(null);
                  setImportOpen(true);
                }}
              >
                <Upload size={15} />
                <span>{lang === 'fa' ? 'ورود گروهی JSON' : 'Bulk Import'}</span>
              </button>
              <button type="button" className="btn btn-primary" onClick={openCreateModal}>
                <Plus size={15} />
                <span>{lang === 'fa' ? 'افزودن سوال' : 'Add Question'}</span>
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              fetchQuestions();
              fetchCategories();
            }}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Category KPI Summary */}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="kpi-card">
          <div className="kpi-top">
            <span>{lang === 'fa' ? 'کل سوالات بانک' : 'Total Questions'}</span>
            <span className="kpi-icon accent">
              <HelpCircle size={16} />
            </span>
          </div>
          <div className="kpi-value">{formatNumber(totalBankCount, lang)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span>{lang === 'fa' ? 'تعداد دسته‌بندی‌ها' : 'Categories'}</span>
            <span className="kpi-icon sapphire">
              <Layers size={16} />
            </span>
          </div>
          <div className="kpi-value">{formatNumber(categories.length, lang)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span>{lang === 'fa' ? 'پرتکرارترین موضوع' : 'Largest Category'}</span>
          </div>
          <div className="kpi-value" style={{ fontSize: 18 }}>
            {categories[0] ? categories[0].category_title : '—'}
          </div>
          <div className="kpi-foot">
            <span>
              {categories[0]
                ? `${formatNumber(categories[0].count, lang)} ${lang === 'fa' ? 'سوال' : 'questions'}`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <form
          className="search-box"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setAppliedSearch(searchInput.trim());
          }}
        >
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="input-field"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={lang === 'fa' ? 'جستجو در متن سوال یا گزینه‌ها...' : 'Search question text or options...'}
          />
          {(searchInput || appliedSearch) && (
            <button
              type="button"
              className="search-clear"
              onClick={() => {
                setSearchInput('');
                setAppliedSearch('');
                setPage(1);
              }}
            >
              <X size={14} />
            </button>
          )}
        </form>

        <select
          className="select-field"
          style={{ width: 'auto', minWidth: 200 }}
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">{lang === 'fa' ? 'همه دسته‌بندی‌ها' : 'All Categories'}</option>
          {categories.map((c) => (
            <option key={`${c.category_id}-${c.category_title}`} value={c.category_title}>
              {c.category_title} ({formatNumber(c.count, lang)})
            </option>
          ))}
        </select>
      </div>

      {/* Questions Table */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 72 }}>#</th>
              <th style={{ width: 150 }}>{lang === 'fa' ? 'دسته‌بندی' : 'Category'}</th>
              <th>{lang === 'fa' ? 'متن سوال و گزینه‌ها' : 'Question & Options'}</th>
              {canWrite && <th style={{ width: 100 }}>{lang === 'fa' ? 'عملیات' : 'Actions'}</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx}>
                  <td colSpan={canWrite ? 4 : 3}>
                    <div className="skeleton" style={{ height: 22 }} />
                  </td>
                </tr>
              ))
            ) : questions.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 4 : 3}>
                  <div className="empty-state">
                    <HelpCircle size={26} />
                    <span>{lang === 'fa' ? 'هیچ سوالی با این فیلتر یافت نشد.' : 'No questions found.'}</span>
                  </div>
                </td>
              </tr>
            ) : (
              questions.map((q) => (
                <tr key={q._id}>
                  <td className="mono text-muted">{q.question_id ?? '—'}</td>
                  <td>
                    <span className="tag sapphire">{q.category_title || 'اطلاعات عمومی'}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, marginBottom: 6, lineHeight: 1.5 }}>{q.question}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(q.options || []).map((opt, idx) => {
                        const isCorrect = idx === q.correct;
                        return (
                          <span
                            key={idx}
                            className={`tag ${isCorrect ? 'emerald' : ''}`}
                            style={{ fontSize: 11.5 }}
                          >
                            {isCorrect && <CheckCircle size={11} />}
                            <span>
                              {idx + 1}. {opt}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  {canWrite && (
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn-icon sm"
                          onClick={() => openEditModal(q)}
                          title={lang === 'fa' ? 'ویرایش سوال' : 'Edit Question'}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon sm danger"
                          onClick={() => handleDeleteQuestion(q)}
                          title={lang === 'fa' ? 'حذف سوال' : 'Delete Question'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="pagination">
            <span>
              {lang === 'fa'
                ? `صفحه ${formatNumber(page, lang)} از ${formatNumber(totalPages, lang)} (کل: ${formatNumber(total, lang)})`
                : `Page ${page} of ${totalPages} (${total} total)`}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {lang === 'fa' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                <span>{lang === 'fa' ? 'قبلی' : 'Prev'}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <span>{lang === 'fa' ? 'بعدی' : 'Next'}</span>
                {lang === 'fa' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Question Modal */}
      {editorOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => !saving && setEditorOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <HelpCircle size={17} className="text-accent" />
                <span>
                  {editingItem
                    ? lang === 'fa' ? 'ویرایش سوال کوییز' : 'Edit Quiz Question'
                    : lang === 'fa' ? 'افزودن سوال جدید' : 'New Quiz Question'}
                </span>
              </div>
              <button type="button" className="btn-icon sm" onClick={() => setEditorOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="input-group">
                    <label className="input-label">{lang === 'fa' ? 'عنوان دسته‌بندی' : 'Category Title'}</label>
                    <input
                      type="text"
                      className="input-field"
                      list="quiz-category-suggestions"
                      value={qCategoryTitle}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQCategoryTitle(val);
                        const match = categories.find((c) => c.category_title === val);
                        if (match) setQCategoryId(match.category_id);
                      }}
                      required
                    />
                    <datalist id="quiz-category-suggestions">
                      {categories.map((c) => (
                        <option key={`${c.category_id}-${c.category_title}`} value={c.category_title} />
                      ))}
                    </datalist>
                  </div>
                  <div className="input-group">
                    <label className="input-label">{lang === 'fa' ? 'شناسه عددی دسته' : 'Category ID'}</label>
                    <input
                      type="number"
                      className="input-field mono"
                      value={qCategoryId}
                      onChange={(e) => setQCategoryId(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">{lang === 'fa' ? 'متن سوال' : 'Question Text'}</label>
                  <textarea
                    className="textarea-field"
                    value={qText}
                    onChange={(e) => setQText(e.target.value)}
                    placeholder={lang === 'fa' ? 'صورت سوال را بنویسید...' : 'Enter the question...'}
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">
                    {lang === 'fa' ? 'گزینه‌ها (گزینه صحیح را انتخاب کنید)' : 'Options (select the correct answer)'}
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[0, 1, 2, 3].map((idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="radio"
                          name="correct-opt"
                          checked={qCorrect === idx}
                          onChange={() => setQCorrect(idx)}
                          aria-label={`Correct option ${idx + 1}`}
                        />
                        <input
                          type="text"
                          className="input-field"
                          value={qOptions[idx] || ''}
                          onChange={(e) => {
                            const next = [...qOptions];
                            next[idx] = e.target.value;
                            setQOptions(next);
                          }}
                          placeholder={`${lang === 'fa' ? 'گزینه' : 'Option'} ${idx + 1}`}
                          required
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditorOpen(false)} disabled={saving}>
                  {lang === 'fa' ? 'انصراف' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving
                    ? lang === 'fa' ? 'در حال ذخیره...' : 'Saving...'
                    : lang === 'fa' ? 'ذخیره سوال' : 'Save Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk JSON Import Modal */}
      {importOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => !importing && setImportOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Upload size={17} className="text-accent" />
                <span>{lang === 'fa' ? 'ورود گروهی سوالات (JSON)' : 'Bulk Import Questions (JSON)'}</span>
              </div>
              <button type="button" className="btn-icon sm" onClick={() => setImportOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleBulkImport}>
              <div className="modal-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span className="text-secondary" style={{ fontSize: 12.5 }}>
                    {lang === 'fa'
                      ? 'آرایه‌ای از سوالات با کلیدهای question، options (۴ تایی)، correct (۰ تا ۳) و category_title:'
                      : 'JSON array with question, options (4 items), correct (0-3), and category_title:'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setImportJson(SAMPLE_IMPORT_JSON)}
                  >
                    {lang === 'fa' ? 'درج نمونه' : 'Load Sample'}
                  </button>
                </div>
                <textarea
                  className="textarea-field mono"
                  style={{ minHeight: 200, direction: 'ltr', textAlign: 'left', fontSize: 12 }}
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder={SAMPLE_IMPORT_JSON}
                  required
                />
                {importResult && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 10,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface-2)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: 12.5,
                    }}
                  >
                    <div className="text-emerald" style={{ fontWeight: 600 }}>
                      {lang === 'fa'
                        ? `ثبت‌شده: ${formatNumber(importResult.inserted_count, lang)} | ردشده: ${formatNumber(importResult.skipped_count, lang)}`
                        : `Inserted: ${importResult.inserted_count} | Skipped: ${importResult.skipped_count}`}
                    </div>
                    {importResult.errors.length > 0 && (
                      <ul style={{ margin: '6px 0 0 16px', fontSize: 11.5 }} className="text-crimson">
                        {importResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setImportOpen(false)} disabled={importing}>
                  {lang === 'fa' ? 'بستن' : 'Close'}
                </button>
                <button type="submit" className="btn btn-primary" disabled={importing}>
                  {importing
                    ? lang === 'fa' ? 'در حال ثبت...' : 'Importing...'
                    : lang === 'fa' ? 'شروع ورود گروهی' : 'Import Questions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
