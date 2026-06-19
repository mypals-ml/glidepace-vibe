import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import type { AutoUpdateStartDateMode, User } from '../../types';
import { getStatusColor, getStatusDotColor } from '../../utils/statusColors';
import { AssigneePicker } from './AssigneePicker';
import { StatusPicker } from './StatusPicker';
import { Button } from '../UI/Button';
import { ResizableTextarea } from '../UI/ResizableTextarea';

interface TaskDetailsCreateFormProps {
  t: TFunction;
  newTitle: string;
  setNewTitle: Dispatch<SetStateAction<string>>;
  newDesc: string;
  setNewDesc: Dispatch<SetStateAction<string>>;
  newStatus: string;
  setNewStatus: Dispatch<SetStateAction<string>>;
  newAssignees: User[];
  setNewAssignees: Dispatch<SetStateAction<User[]>>;
  newStartDate: string;
  setNewStartDate: Dispatch<SetStateAction<string>>;
  newTargetDate: string;
  newEstimate: string;
  setNewEstimate: Dispatch<SetStateAction<string>>;
  newEstimateUnit: string;
  setNewEstimateUnit: Dispatch<SetStateAction<string>>;
  newAutoUpdateMode: AutoUpdateStartDateMode;
  setNewAutoUpdateMode: Dispatch<SetStateAction<AutoUpdateStartDateMode>>;
  isCreating: boolean;
  isAssigneePickerOpen: boolean;
  setIsAssigneePickerOpen: Dispatch<SetStateAction<boolean>>;
  isStatusPickerOpen: boolean;
  setIsStatusPickerOpen: Dispatch<SetStateAction<boolean>>;
  mergedEstimateUnitOptions: string[];
  projectRepository?: string;
  resizeTextFieldLabel: string;
  onCreate: () => void;
  onCancel: () => void;
}

