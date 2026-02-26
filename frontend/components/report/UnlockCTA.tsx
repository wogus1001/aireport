interface UnlockCTAProps {
  onClick: () => void;
}

export default function UnlockCTA({ onClick }: UnlockCTAProps) {
  return (
    <div className='mt-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4'>
      <p className='text-sm text-indigo-800'>
        🔒 심화 분석은 잠겨 있습니다. 이름/전화번호를 입력하면 전체 리포트를 확인할 수 있습니다.
      </p>
      <button
        type='button'
        onClick={onClick}
        className='mt-3 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300 sm:w-auto'
      >
        잠금 해제하고 전체 보기
      </button>
    </div>
  );
}
