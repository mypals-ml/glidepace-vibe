import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import { Button } from '../UI/Button';
import { IconButton } from '../UI/IconButton';

export function AboutModal() {
  const { t } = useTranslation();
  const { isAboutModalOpen, setIsAboutModalOpen } = useDashboard();

  if (!isAboutModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="about-modal-title">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl animate-in fade-in zoom-in duration-300">
        <div className="border-b border-slate-200/70 bg-gradient-to-r from-sky-50 via-white to-emerald-50 p-8 pb-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-sky-700">
                {t('about.eyebrow', 'About')}
              </p>
              <h3 id="about-modal-title" className="text-2xl font-extrabold tracking-tight text-slate-900">
                {t('about.title', 'About Glidelines')}
              </h3>
            </div>
            <IconButton
              icon="close"
              variant="ghost"
              size="md"
              onClick={() => setIsAboutModalOpen(false)}
              aria-label={t('about.close', 'Close about dialog')}
            />
          </div>
          <p className="max-w-xl text-sm leading-6 text-slate-600">
            {t(
              'about.description',
              'Glidelines turns GitHub Projects into a synchronized planning workspace with timeline, list, and burndown views.'
            )}
          </p>
        </div>

        <div className="space-y-4 p-8">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                {t('about.cardRealtimeLabel', 'Realtime')}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {t('about.cardRealtimeValue', 'Live GitHub sync')}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                {t('about.cardViewsLabel', 'Views')}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {t('about.cardViewsValue', 'List, Gantt, Burndown')}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                {t('about.cardDataLabel', 'Source')}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {t('about.cardDataValue', 'GitHub Projects')}
              </p>
            </div>
          </div>

          <p className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm leading-6 text-slate-700">
            {t(
              'about.supportingCopy',
              'Use the header tools to connect accounts, open projects, refine project settings, and keep task scheduling aligned with GitHub.'
            )}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <a
              href="https://github.com/mypals-ml/glidepace-vibe"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Button variant="secondary" size="md" leftIcon="open_in_new" className="w-full sm:w-auto">
                {t('about.viewSource', 'View Source')}
              </Button>
            </a>
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsAboutModalOpen(false)}
              leftIcon="check_circle"
              className="w-full sm:w-auto"
            >
              {t('about.closeButton', 'Close')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
