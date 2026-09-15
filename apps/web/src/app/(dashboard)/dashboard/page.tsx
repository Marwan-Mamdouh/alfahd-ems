// src/app/(dashboard)/dashboard/page.tsx

export const metadata = { title: "لوحة التحكم" };

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-l from-teal-700 via-teal-600 to-teal-500 px-6 py-8 text-white shadow-sm">
        <div className="relative z-10">
          <p className="mb-2 text-sm font-medium text-teal-100">نظرة عامة</p>

          <h1 className="text-2xl font-bold md:text-3xl">لوحة التحكم</h1>

          <p className="mt-2 max-w-xl text-sm text-teal-50/80">
            تابع أهم مؤشرات النظام والبيانات الرئيسية من مكان واحد.
          </p>
        </div>

        {/* Decorative Elements */}
        <div className="absolute -left-10 -top-16 h-44 w-44 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 left-24 h-40 w-40 rounded-full bg-white/5" />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["إجمالي الموظفين", "فنيون نشطون", "تذاكر مفتوحة", "تنبيهات المخزون"].map(
          (title, index) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-2xl border border-teal-100/80 bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-md"
            >
              {/* Accent */}
              <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-teal-500 to-teal-700" />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{title}</p>

                  <p className="mt-3 text-3xl font-bold text-teal-700 dark:text-teal-400">—</p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/50">
                  <span className="h-2.5 w-2.5 rounded-full bg-teal-600 shadow-[0_0_0_5px_rgba(13,148,136,0.10)]" />
                </div>
              </div>

              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-teal-50 dark:bg-teal-950/40">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-teal-600 to-teal-400 opacity-60"
                  style={{
                    width: `${45 + index * 12}%`,
                  }}
                />
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
