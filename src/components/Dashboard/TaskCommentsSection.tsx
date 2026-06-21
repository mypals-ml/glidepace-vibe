import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useDashboard } from '../../context/DashboardContext';
import type { Task } from '../../types';
import { Button } from '../UI/Button';
import { ConfirmationModal } from '../UI/ConfirmationModal';
import { ResizableTextarea } from '../UI/ResizableTextarea';
import { TaskDetailsCopyButton } from './TaskDetailsCopyButton';

interface TaskCommentsSectionProps {
  task: Task;
  t: TFunction;
  resizeTextFieldLabel: string;
}

export function TaskCommentsSection({ task, t, resizeTextFieldLabel }: TaskCommentsSectionProps) {
  const {
    isFetchingComments,
    updateTaskComment,
    deleteTaskComment,
    addTaskComment,
  } = useDashboard();

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [draftComment, setDraftComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [newCommentBody, setNewCommentBody] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);

  const handleSaveComment = async (commentId: string) => {
    await updateTaskComment(task, commentId, draftComment);
    setEditingCommentId(null);
  };

  const handleDeleteComment = (commentId: string) => {
    setCommentToDelete(commentId);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteComment = async () => {
    if (!commentToDelete) return;
    setIsDeletingComment(true);
    try {
      await deleteTaskComment(task, commentToDelete);
      setIsDeleteConfirmOpen(false);
      setCommentToDelete(null);
    } finally {
      setIsDeletingComment(false);
    }
  };

  const handleAddComment = async () => {
    if (!newCommentBody.trim()) return;
    setIsSubmittingComment(true);
    const success = await addTaskComment(task, newCommentBody);
    if (success) {
      setNewCommentBody('');
    }
    setIsSubmittingComment(false);
  };

  return (
    <div className="border-t border-slate-200/60 pt-3">
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-medium text-slate-600">
          {t('dashboard.comments', { count: (task.comments || []).length })}
        </label>
        {isFetchingComments[task.id] && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
            <svg className="animate-spin h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>{t('dashboard.loadingComments', 'Loading comments...')}</span>
          </div>
        )}
      </div>
      
      {task.isDraft ? (
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200/60">
          <p className="text-xs text-slate-500 italic leading-relaxed">
            {t('dashboard.draftCommentsDisabled')}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {(task.comments || []).map((comment) => (
              editingCommentId === comment.id ? (
                <div key={comment.id} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${comment.author.avatarColor}`}>
                      {comment.author.avatarUrl ? (
                        <img src={comment.author.avatarUrl} alt={comment.author.name} className="w-full h-full rounded-full object-cover" />
                      ) : comment.author.initials}
                    </div>
                    <span className="text-xs font-medium text-slate-700">{comment.author.name}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(comment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <ResizableTextarea
                    value={draftComment}
                    onChange={(e) => setDraftComment(e.target.value)}
                    resizeHandleLabel={resizeTextFieldLabel}
                    className="w-full border border-slate-300 rounded-lg bg-white p-3 text-sm shadow-sm focus:ring focus:ring-primary/20 outline-none min-h-[60px] resize-y resizable-textarea"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="primary" size="sm" onClick={() => handleSaveComment(comment.id)}>{t('common.save')}</Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditingCommentId(null)}>{t('common.cancel')}</Button>
                  </div>
                </div>
              ) : (
                <div key={comment.id} className="border border-slate-200/60 rounded-lg bg-white/95 pt-0 px-0 pb-3 shadow-sm group relative">
                  <div className="flex items-center gap-2 bg-slate-50 px-3 h-11 rounded-t-lg border-b border-slate-200/60 mb-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${comment.author.avatarColor}`}>
                      {comment.author.avatarUrl ? (
                        <img src={comment.author.avatarUrl} alt={comment.author.name} className="w-full h-full rounded-full object-cover" />
                      ) : comment.author.initials}
                    </div>
                    <span className="text-xs font-medium text-slate-700">{comment.author.name}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(comment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <>
                    <p className="px-3 pt-2 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{comment.body}</p>
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      <TaskDetailsCopyButton text={comment.body} t={t} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEditingCommentId(comment.id); setDraftComment(comment.body); }}
                      >
                        {t('common.edit', 'Edit')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleDeleteComment(comment.id)}
                      >
                        {t('common.delete', 'Delete')}
                      </Button>
                    </div>
                  </>
                </div>
              )
            ))}
          </div>

          {/* Add Comment Input */}
          <div className="mt-8 border-t border-slate-200/60 pt-4">
            <label className="text-xs font-medium text-slate-600 block mb-3">
              {t('dashboard.addTaskComment', 'Add a comment')}
            </label>
            <ResizableTextarea
              value={newCommentBody}
              onChange={(e) => setNewCommentBody(e.target.value)}
              placeholder={t('dashboard.addCommentPlaceholder', 'Comment here ...')}
              resizeHandleLabel={resizeTextFieldLabel}
              className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none min-h-[80px] resize-y resizable-textarea bg-white placeholder:text-slate-400"
              disabled={isSubmittingComment}
            />
            <div className="flex justify-end mt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddComment}
                disabled={isSubmittingComment || !newCommentBody.trim()}
                isLoading={isSubmittingComment}
                rightIcon="send"
              >
                {t('dashboard.addComment', 'Comment')}
              </Button>
            </div>
          </div>
        </>
      )}

      <ConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          if (isDeletingComment) return;
          setIsDeleteConfirmOpen(false);
          setCommentToDelete(null);
        }}
        onConfirm={confirmDeleteComment}
        title={t('common.delete', 'Delete')}
        message={t('common.confirmDelete', 'Are you sure you want to delete this comment?')}
        confirmLabel={t('common.delete', 'Delete')}
        variant="danger"
        isConfirming={isDeletingComment}
      />
    </div>
  );
}
