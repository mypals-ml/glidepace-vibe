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
        locales: {
          en: "EN",
          ja: "日本語",
          zhCN: "中文"
        },
        authTitle: "GitHub Authentication",
        authDesc: "Enter your Personal Access Token to connect securely.",
        authInputPlaceholder: "ghp_...",
        authSave: "Save Token",
        authCancel: "Cancel",
        connectedAccountsLabel: "Connected Accounts",
        activeStatus: "ACTIVE",
        addAccountPermissionNotice: "Adding new accounts may require additional permissions from your Github account."
      },
      dashboard: {
        issuesList: "Issues List",
        filterPlaceholder: "Filter issues...",
        emptyStateTitle: "No projects",
        emptyStateDesc: "Get started by creating a new project.",
        addProjectButton: "Open Project",
        addProjectTimelinePrompt: "Add a project to view timeline",
        openProjectsModalTitle: "Open Projects",
        openProjectsModalDesc: "Connect and open a GitHub project",
        manageButton: "Manage",
        searchProjectsPlaceholder: "Search projects...",
        sortBy: "Sort by:",
        sortRecent: "Recent",
        sortOldest: "Oldest",
        sortNameAZ: "Name (A → Z)",
        sortNameZA: "Name (Z → A)",
        projectIdPrefix: "Project ID: ",
        projectAvailable: "Available",
        openProjectAction: "Open",
        noProjectsFound: "No active GitHub Projects found in this account.",
        refreshProjects: "Refresh Projects",
        orgProjectsHelpLink: "Projects In an Organization?"
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
      },
      help: {
        orgProjectsTitle: "How to Access Organization Projects",
        orgProjectsIntro: "If you cannot see an organization's projects, it may be because you need to grant third-party OAuth access or update your token's scopes.",
        checkScopeTitle: "1. Check Token Scopes",
        checkScopeDesc: "The application requests the read:org scope. If your current token doesn't have it, reconnect your account:",
        checkScopeStep1: "In the Open Projects modal, click Manage.",
        checkScopeStep2: "Click Disconnect next to your account.",
        checkScopeStep3: "Click Connect to add to log in again.",
        checkScopeWarning: "Make sure you see \"read:org\" or \"Read org and team membership\" in the authorization page.",
        grantAccessTitle: "2. Grant Third-party Access",
        grantAccessDesc: "By default, GitHub blocks third-party applications from reading organization data until an admin approves it.",
        grantAccessStep1: "Go to GitHub -> Settings -> Applications -> Authorized OAuth Apps.",
        grantAccessStep2: "Click on Glidepace Vibe (or your app name).",
        grantAccessStep3: "Scroll down to Organization access.",
        grantAccessStep4: "Click Grant next to the organization. If you are not an admin, click Request, and an admin will need to approve it before projects will appear.",
        grantAccessOrgPolicy: "If you revoked access to an organization and find no way to re-grant it, please follow the instructions here:",
        grantAccessOrgPolicyLink: "Read GitHub Docs",
        closeWindow: "Close Window"
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
        locales: {
          en: "EN",
          ja: "日本語",
          zhCN: "中文"
        },
        authTitle: "GitHub認証",
        authDesc: "パーソナルアクセストークンを入力して安全に接続してください。",
        authInputPlaceholder: "ghp_...",
        authSave: "トークンを保存",
        authCancel: "キャンセル",
        connectedAccountsLabel: "接続されたアカウント",
        activeStatus: "アクティブ",
        addAccountPermissionNotice: "新しいアカウントを追加するには、Githubアカウントからの追加の権限が必要になる場合があります。"
      },
      dashboard: {
        issuesList: "課題リスト",
        filterPlaceholder: "課題をフィルタリング...",
        emptyStateTitle: "プロジェクトがありません",
        emptyStateDesc: "新しいプロジェクトを作成して始めましょう。",
        addProjectButton: "プロジェクトを開く",
        addProjectTimelinePrompt: "タイムラインを表示するにはプロジェクトを追加してください",
        openProjectsModalTitle: "プロジェクトを開く",
        openProjectsModalDesc: "GitHubプロジェクトに接続して開く",
        manageButton: "管理",
        searchProjectsPlaceholder: "プロジェクトを検索...",
        sortBy: "並べ替え:",
        sortRecent: "最近",
        sortOldest: "古い順",
        sortNameAZ: "名前 (A → Z)",
        sortNameZA: "名前 (Z → A)",
        projectIdPrefix: "プロジェクトID: ",
        projectAvailable: "利用可能",
        openProjectAction: "開く",
        noProjectsFound: "このアカウントでアクティブなGitHubプロジェクトが見つかりませんでした。",
        refreshProjects: "プロジェクトを更新",
        orgProjectsHelpLink: "組織のプロジェクトですか？"
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
      },
      help: {
        orgProjectsTitle: "組織のプロジェクトへのアクセス方法",
        orgProjectsIntro: "組織のプロジェクトが見えない場合、サードパーティOAuthアクセスを許可するか、トークンのスコープを書き換える必要があるかもしれません。",
        checkScopeTitle: "1. トークンのスコープを確認する",
        checkScopeDesc: "このアプリケーションは read:org スコープを要求します。現在のトークンにその権限がない場合は、アカウントを再接続してください:",
        checkScopeStep1: "「プロジェクトを開く」モーダルで「管理」をクリックします。",
        checkScopeStep2: "アカウントの横にある「切断する」をクリックします。",
        checkScopeStep3: "「接続して追加」をクリックして再度ログインします。",
        checkScopeWarning: "認証ページで「read:org」権限が要求されていることを確認してください。",
        grantAccessTitle: "2. サードパーティアクセスを許可する",
        grantAccessDesc: "デフォルトでは、管理者が承認するまでGitHubはサードパーティアプリが組織のデータを読み取ることをブロックします。",
        grantAccessStep1: "GitHubの「Settings (設定)」->「Applications (アプリケーション)」->「Authorized OAuth Apps (承認済みOAuthアプリ)」へ移動します。",
        grantAccessStep2: "Glidepace Vibe（またはアプリ名）をクリックします。",
        grantAccessStep3: "「Organization access (組織アクセス)」まで下にスクロールします。",
        grantAccessStep4: "組織の横にある「Grant (許可)」をクリックします。管理者でない場合は「Request (リクエスト)」をクリックし、プロジェクトが表示される前に管理者が承認する必要があります。",
        grantAccessOrgPolicy: "組織へのアクセスを取り消した後、再度許可する方法が見つからない場合は、こちらの手順に従ってください：",
        grantAccessOrgPolicyLink: "GitHub ドキュメントを読む",
        closeWindow: "ウィンドウを閉じる"
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
        locales: {
          en: "EN",
          ja: "日本語",
          zhCN: "中文"
        },
        authTitle: "GitHub 身份验证",
        authDesc: "输入您的个人访问令牌以安全连接。",
        authInputPlaceholder: "ghp_...",
        authSave: "保存令牌",
        authCancel: "取消",
        connectedAccountsLabel: "已连接的帐户",
        activeStatus: "活跃",
        addAccountPermissionNotice: "添加新帐户可能需要您的 Github 帐户提供其他权限。"
      },
      dashboard: {
        issuesList: "问题列表",
        filterPlaceholder: "过滤问题...",
        emptyStateTitle: "暂无项目",
        emptyStateDesc: "新建一个项目开始你的工作。",
        addProjectButton: "打开项目",
        addProjectTimelinePrompt: "添加一个项目以查看时间线",
        openProjectsModalTitle: "打开项目",
        openProjectsModalDesc: "连接并打开 GitHub 项目",
        manageButton: "管理",
        searchProjectsPlaceholder: "搜索项目...",
        sortBy: "排序方式:",
        sortRecent: "最近",
        sortOldest: "最早",
        sortNameAZ: "名称 (A → Z)",
        sortNameZA: "名称 (Z → A)",
        projectIdPrefix: "项目 ID: ",
        projectAvailable: "可用",
        openProjectAction: "打开",
        noProjectsFound: "此帐户中未找到处于活动状态的 GitHub 项目。",
        refreshProjects: "刷新项目",
        orgProjectsHelpLink: "组织的项目在哪里？"
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
      },
      help: {
        orgProjectsTitle: "如何访问组织的 GitHub 项目",
        orgProjectsIntro: "如果您无法看到组织的项目，可能是因为您需要授予第三方 OAuth 访问权限或更新您的令牌权限范围。",
        checkScopeTitle: "1. 检查令牌权限范围",
        checkScopeDesc: "此应用程序会请求 read:org 权限。如果您当前的令牌没有此权限，请重新连接您的帐户:",
        checkScopeStep1: "在“打开项目”窗口中，单击“管理”。",
        checkScopeStep2: "单击您帐户旁边的“断开连接”。",
        checkScopeStep3: "单击“连接以添加”重新登录。",
        checkScopeWarning: "在授权页面中，请确保看到“read:org”权限被请求。",
        grantAccessTitle: "2. 授予第三方访问权限",
        grantAccessDesc: "默认情况下，GitHub 会阻止第三方应用程序读取组织数据，除非管理员进行审批。",
        grantAccessStep1: "转到 GitHub -> Settings（设置） -> Applications（应用） -> Authorized OAuth Apps（已授权的OAuth应用）。",
        grantAccessStep2: "单击 Glidepace Vibe（或您的应用名称）。",
        grantAccessStep3: "向下滚动到 Organization access（组织访问）。",
        grantAccessStep4: "单击组织旁的 Grant（授予权限）。如果您不是管理员，请单击 Request（请求权限），这需要管理员批准后才能查看项目。",
        grantAccessOrgPolicy: "如果您撤销了对某个组织的访问权限，并且找不到重新授权的方法，请按照此处的说明操作：",
        grantAccessOrgPolicyLink: "阅读 GitHub 文档",
        closeWindow: "关闭窗口"
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
