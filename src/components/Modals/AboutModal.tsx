import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import { Button } from '../UI/Button';
import { IconButton } from '../UI/IconButton';

export function AboutModal() {
  const { t, i18n } = useTranslation();
  const { isAboutModalOpen, setIsAboutModalOpen } = useDashboard();

  if (!isAboutModalOpen) return null;

  // Open the static help center in the user's current UI language.
  const helpHref = `/help/index.html?lang=${encodeURIComponent(i18n.language)}`;

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
              'Glidelines turns GitHub Projects into a synchronized planning workspace with timeline, list, and forecast views.'
            )}
          </p>
          <p className="mt-3 max-w-xl text-xs leading-6 text-slate-500">
            {t(
              'about.openSource',
              'Glidelines is free and open source, released under the MIT License.'
            )}{' '}
            <a
              href="https://github.com/mypals-ml/glidepace-vibe"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-sky-700 underline-offset-2 hover:underline"
            >
              {t('about.openSourceLink', 'View the source on GitHub')}
            </a>
          </p>
        </div>

        <div className="space-y-4 p-8">
          <p className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm leading-6 text-slate-700">
            {t(
              'about.supportingCopy',
              'Use the header tools to connect accounts, open projects, refine project settings, and keep task scheduling aligned with GitHub.'
            )}
          </p>

          <a
            href={helpHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-sky-50/60 px-4 py-3.5 transition-colors hover:border-indigo-200 hover:from-indigo-50 hover:to-sky-50"
          >
            <span className="material-symbols-outlined shrink-0 rounded-xl bg-white/80 p-2 text-[22px] text-indigo-600 shadow-sm">
              menu_book
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">
                {t('about.helpGuide', 'User Guide & Help')}
              </span>
              <span className="block text-xs leading-5 text-slate-500">
                {t('about.helpGuideDescription', 'Step-by-step guides to every key feature, in your language.')}
              </span>
            </span>
            <span className="material-symbols-outlined shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5">
              arrow_forward
            </span>
          </a>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
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
