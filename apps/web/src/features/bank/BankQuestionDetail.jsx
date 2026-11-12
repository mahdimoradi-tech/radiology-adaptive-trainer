import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Badge, Button, XrayImage, Alert } from '../../components/ui/index.js';

export function BankQuestionDetail({ question, onApprove, onReject, onEdit, isActionLoading }) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [editError, setEditError] = useState(null);

  // Edit form state
  const [editStem, setEditStem] = useState('');
  const [editOptions, setEditOptions] = useState([]);
  const [editCorrectIndex, setEditCorrectIndex] = useState(0);
  const [editRationale, setEditRationale] = useState('');
  const [editNote, setEditNote] = useState('');

  if (!question) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] border border-dashed border-slate-200 rounded-2xl bg-white p-8 text-center text-slate-600 text-xs">
        {t('instructor.review.noSelection')}
      </div>
    );
  }

  const startEditing = () => {
    setEditStem(question.stem);
    setEditOptions(question.options.map((o) => ({ text: o.text })));
    setEditCorrectIndex(question.correctIndex);
    setEditRationale(question.rationale);
    setEditNote('');
    setEditError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditError(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError(null);
    try {
      await onEdit({
        stem: editStem,
        options: editOptions,
        correctIndex: editCorrectIndex,
        rationale: editRationale,
        note: editNote || undefined,
      });
      setIsEditing(false);
    } catch (err) {
      setEditError(err.message || 'خطا در اعتبارسنجی ویرایش');
    }
  };

  const handleApprove = () => {
    onApprove({ note: reviewNote || undefined });
    setReviewNote('');
  };

  const handleReject = () => {
    onReject({ note: reviewNote || undefined });
    setReviewNote('');
  };

  const optionLetters = ['الف', 'ب', 'ج', 'د'];

  return (
    <Card className="h-full flex flex-col p-6 overflow-y-auto">
      {/* Header and Honest Labeling */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-200">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="warning">{t('instructor.review.nonClinicalBadge')}</Badge>
          <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
            {question.pair?.trueClass} vs {question.pair?.confusedWith}
          </span>
          <Badge variant="neutral">{question.bucket}</Badge>
          <Badge variant="primary">{t(`instructor.review.${question.type}`)}</Badge>
          {question.edited && <Badge variant="neutral">{t('instructor.review.edited')}</Badge>}
        </div>

        {/* Actions Bar (when not in edit mode) */}
        {!isEditing && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={isActionLoading} onClick={startEditing}>
              {t('instructor.review.editAction')}
            </Button>
            <Button variant="danger" size="sm" isLoading={isActionLoading} onClick={handleReject}>
              {t('instructor.review.rejectAction')}
            </Button>
            <Button variant="primary" size="sm" isLoading={isActionLoading} onClick={handleApprove}>
              {t('instructor.review.approveAction')}
            </Button>
          </div>
        )}
      </div>

      {/* Review Note Input (when not editing) */}
      {!isEditing && (
        <div className="mb-4">
          <input
            type="text"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder={t('instructor.review.notePlaceholder')}
            className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="space-y-6">
        {/* Image Display */}
        {question.imageUrl && (
          <div className="flex justify-center bg-slate-950 rounded-xl p-3 max-h-72">
            <XrayImage
              src={question.imageUrl}
              alt="Chest X-Ray"
              className="max-h-64 object-contain rounded-lg"
            />
          </div>
        )}

        {/* Edit Form OR View Mode */}
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <Alert variant="warning">{t('instructor.review.editReturnsToPending')}</Alert>

            {editError && <Alert variant="danger">{editError}</Alert>}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('instructor.review.stem')}
              </label>
              <textarea
                rows={3}
                value={editStem}
                onChange={(e) => setEditStem(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                {t('instructor.review.options')} (انتخاب پاسخ صحیح)
              </label>
              {editOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correctOption"
                    checked={editCorrectIndex === idx}
                    onChange={() => setEditCorrectIndex(idx)}
                    className="h-4 w-4 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-semibold text-slate-500 w-6">
                    {optionLetters[idx]}
                  </span>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => {
                      const updated = [...editOptions];
                      updated[idx].text = e.target.value;
                      setEditOptions(updated);
                    }}
                    className="flex-1 text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    required
                  />
                  {question.options[idx]?.key && (
                    <span className="text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                      {question.options[idx].key}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('instructor.review.rationale')}
              </label>
              <textarea
                rows={2}
                maxLength={300}
                value={editRationale}
                onChange={(e) => setEditRationale(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                required
              />
              <span className="text-[10px] text-slate-600 text-end block">
                {editRationale.length}/300
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('instructor.review.note')}
              </label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="توضیح دلیل ویرایش..."
                className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={cancelEditing}>
                {t('instructor.review.cancelEdit')}
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isActionLoading}>
                {t('instructor.review.saveEdit')}
              </Button>
            </div>
          </form>
        ) : (
          <>
            {/* Question Stem */}
            <div>
              <span className="text-[11px] font-bold text-slate-500 block mb-1">
                {t('instructor.review.stem')}
              </span>
              <p className="text-sm font-semibold text-slate-900 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                {question.stem}
              </p>
            </div>

            {/* Options */}
            <div>
              <span className="text-[11px] font-bold text-slate-500 block mb-2">
                {t('instructor.review.options')}
              </span>
              <div className="grid grid-cols-1 gap-2">
                {question.options.map((opt, idx) => {
                  const isCorrect = idx === question.correctIndex;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-colors ${
                        isCorrect
                          ? 'border-emerald-500 bg-emerald-50/60 font-semibold text-emerald-950 ring-1 ring-emerald-500/30'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-500 w-5">{optionLetters[idx]}</span>
                        <span>{opt.text}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {opt.key && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                            {opt.key}
                          </span>
                        )}
                        {isCorrect && (
                          <Badge variant="success" size="sm">
                            {t('instructor.review.correctOption')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Educational Rationale */}
            <div>
              <span className="text-[11px] font-bold text-slate-500 block mb-1">
                {t('instructor.review.rationale')}
              </span>
              <p className="text-xs text-slate-700 leading-relaxed bg-amber-50/40 p-3 rounded-xl border border-amber-200/60">
                {question.rationale}
              </p>
            </div>

            {/* KB Reference */}
            {question.kbRef && (
              <div className="flex items-center justify-between bg-slate-100/70 p-3 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-600 font-medium">
                  {t('instructor.review.kbReference')}:{' '}
                  <span className="font-mono text-slate-800">{question.kbRef}</span>
                </span>
                <Badge variant="warning" size="sm">
                  {t('instructor.review.kbDraft')}
                </Badge>
              </div>
            )}

            {/* AI Consensus Summary */}
            {question.analysisSummary?.consensus && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1 text-slate-600">
                <span className="font-bold text-slate-800 block mb-1">
                  {t('instructor.review.consensus')}
                </span>
                {question.analysisSummary.consensus.patterns?.length > 0 && (
                  <div>
                    {t('instructor.review.patterns')}:{' '}
                    <span className="font-semibold text-slate-800">
                      {question.analysisSummary.consensus.patterns.join(', ')}
                    </span>
                  </div>
                )}
                {question.analysisSummary.consensus.distribution && (
                  <div>
                    توزیع:{' '}
                    <span className="font-semibold text-slate-800">
                      {question.analysisSummary.consensus.distribution}
                    </span>
                  </div>
                )}
                {question.analysisSummary.certaintyA && (
                  <div>
                    اطمینان مدل:{' '}
                    <span className="text-slate-700">
                      A: {question.analysisSummary.certaintyA} | B:{' '}
                      {question.analysisSummary.certaintyB || 'N/A'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Audit History */}
            {question.history?.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-slate-500 block mb-1.5">
                  {t('instructor.review.history')}
                </span>
                <div className="space-y-1.5">
                  {question.history.map((h, idx) => (
                    <div
                      key={idx}
                      className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-between flex-wrap gap-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <Badge variant="neutral" size="sm">
                          {h.action}
                        </Badge>
                        <span className="font-medium text-slate-700">{h.by}</span>
                        {h.note && <span className="text-slate-500 italic">({h.note})</span>}
                      </div>
                      <span className="text-slate-600 text-[10px]">
                        {new Date(h.at).toLocaleDateString('fa-IR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
