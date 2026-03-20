import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// In a real app, these would typically be modularized into separate JSON files (e.g., locales/en/translation.json)
const resources = {
  en: {
    translation: {
      app: {
        name: "Glidelines",
        syncedJustNow: "Synced just now",
        connectToGitHub: "Connect to GitHub",
        connected: "Connected",
        connectedAccounts: "Connected Accounts",
        manageAccounts: "Manage your accounts.",
        disconnect: "Disconnect",
        connectToAdd: "Connect to Add",
        projectLabel: "Project",
        projectIdPlaceholder: "Enter ID...",
        emptyProjectOption: "Empty Project",
        dummyProjectOption: "Dummy Project",
        language: "Language",
        authTitle: "GitHub Authentication",
        authDesc: "Enter your Personal Access Token to connect securely.",
        authInputPlaceholder: "ghp_...",
        authSave: "Save Token",
        authCancel: "Cancel"
      },
      dashboard: {
        issuesList: "Issues List",
        filterPlaceholder: "Filter issues...",
        emptyStateTitle: "No projects",
        emptyStateDesc: "Get started by creating a new project.",
        addProjectButton: "Add Project",
        addProjectTimelinePrompt: "Add a project to view timeline",
      },
      table: {
        id: "ID",
        title: "Title",
        status: "Status",
        assignees: "Assignees",
      },
      days: {
        mon: "Mon 10",
        tue: "Tue 11",
        wed: "Wed 12",
        thu: "Thu 13",
        fri: "Thu 14",
        sat: "Sat 15",
        sun: "Sun 16",
      },
      taskStatuses: {
        inProgress: "In Progress",
        done: "Done",
        todo: "Todo"
      }
    }
  },
  ja: {
    translation: {
      app: {
        name: "Glidelines",
        syncedJustNow: "たった今同期しました",
        connectToGitHub: "GitHubへ接続",
        connected: "接続済み",
        connectedAccounts: "接続されたアカウント",
        manageAccounts: "アカウントを管理します。",
        disconnect: "切断する",
        connectToAdd: "接続して追加",
        projectLabel: "プロジェクト",
        projectIdPlaceholder: "IDを入力...",
        emptyProjectOption: "空のプロジェクト",
        dummyProjectOption: "ダミープロジェクト",
        language: "言語",
        authTitle: "GitHub認証",
        authDesc: "パーソナルアクセストークンを入力して安全に接続してください。",
        authInputPlaceholder: "ghp_...",
        authSave: "トークンを保存",
        authCancel: "キャンセル"
      },
      dashboard: {
        issuesList: "課題リスト",
        filterPlaceholder: "課題をフィルタリング...",
        emptyStateTitle: "プロジェクトがありません",
        emptyStateDesc: "新しいプロジェクトを作成して始めましょう。",
        addProjectButton: "プロジェクトを追加",
        addProjectTimelinePrompt: "タイムラインを表示するにはプロジェクトを追加してください",
      },
      table: {
        id: "ID",
        title: "タイトル",
        status: "ステータス",
        assignees: "担当者",
      },
      days: {
        mon: "月 10",
        tue: "火 11",
        wed: "水 12",
        thu: "木 13",
        fri: "金 14",
        sat: "土 15",
        sun: "日 16",
      },
      taskStatuses: {
        inProgress: "進行中",
        done: "完了",
        todo: "未着手"
      }
    }
  },
  'zh-CN': {
    translation: {
      app: {
        name: "Glidelines",
        syncedJustNow: "刚刚同步",
        connectToGitHub: "连接到 GitHub",
        connected: "已连接",
        connectedAccounts: "已连接的帐户",
        manageAccounts: "管理您的帐户。",
        disconnect: "断开连接",
        connectToAdd: "连接以添加",
        projectLabel: "项目",
        projectIdPlaceholder: "输入 ID...",
        emptyProjectOption: "空项目",
        dummyProjectOption: "演示项目",
        language: "语言",
        authTitle: "GitHub 身份验证",
        authDesc: "输入您的个人访问令牌以安全连接。",
        authInputPlaceholder: "ghp_...",
        authSave: "保存令牌",
        authCancel: "取消"
      },
      dashboard: {
        issuesList: "问题列表",
        filterPlaceholder: "过滤问题...",
        emptyStateTitle: "暂无项目",
        emptyStateDesc: "新建一个项目开始你的工作。",
        addProjectButton: "添加项目",
        addProjectTimelinePrompt: "添加一个项目以查看时间线",
      },
      table: {
        id: "ID",
        title: "标题",
        status: "状态",
        assignees: "经办人",
      },
      days: {
        mon: "周一 10",
        tue: "周二 11",
        wed: "周三 12",
        thu: "周四 13",
        fri: "周五 14",
        sat: "周六 15",
        sun: "周日 16",
      },
      taskStatuses: {
        inProgress: "进行中",
        done: "已完成",
        todo: "待办"
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // React already escapes values naturally
    }
  });

export default i18n;
