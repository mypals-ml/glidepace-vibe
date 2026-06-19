import { useState, type MouseEvent } from 'react';
import type { TFunction } from 'i18next';
import { copyTextToClipboard } from '../../lib/clipboard';
import { IconButton } from '../UI/IconButton';

export function TaskDetailsCopyButton({ text, t }: { text: string; t: TFunction }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!text) return;
    try {
      const successful = await copyTextToClipboard(text);
      if (!successful) throw new Error('copy command failed');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <IconButton
      icon={copied ? 'check' : 'content_copy'}
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className={`${copied ? 'bg-green-50 text-green-600 scale-110 font-bold' : ''}`}
      iconClassName="!text-[16px]"
      title={copied ? t('common.copied', 'Copied!') : t('common.copy', 'Copy')}
      aria-label={copied ? t('common.copied', 'Copied!') : t('common.copy', 'Copy')}
    />
  );
}
