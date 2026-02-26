export default function ReportSkeleton() {
  return (
    <main className='mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10'>
      <div className='h-24 animate-pulse rounded-2xl bg-slate-200' />
      <div className='h-44 animate-pulse rounded-2xl bg-slate-200' />
      <div className='h-64 animate-pulse rounded-2xl bg-slate-200' />
    </main>
  );
}
