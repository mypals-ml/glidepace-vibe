import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// In a real app, these would typically be modularized into separate JSON files (e.g., locales/en/translation.json)
const resources = {
  en: {
    translation: {
      app: {
        name: "Glidepace",
        syncedJustNow: "Synced just now",
        signInWithGitHub: "Sign In with GitHub",
        projectLabel: "Project",
        projectIdPlaceholder: "Enter ID...",
        emptyProjectOption: "Empty Project",
        dummyProjectOption: "Dummy Project",
        language: "Language",
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
        name: "Glidepace",
        syncedJustNow: "たった今同期しました",
        signInWithGitHub: "GitHubでサインイン",
        projectLabel: "プロジェクト",
        projectIdPlaceholder: "IDを入力...",
        emptyProjectOption: "空のプロジェクト",
        dummyProjectOption: "ダミープロジェクト",
        language: "言語",
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
        name: "Glidepace",
        syncedJustNow: "刚刚同步",
        signInWithGitHub: "使用 GitHub 登录",
        projectLabel: "项目",
        projectIdPlaceholder: "输入 ID...",
        emptyProjectOption: "空项目",
        dummyProjectOption: "演示项目",
        language: "语言",
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