export function TaskDetailsCreateForm({
  t,
  newTitle,
  setNewTitle,
  newDesc,
  setNewDesc,
  newStatus,
  setNewStatus,
  newAssignees,
  setNewAssignees,
  newStartDate,
  setNewStartDate,
  newTargetDate,
  newEstimate,
  setNewEstimate,
  newEstimateUnit,
  setNewEstimateUnit,
  newAutoUpdateMode,
  setNewAutoUpdateMode,
  isCreating,
  isAssigneePickerOpen,
  setIsAssigneePickerOpen,
  isStatusPickerOpen,
  setIsStatusPickerOpen,
  mergedEstimateUnitOptions,
  projectRepository,
  resizeTextFieldLabel,
  onCreate,
  onCancel,
}: TaskDetailsCreateFormProps) {
  return (
    <div className="space-y-6">
      <div className="border border-slate-200/60 rounded-lg bg-white/95 pt-0 px-0 pb-3 shadow-sm group">
        <div className="flex items-center justify-between bg-slate-50 px-3 h-11 rounded-t-lg border-b border-slate-200/60 mb-0">
          <label className="text-xs font-medium text-slate-600">{t('createTask.titlePlaceholder', 'Task Title')}</label>
        </div>
        <div className="px-3 pt-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t('createTask.titlePlaceholder', 'Task title')}
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            autoFocus
          />
        </div>
      </div>

      <div className="border border-slate-200/60 rounded-lg bg-white/95 pt-0 px-0 pb-3 shadow-sm group">
        <div className="flex items-center justify-between bg-slate-50 px-3 h-11 rounded-t-lg border-b border-slate-200/60 mb-0">
          <label className="text-xs font-medium text-slate-600">{t('dashboard.description')}</label>
        </div>
        <div className="px-3 pt-3">
          <ResizableTextarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder={t('dashboard.descriptionPlaceholder', 'Add description...')}
            resizeHandleLabel={resizeTextFieldLabel}
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[120px] resize-y resizable-textarea"
          />
        </div>
      </div>

      <div className="border-t border-slate-200/60 pt-3 relative">
        <label className="text-xs font-medium text-slate-600 block mb-3">{t('table.status')}</label>
        <div
          className="flex flex-wrap gap-2 cursor-pointer p-1 -m-1 rounded hover:bg-slate-50 transition-colors"
          onClick={() => setIsStatusPickerOpen(true)}
        >
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${getStatusColor(newStatus)}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(newStatus)}`}></span>
            <span className="text-sm font-medium">{newStatus}</span>
          </div>
        </div>
        {isStatusPickerOpen && (
          <StatusPicker
            task={null}
            onClose={() => setIsStatusPickerOpen(false)}
            onSelect={(status) => {
              setNewStatus(status);
              setIsStatusPickerOpen(false);
            }}
          />
        )}
      </div>

      <div className="border-t border-slate-200/60 pt-3 relative">
        <label className="text-xs font-medium text-slate-600 block mb-3">{t('table.assignees')}</label>
        <div
          className="flex flex-wrap gap-2 cursor-pointer p-1 -m-1 rounded hover:bg-slate-50 transition-colors"
          onClick={() => setIsAssigneePickerOpen(true)}
        >
          {newAssignees.length > 0 ? newAssignees.map(user => (
            <div key={user.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${user.avatarColor}`}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <span className="text-xs font-bold">{user.initials}</span>
              )}
              <span className="text-sm font-medium">{user.name}</span>
            </div>
          )) : (
            <span className="text-sm text-slate-500">{t('dashboard.unassigned')}</span>
          )}
        </div>
        {isAssigneePickerOpen && (
          <AssigneePicker
            taskId="new"
            currentAssignees={newAssignees}
            repository={projectRepository}
            onClose={() => setIsAssigneePickerOpen(false)}
            onSelect={(users) => setNewAssignees(users)}
          />
        )}
      </div>

      <div className="border-t border-slate-200/60 pt-3 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-2">{t('dashboard.startDate')}</label>
            <input
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded p-1.5 cursor-pointer outline-none focus:ring focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-2">{t('dashboard.targetDate')}</label>
            <input
              type="date"
              value={newTargetDate}
              readOnly
              className="w-full text-sm text-slate-400 bg-slate-100 border border-slate-200 rounded p-1.5 cursor-not-allowed outline-none"
              title={t('dashboard.targetDateAutoCalc', 'Target date is calculated based on start date and estimate')}
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-2">
            {t('createTask.estimate', 'Estimate')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={newEstimate}
              onChange={(e) => setNewEstimate(e.target.value)}
              placeholder="0"
              className="w-24 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded p-1.5 outline-none focus:ring focus:ring-primary/20"
            />
            <select
              value={newEstimateUnit}
              onChange={(e) => setNewEstimateUnit(e.target.value)}
              className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-1.5 outline-none focus:ring focus:ring-primary/20 cursor-pointer"
            >
              {mergedEstimateUnitOptions.map(opt => (
                <option key={opt} value={opt}>{t(`units.${opt}`, opt)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="pt-2">
          <label className="text-xs font-medium text-slate-600 block mb-2">{t('dashboard.autoUpdateStartDateLabel')}</label>
          <select
            value={newAutoUpdateMode}
            onChange={(e) => setNewAutoUpdateMode(e.target.value as AutoUpdateStartDateMode)}
            className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded p-1.5 outline-none focus:ring focus:ring-primary/20 cursor-pointer"
          >
            <option value="auto">{t('dashboard.modeAuto')}</option>
            <option value="locked">{t('dashboard.modeLocked')}</option>
            <option value="ask">{t('dashboard.modeAsk')}</option>
          </select>
        </div>
      </div>

      <div className="pt-4 flex flex-col gap-3">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onCreate}
          disabled={!newTitle.trim() || isCreating}
          isLoading={isCreating}
          leftIcon="add_circle"
        >
          {t('createTask.create', 'Create Task')}
        </Button>
        <Button variant="ghost" size="sm" fullWidth onClick={onCancel}>
          {t('common.cancel', 'Cancel')}
        </Button>
      </div>
      <div className="h-20" />
    </div>
  );
}
