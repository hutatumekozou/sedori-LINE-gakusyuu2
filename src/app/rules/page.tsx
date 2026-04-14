import { PageHeader } from "@/components/page-header";

const ruleSections = [
  {
    title: "基本ルール",
    items: [
      "このアプリは、商品ごとに問題を作って Discord DM で復習するための学習アプリです。",
      "登録した問題は、一覧・詳細・削除済み一覧から確認できます。",
      "ログインが必要なので、使い終わったらサイドバーのログアウトから閉じます。",
    ],
  },
  {
    title: "問題登録ルール",
    items: [
      "商品名は後から見返して分かる名前で入れます。Discord の問題見出しにも表示されます。",
      "問題文には相場や売値を思い出すための問いを書き、解答には答えをそのまま入れます。",
      "画像は問題文用と解答用に分けて登録できます。複数枚ある場合はまとめて選択して問題ありません。",
      "自動送信を ON にすると、復習対象日に Discord DM へ自動送信されます。",
    ],
  },
  {
    title: "Discord返信ルール",
    items: [
      "問題メッセージに返信で「解答」と送ると、解答を表示します。",
      "解答メッセージのあとに「大正解」「正解」「不正解」「手動」で結果を記録できます。",
      "カテゴリ名だけを送ると、そのカテゴリの中から苦手問題を最大 5 問まとめて出題します。",
      "「大正解」は 14 日後、「正解」は 7 日後、「不正解」は翌日に再出題されます。",
      "「手動」を送ると、その問題は自動送信 OFF に切り替わります。",
    ],
  },
  {
    title: "送信ルール",
    items: [
      "今日送るべき問題はダッシュボードと問題一覧で確認できます。",
      "管理画面の手動送信を押すと、その場で Discord DM に問題を送れます。",
      "自動送信はその日の対象問題を上限件数まで順番に送ります。",
      "同じ日に再送した問題も、最新で届いたメッセージに対して返信してください。",
    ],
  },
  {
    title: "運用時の注意",
    items: [
      "Discord の返信は、できるだけ bot から届いた最新メッセージに対して行ってください。",
      "問題や解答の内容を直したいときは、問題詳細から編集します。",
      "不要になった問題は削除できますが、削除済み一覧から戻すこともできます。",
      "動作が怪しいときは、まず Vercel 側 URL で開いているかを確認します。",
    ],
  },
];

export default function RulesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="アプリのルール"
        description="このアプリの使い方、Discord返信ルール、日々の運用ルールをまとめています。"
      />

      <section className="grid gap-4 xl:grid-cols-2">
        {ruleSections.map((section) => (
          <div
            key={section.title}
            className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]"
          >
            <h2 className="text-lg font-semibold text-slate-950">{section.title}</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
              {section.items.map((item) => (
                <li key={item} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
